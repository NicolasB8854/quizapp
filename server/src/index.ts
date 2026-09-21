/**
 * Multi-Protocol-Entry für die quizapp-Lambda.
 *
 * Die gleiche Function bedient beide API Gateways:
 *   - WebSocket (Multi-Device-Sessions): $connect / $disconnect / $default
 *   - HTTP     (Fragen-Editor CRUD):    GET/POST/PUT/DELETE /questions[/id]
 *
 * Diskriminator: `requestContext.http` existiert nur bei HTTP-Events.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'

import { ensureCatalogLoaded } from './catalog'
import { handleConnect } from './handlers/connect'
import { handleDisconnect } from './handlers/disconnect'
import { handleMessage } from './handlers/message'
import { handleHttp } from './handlers/http'

function isHttpEvent(event: unknown): event is APIGatewayProxyEventV2 {
  return (
    typeof event === 'object' &&
    event !== null &&
    'requestContext' in event &&
    typeof (event as { requestContext: unknown }).requestContext === 'object' &&
    (event as { requestContext: { http?: unknown } }).requestContext.http !== undefined
  )
}

export async function handler(
  event: unknown,
): Promise<APIGatewayProxyResultV2> {
  if (isHttpEvent(event)) {
    // HTTP-CRUD läuft ohne Reducer-Katalog-Cache — der HTTP-Handler
    // liest direkt aus DDB. Kein `ensureCatalogLoaded` nötig.
    return handleHttp(event)
  }

  // Alles andere ist WebSocket. Vor dem Handler: sicherstellen dass
  // der Fragen-Katalog aus DDB im Memory ist (Reducer nutzt ihn intern).
  await ensureCatalogLoaded()

  const wsEvent = event as APIGatewayProxyWebsocketEventV2
  const { routeKey } = wsEvent.requestContext
  switch (routeKey) {
    case '$connect':
      return handleConnect(wsEvent)
    case '$disconnect':
      return handleDisconnect(wsEvent)
    default:
      return handleMessage(wsEvent)
  }
}
