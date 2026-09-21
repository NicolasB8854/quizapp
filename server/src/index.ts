/**
 * WebSocket-Handler-Einstieg für die quizapp-Multiplayer-API.
 *
 * Routet anhand von `requestContext.routeKey` auf die drei getrennten
 * Handler-Module. Die eigentliche Business-Logik lebt in `handlers/message.ts`.
 *
 * Umgebungsvariablen (aus Terraform):
 *   ROOMS_TABLE     — DynamoDB-Tabelle mit dem Room-Snapshot
 *   SESSIONS_TABLE  — DynamoDB-Tabelle mit WS-Sessions
 *   PLAYERS_TABLE   — DynamoDB-Tabelle mit persistenten Player-Profilen (Phase 3c)
 *   ROOM_TTL_HOURS  — Auto-Cleanup-Fenster für Rooms
 *   LOG_LEVEL       — 'debug' | 'info'
 */

import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'

import { ensureCatalogLoaded } from './catalog'
import { handleConnect } from './handlers/connect'
import { handleDisconnect } from './handlers/disconnect'
import { handleMessage } from './handlers/message'

export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  // Beim ersten Aufruf im Container: Fragen aus DDB laden.
  // Idempotent — nachfolgende Aufrufe sind no-op.
  await ensureCatalogLoaded()

  const { routeKey } = event.requestContext
  switch (routeKey) {
    case '$connect':
      return handleConnect(event)
    case '$disconnect':
      return handleDisconnect(event)
    default:
      return handleMessage(event)
  }
}
