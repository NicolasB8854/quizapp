/**
 * WebSocket-Broadcast via API Gateway Management API.
 *
 * `endpoint` wird zur Laufzeit aus dem eingehenden Event zusammengesetzt:
 *   `https://{apiId}.execute-api.{region}.amazonaws.com/{stage}`
 * — deshalb kein statischer Env-Var. Der Handler ruft `withEndpoint(event)`
 * einmal auf und teilt den Client für die Dauer der Invocation.
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import type { ServerMessage } from '@quizapp/shared'

import { deleteSession, listConnectionsInRoom, type SessionRecord } from './db'

/**
 * Baut den Management-API-Endpoint aus dem Event zusammen.
 * Beispiel: wss://36hzcg1ymb.execute-api.eu-central-1.amazonaws.com/dev
 *          → https://36hzcg1ymb.execute-api.eu-central-1.amazonaws.com/dev
 */
function endpointFromEvent(event: APIGatewayProxyWebsocketEventV2): string {
  const { domainName, stage } = event.requestContext
  return `https://${domainName}/${stage}`
}

function clientFor(event: APIGatewayProxyWebsocketEventV2): ApiGatewayManagementApiClient {
  return new ApiGatewayManagementApiClient({ endpoint: endpointFromEvent(event) })
}

/**
 * Schickt eine Server-Message an eine einzelne Verbindung. Wenn die
 * Verbindung schon weg ist (GoneException = 410), räumt die zugehörige
 * Session in DDB weg — verhindert dass tote Verbindungen aufsummieren.
 *
 * Fängt alle anderen Fehler still ab und loggt sie, damit ein einzelner
 * Broadcast-Fehler nicht die komplette Fan-out-Schleife killt.
 */
export async function sendToConnection(
  event: APIGatewayProxyWebsocketEventV2,
  connectionId: string,
  message: ServerMessage,
): Promise<'sent' | 'gone' | 'error'> {
  const client = clientFor(event)
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      }),
    )
    return 'sent'
  } catch (err) {
    if (err instanceof GoneException) {
      // Verbindung ist tot — wir räumen die Session-Row weg.
      try {
        await deleteSession(connectionId)
      } catch {
        /* ignore secondary cleanup errors */
      }
      return 'gone'
    }
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'send-failed',
        connectionId,
        err: err instanceof Error ? err.message : String(err),
      }),
    )
    return 'error'
  }
}

/**
 * Broadcastet eine Message an alle aktiven Verbindungen eines Rooms.
 * Läuft parallel via `Promise.all` — bei 5-10 Verbindungen problemlos,
 * bei mehr ggf. mit `Promise.allSettled` und Batching aufrüsten.
 *
 * Optional `exceptConnectionId`: wird nicht bebroadcastet (typisch für
 * Sender-Client bei Optimistic-UI-Setup, aktuell nicht genutzt weil wir
 * immer den vollen State zurückschicken).
 */
export async function broadcastToRoom(
  event: APIGatewayProxyWebsocketEventV2,
  roomCode: string,
  message: ServerMessage,
  exceptConnectionId?: string,
): Promise<{ sent: number; gone: number; errors: number }> {
  const sessions: SessionRecord[] = await listConnectionsInRoom(roomCode)
  const targets = exceptConnectionId
    ? sessions.filter((s) => s.connectionId !== exceptConnectionId)
    : sessions

  const results = await Promise.all(
    targets.map((s) => sendToConnection(event, s.connectionId, message)),
  )
  return {
    sent: results.filter((r) => r === 'sent').length,
    gone: results.filter((r) => r === 'gone').length,
    errors: results.filter((r) => r === 'error').length,
  }
}
