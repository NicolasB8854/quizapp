/**
 * `$default` — verarbeitet alle Client-Messages (JOIN_ROOM, DISPATCH, LEAVE_ROOM, PING).
 *
 * Ablauf für die relevanteste Message `DISPATCH`:
 *   1. Session zur eingehenden connectionId laden
 *   2. Room-State aus DDB laden
 *   3. Reducer anwenden (Deps mit getAskedQuestionIds aus Room-Record)
 *   4. `askedQuestionIds` mit den neu genutzten Frage-IDs mergen (dedup)
 *   5. Aktualisierten Room speichern
 *   6. `STATE`-Broadcast an alle Sessions im Room
 *
 * Beim `JOIN_ROOM` legen wir Session + ggf. neuen Room an und senden dem
 * joinenden Client `JOINED` mit dem aktuellen State zurück.
 */

import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'
import {
  parseClientMessage,
  createReducer,
  INITIAL_STATE,
  type ClientMessage,
  type GameState,
  type ServerMessage,
} from '@quizapp/shared'

import { getRoom, getSession, putRoom, saveSession } from '../db'
import { broadcastToRoom, sendToConnection } from '../broadcast'

/** Schickt eine ERROR-Message an den Absender. */
async function replyError(
  event: APIGatewayProxyWebsocketEventV2,
  connectionId: string,
  code: Extract<ServerMessage, { type: 'ERROR' }>['code'],
  message: string,
): Promise<void> {
  await sendToConnection(event, connectionId, { type: 'ERROR', code, message })
}

/**
 * Extrahiert alle Frage-IDs, die aktuell irgendwo im live-State stecken.
 * Wird nach jeder Action aufgerufen, um `askedQuestionIds` sauber zu halten.
 */
function collectUsedIdsFromState(state: GameState): string[] {
  const live = state.live
  if (!live) return []
  return live.usedQuestionIds ?? []
}

/**
 * Merged neue Frage-IDs in das Room-persistente `askedQuestionIds`-Array,
 * dedupliziert. Reihenfolge egal — es geht nur um Set-Semantik.
 */
function mergeAskedIds(existing: string[], additions: readonly string[]): string[] {
  if (additions.length === 0) return existing
  const set = new Set(existing)
  for (const id of additions) set.add(id)
  return Array.from(set)
}

/** Generiert eine neue Player-ID im gleichen Format wie im Reducer. */
function newPlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `player-${crypto.randomUUID()}`
  }
  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ---------- Message-Dispatch ---------------------------------------------

async function handleJoinRoom(
  event: APIGatewayProxyWebsocketEventV2,
  connectionId: string,
  msg: Extract<ClientMessage, { type: 'JOIN_ROOM' }>,
): Promise<void> {
  const roomCode = msg.roomCode.trim().toUpperCase()
  if (!roomCode) {
    await replyError(event, connectionId, 'INVALID_MESSAGE', 'roomCode fehlt')
    return
  }

  // Room laden oder neu anlegen (leerer State, leere Historie).
  let room = await getRoom(roomCode)
  if (!room) {
    room = await putRoom({
      roomCode,
      state: INITIAL_STATE,
      askedQuestionIds: [],
    })
  }

  const playerId = msg.playerId ?? newPlayerId()

  // Für Player: Roster-Registrierung im State — jeder Player joint automatisch
  // im state.round.players, damit alle Handys ein gemeinsames Roster sehen.
  //   1. Ist noch keine Runde aktiv (`phase='setup'`): erst eine leere Multi-
  //      Player-Runde initialisieren (INIT_MULTIPLAYER_ROUND).
  //   2. In Lobby-Phase: ADD_PLAYER mit der Session-Player-ID. Der Reducer
  //      ist idempotent — beim Reconnect kein Duplikat.
  // Master-Rolle registriert keinen Player-Eintrag (nur passiver Zuschauer).
  let currentState = room.state
  let stateChanged = false

  if (msg.role === 'player') {
    const reducer = createReducer({
      getAskedQuestionIds: () => new Set(room.askedQuestionIds),
    })

    if (currentState.phase === 'setup' && currentState.round === null) {
      const initialised = reducer(currentState, { type: 'INIT_MULTIPLAYER_ROUND' })
      if (initialised !== currentState) {
        currentState = initialised
        stateChanged = true
      }
    }

    if (currentState.phase === 'lobby' && currentState.round) {
      const withPlayer = reducer(currentState, {
        type: 'ADD_PLAYER',
        teamId: null,
        playerId,
        playerName: msg.playerName,
      })
      if (withPlayer !== currentState) {
        currentState = withPlayer
        stateChanged = true
      }
    }
  }

  if (stateChanged) {
    await putRoom({
      roomCode,
      state: currentState,
      askedQuestionIds: room.askedQuestionIds,
    })
  }

  await saveSession({
    connectionId,
    roomCode,
    playerId,
    role: msg.role,
    playerName: msg.playerName,
  })

  // JOINED an den joinenden Client mit dem finalen State.
  await sendToConnection(event, connectionId, {
    type: 'JOINED',
    roomCode,
    playerId,
    role: msg.role,
    state: currentState,
  })

  // STATE-Broadcast an alle anderen Sessions im Raum, damit Master und
  // vorhandene Player den neuen Player sofort sehen.
  if (stateChanged) {
    await broadcastToRoom(
      event,
      roomCode,
      { type: 'STATE', state: currentState },
      connectionId,
    )
  }

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'join-room',
      connectionId,
      roomCode,
      playerId,
      role: msg.role,
      phase: currentState.phase,
      players: currentState.round?.players.length ?? 0,
    }),
  )
}

