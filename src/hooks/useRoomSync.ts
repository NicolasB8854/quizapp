/**
 * `useRoomSync` — verbindet einen Client per WebSocket mit einem Server-Room.
 *
 * Client-Modell (Phase 3b): server-authoritativ. Frontend schickt `DISPATCH`
 * übers WS und empfängt den kanonischen State per `STATE`-Broadcast. Kein
 * Optimistic UI in dieser Iteration — der Roundtrip bleibt bei LAN/WLAN
 * unter 300 ms und ist damit für Party-Kontexte gut genug.
 *
 * Verwendung:
 *
 *   const room = useRoomSync({
 *     wsUrl: import.meta.env.VITE_WS_URL,
 *     roomCode: 'ABCD',
 *     playerName: 'Sara',
 *     role: 'player',
 *   })
 *   if (room.state) room.dispatch({ type: 'ADD_TEAM' })
 *
 * Reconnect-Verhalten: der `WSClient` reconnected automatisch mit
 * exponential backoff. Bei jedem `open`-Event senden wir erneut
 * `JOIN_ROOM` — falls die `playerId` vom vorherigen `JOINED` bekannt ist,
 * verwenden wir sie, damit der Server denselben Player wiedererkennt.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameAction, GameState, ReactionEmoji, ServerMessage } from '@quizapp/shared'
import { getGroupId } from '@/lib/groupId'
import { WSClient } from '@/lib/wsClient'

export interface UseRoomSyncOptions {
  /** WebSocket-URL. Bei `undefined` bleibt der Hook inaktiv (Offline-Fallback). */
  wsUrl: string | undefined
  roomCode: string
  playerName: string
  /**
   * Angefragte Rolle. Vom Server bestätigte effektive Rolle steht im
   * Hook-Response (`role` + `stageOnly`) — die kann bei Kollision
   * (schon anderer Host im Room) abweichen.
   */
  role: 'player' | 'host'
  /**
   * Bei `role='host'`: `true` = reines Bühnen-Gerät (Big-Screen-Layout,
   * kein Team-Beitritt); `false` = Host spielt mit. Bei `player` ignoriert.
   */
  stageOnly?: boolean
  /** Vorhandene `playerId` aus dem localStorage — für Wiedererkennung. */
  playerId?: string
  /** Wenn `false`, macht der Hook nichts (praktisch für UI-Vorbedingungen). */
  enabled?: boolean
}

export type RoomSyncStatus =
  | 'idle'         // enabled=false oder wsUrl fehlt
  | 'connecting'   // WS-Handshake läuft
  | 'joining'      // WS offen, JOIN_ROOM gesendet, warte auf JOINED
  | 'joined'       // JOINED empfangen, State liegt vor
  | 'reconnecting' // Nach Verbindungsabbruch
  | 'error'        // ERROR-Message empfangen

export interface UseRoomSyncResult {
  status: RoomSyncStatus
  state: GameState | null
  playerId: string | null
  /**
   * Vom Server bestätigte Rolle. Kann von der angefragten Rolle abweichen,
   * wenn z. B. bereits ein anderer Host im Room ist. `null` solange nicht
   * gejoined.
   */
  role: 'player' | 'host' | null
  /** Vom Server bestätigter Bühnen-Modus. `null` solange nicht gejoined. */
  stageOnly: boolean | null
  lastError: string | null
  /**
   * Schickt eine Reducer-Action an den Server. Kein direkter Local-Update:
   * der State kommt zurück im nächsten `STATE`-Broadcast.
   * Rückgabe: `true` wenn gesendet, `false` wenn (noch) nicht möglich.
   */
  dispatch: (action: GameAction) => boolean
  /** Flüchtige Emoji-Reaktionen der letzten Sekunden (für das Overlay). */
  reactions: LiveReaction[]
  /** Schickt eine Emoji-Reaktion (clientseitig gedrosselt). */
  react: (emoji: ReactionEmoji) => boolean
}

export interface LiveReaction {
  id: number
  playerId: string | null
  playerName: string
  emoji: ReactionEmoji
}

/** So lange bleibt eine Reaktion im Overlay. */
export const REACTION_TTL_MS = 2600
/** Clientseitige Drossel pro Gerät. */
const REACT_THROTTLE_MS = 900
let reactionSeq = 0

