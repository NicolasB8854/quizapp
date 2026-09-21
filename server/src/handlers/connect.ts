/**
 * `$connect` — Handshake, keine Business-Logik.
 *
 * Wir speichern die Session erst, wenn der Client eine `JOIN_ROOM`-Message
 * sendet. So kann eine WS-Verbindung leer bestehen, wenn der Client sich
 * z. B. gerade zwischen Rooms bewegt.
 *
 * Wenn wir Verbindungen ablehnen wollten, wäre hier der Ort (Rate-Limits,
 * Auth-Token-Check). Für den Prototyp: alles durchwinken.
 */

import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'

export async function handleConnect(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'connect',
      connectionId: event.requestContext.connectionId,
    }),
  )
  return { statusCode: 200 }
}
