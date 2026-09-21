/**
 * `$disconnect` — WS-Verbindung wurde geschlossen (Client-seitig oder Timeout).
 *
 * Wir räumen die Session-Row in DDB weg, damit spätere Broadcasts diese
 * Verbindung nicht mehr anfassen. Die zugehörige Player-Entität bleibt im
 * Room-State erhalten — der Reducer entscheidet später, wie „offline"
 * signalisiert wird (Phase 3b).
 */

import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'

import { deleteSession } from '../db'

export async function handleDisconnect(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId
  try {
    const removed = await deleteSession(connectionId)
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'disconnect',
        connectionId,
        roomCode: removed?.roomCode ?? null,
        playerId: removed?.playerId ?? null,
      }),
    )
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'disconnect-cleanup-failed',
        connectionId,
        err: err instanceof Error ? err.message : String(err),
      }),
    )
  }
  return { statusCode: 200 }
}