export function useRoomSync(opts: UseRoomSyncOptions): UseRoomSyncResult {
  const enabled = opts.enabled !== false && !!opts.wsUrl
  const [status, setStatus] = useState<RoomSyncStatus>('idle')
  const [state, setState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(opts.playerId ?? null)
  const [effectiveRole, setEffectiveRole] = useState<'player' | 'host' | null>(null)
  const [effectiveStageOnly, setEffectiveStageOnly] = useState<boolean | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [reactions, setReactions] = useState<LiveReaction[]>([])
  const lastReactRef = useRef(0)

  // Wir halten Referenzen auf mutierende Werte, damit der useEffect nicht
  // bei jeder Namens- oder Rollen-Änderung die Verbindung neu aufbaut.
  const playerIdRef = useRef<string | null>(opts.playerId ?? null)
  const playerNameRef = useRef(opts.playerName)
  const roleRef = useRef(opts.role)
  const stageOnlyRef = useRef(opts.stageOnly ?? false)
  playerNameRef.current = opts.playerName
  roleRef.current = opts.role
  stageOnlyRef.current = opts.stageOnly ?? false

  const clientRef = useRef<WSClient | null>(null)

  useEffect(() => {
    if (!enabled || !opts.wsUrl || !opts.roomCode) {
      setStatus('idle')
      setState(null)
      setLastError(null)
      return
    }

    const client = new WSClient(opts.wsUrl, { autoReconnect: true })
    clientRef.current = client

    const unsubOpen = client.onOpen(() => {
      setStatus('joining')
      client.send({
        type: 'JOIN_ROOM',
        roomCode: opts.roomCode,
        playerName: playerNameRef.current,
        role: roleRef.current,
        stageOnly: stageOnlyRef.current,
        ...(playerIdRef.current ? { playerId: playerIdRef.current } : {}),
        ...(roleRef.current === 'host' ? { groupId: getGroupId() } : {}),
      })
    })

    const unsubMessage = client.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'JOINED':
          playerIdRef.current = msg.playerId
          setPlayerId(msg.playerId)
          setEffectiveRole(msg.role)
          setEffectiveStageOnly(msg.stageOnly)
          setState(msg.state)
          setStatus('joined')
          setLastError(null)
          break
        case 'STATE':
          setState(msg.state)
          // Falls wir zwischenzeitlich in Fehler waren, jetzt geklärt.
          setStatus('joined')
          break
        case 'ERROR':
          // Abgelehnte Einzelaktion (z. B. zwei Teams buzzern gleichzeitig):
          // kurz anzeigen, aber die Verbindung bleibt nutzbar.
          if (msg.code === 'FORBIDDEN' || msg.code === 'REDUCER_REJECTED') {
            setLastError(msg.message)
            window.setTimeout(() => setLastError((cur) => (cur === msg.message ? null : cur)), 3000)
            break
          }
          setLastError(`${msg.code}: ${msg.message}`)
          setStatus('error')
          break
        case 'PONG':
          // Keepalive — kein State-Effekt.
          break
        case 'REACTION': {
          const r: LiveReaction = { id: ++reactionSeq, playerId: msg.playerId, playerName: msg.playerName, emoji: msg.emoji }
          // Höchstens 12 gleichzeitig, damit ein Spam-Moment den Screen nicht zumacht.
          setReactions((cur) => [...cur.slice(-11), r])
          window.setTimeout(() => setReactions((cur) => cur.filter((x) => x.id !== r.id)), REACTION_TTL_MS)
          break
        }
      }
    })

    const unsubClose = client.onClose(() => {
      // Solange autoReconnect aktiv ist, gehen wir in 'reconnecting'.
      // Der WSClient kümmert sich um den nächsten `open`, wir warten passiv.
      setStatus('reconnecting')
    })

    const unsubError = client.onError(() => {
      // Browser-error events sind meist Debug-Rauschen (keine Details);
      // wir loggen nur.
      /* no-op */
    })

    // Wiedereinstieg: Handy entsperrt, Tab wieder sichtbar, Netz zurück →
    // sofort neu verbinden statt auf den Backoff zu warten.
    const wake = () => {
      if (document.visibilityState === 'visible') client.reconnectNow()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('pageshow', wake)

    // Status auf 'connecting' setzen, sobald der Aufbau startet.
    setStatus('connecting')
    client.connect()

    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      window.removeEventListener('pageshow', wake)
      unsubOpen()
      unsubMessage()
      unsubClose()
      unsubError()
      client.close()
      clientRef.current = null
    }
  }, [enabled, opts.wsUrl, opts.roomCode])

  const dispatch = useCallback((action: GameAction) => {
    const c = clientRef.current
    if (!c) return false
    return c.send({ type: 'DISPATCH', action })
  }, [])

  const react = useCallback((emoji: ReactionEmoji) => {
    const c = clientRef.current
    const now = Date.now()
    if (!c || now - lastReactRef.current < REACT_THROTTLE_MS) return false
    lastReactRef.current = now
    return c.send({ type: 'REACT', emoji })
  }, [])

  return {
    status,
    state,
    playerId,
    role: effectiveRole,
    stageOnly: effectiveStageOnly,
    lastError,
    dispatch,
    reactions,
    react,
  }
}