async function handleDispatch(
  event: APIGatewayProxyWebsocketEventV2,
  connectionId: string,
  msg: Extract<ClientMessage, { type: 'DISPATCH' }>,
): Promise<void> {
  const session = await getSession(connectionId)
  if (!session) {
    await replyError(event, connectionId, 'NOT_IN_ROOM', 'Bitte erst JOIN_ROOM senden')
    return
  }
  // Master darf dispatchen — im Party-Kontext ist er der Show-Runner, der
  // Reveals auslöst, Modi wechselt und die Runde führt. Player können
  // natürlich auch dispatchen (buzzern, antworten, ihr eigenes Profil pflegen).

  const room = await getRoom(session.roomCode)
  if (!room) {
    await replyError(event, connectionId, 'ROOM_NOT_FOUND', 'Room existiert nicht mehr')
    return
  }

  // Reducer mit DB-basierten Deps ausführen.
  const reducer = createReducer({
    getAskedQuestionIds: () => new Set(room.askedQuestionIds),
  })

  let nextState: GameState
  try {
    nextState = reducer(room.state, msg.action)
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'reducer-threw',
        action: msg.action.type,
        err: err instanceof Error ? err.message : String(err),
      }),
    )
    await replyError(event, connectionId, 'REDUCER_REJECTED', 'Reducer hat die Action nicht akzeptiert')
    return
  }

  // Neue Frage-IDs mergen (idempotent — wenn Action nichts gezogen hat, no-op).
  const newIds = collectUsedIdsFromState(nextState)
  const askedQuestionIds = mergeAskedIds(room.askedQuestionIds, newIds)

  await putRoom({
    roomCode: room.roomCode,
    state: nextState,
    askedQuestionIds,
  })

  const { sent, gone } = await broadcastToRoom(event, session.roomCode, {
    type: 'STATE',
    state: nextState,
  })

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'dispatch',
      connectionId,
      roomCode: session.roomCode,
      action: msg.action.type,
      broadcast: { sent, gone },
    }),
  )
}

async function handlePing(
  event: APIGatewayProxyWebsocketEventV2,
  connectionId: string,
): Promise<void> {
  await sendToConnection(event, connectionId, { type: 'PONG' })
}

// ---------- Public Entry --------------------------------------------------

export async function handleMessage(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId
  const body = event.body ?? ''
  const parsed = parseClientMessage(body)

  if (!parsed) {
    await replyError(event, connectionId, 'INVALID_MESSAGE', 'Message ist kein gültiges ClientMessage-JSON')
    return { statusCode: 200 }
  }

  try {
    switch (parsed.type) {
      case 'JOIN_ROOM':
        await handleJoinRoom(event, connectionId, parsed)
        break
      case 'DISPATCH':
        await handleDispatch(event, connectionId, parsed)
        break
      case 'LEAVE_ROOM':
        // Session wird ohnehin via $disconnect entsorgt. Explizites LEAVE
        // signalisiert nur den Wechselwunsch — aktuell no-op.
        break
      case 'PING':
        await handlePing(event, connectionId)
        break
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'handler-threw',
        type: parsed.type,
        connectionId,
        err: err instanceof Error ? err.message : String(err),
      }),
    )
    await replyError(event, connectionId, 'INTERNAL_ERROR', 'Serverseitiger Fehler')
  }

  return { statusCode: 200 }
}
