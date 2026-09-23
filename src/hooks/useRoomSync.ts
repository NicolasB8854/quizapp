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
import type { GameAction, GameState, ServerMessage } from '@quizapp/shared'
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
}

export function useRoomSync(opts: UseRoomSyncOptions): UseRoomSyncResult {
  const enabled = opts.enabled !== false && !!opts.wsUrl
  const [status, setStatus] = useState<RoomSyncStatus>('idle')
  const [state, setState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(opts.playerId ?? null)
  const [effectiveRole, setEffectiveRole] = useState<'player' | 'host' | null>(null)
  const [effectiveStageOnly, setEffectiveStageOnly] = useState<boolean | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

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
          setLastError(`${msg.code}: ${msg.message}`)
          setStatus('error')
          break
        case 'PONG':
          // Keepalive — kein State-Effekt.
          break
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

    // Status auf 'connecting' setzen, sobald der Aufbau startet.
    setStatus('connecting')
    client.connect()

    return () => {
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

  return {
    status,
    state,
    playerId,
    role: effectiveRole,
    stageOnly: effectiveStageOnly,
    lastError,
    dispatch,
  }
}
