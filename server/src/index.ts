/**
 * WebSocket-Handler für die quizapp-Multiplayer-API (Phase 1 · Skelett).
 *
 * In Phase 1 machen wir bewusst noch keine Business-Logik. Der Handler:
 *   - loggt jede eingehende Verbindung und jedes Event nach CloudWatch
 *   - antwortet immer mit 200, damit API Gateway die Verbindung nicht drop't
 *   - hat drei sichtbare Routen: $connect / $disconnect / $default
 *
 * Ab Phase 2 wandert der Reducer aus `src/context/GameContext.tsx` hierher
 * und die $default-Route dispatcht Actions gegen einen aus DynamoDB
 * geladenen Room-State.
 *
 * Umgebungsvariablen (siehe Terraform):
 *   ROOMS_TABLE     — DynamoDB-Tabelle mit dem aktuellen Room-Snapshot
 *   SESSIONS_TABLE  — DynamoDB-Tabelle mit Verbindungs- und Player-Sessions
 *   LOG_LEVEL       — "debug" | "info" (default: "info")
 */

import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'

interface HandlerEnv {
  roomsTable: string
  sessionsTable: string
  logLevel: 'debug' | 'info'
}

function readEnv(): HandlerEnv {
  return {
    roomsTable: process.env.ROOMS_TABLE ?? '',
    sessionsTable: process.env.SESSIONS_TABLE ?? '',
    logLevel: (process.env.LOG_LEVEL as HandlerEnv['logLevel']) ?? 'info',
  }
}

export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const env = readEnv()
  const { requestContext } = event
  const { routeKey, connectionId, eventType } = requestContext

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'ws-event',
      routeKey,
      eventType,
      connectionId,
      tables: { rooms: env.roomsTable, sessions: env.sessionsTable },
    }),
  )

  switch (routeKey) {
    case '$connect':
      return handleConnect(event)
    case '$disconnect':
      return handleDisconnect(event)
    default:
      return handleDefault(event)
  }
}

async function handleConnect(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  // In Phase 2: Session-Row in SESSIONS_TABLE anlegen, Query-String-Parameter
  // (roomCode, playerId) auslesen und mit Room verknüpfen.
  console.log(
    JSON.stringify({ level: 'debug', msg: 'connect', connectionId: event.requestContext.connectionId }),
  )
  return { statusCode: 200 }
}

async function handleDisconnect(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  // In Phase 2: Session-Row löschen, ggf. Player als „offline" markieren.
  console.log(
    JSON.stringify({ level: 'debug', msg: 'disconnect', connectionId: event.requestContext.connectionId }),
  )
  return { statusCode: 200 }
}

async function handleDefault(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  // In Phase 2: JSON-Message parsen, Reducer-Action auf State anwenden,
  // Broadcast an alle Sessions im Room.
  let parsed: unknown = null
  if (event.body) {
    try {
      parsed = JSON.parse(event.body)
    } catch (err) {
      console.warn(
        JSON.stringify({ level: 'warn', msg: 'invalid-json', err: String(err) }),
      )
    }
  }
  console.log(JSON.stringify({ level: 'debug', msg: 'message', body: parsed }))
  return { statusCode: 200 }
}
