/**
 * Lokaler WebSocket-Test-Server: dieselben Handler wie die Lambda, aber mit
 * In-Memory-Speicher (siehe memory.ts). Nur für E2E-Klicktests und lokales
 * Ausprobieren — bindet ausschließlich an 127.0.0.1, keine Authentifizierung.
 *
 *   npm --prefix server run build:local && node server/dist-local/server.cjs 8787
 */
import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { handleConnect } from '../handlers/connect'
import { handleDisconnect } from '../handlers/disconnect'
import { handleMessage } from '../handlers/message'
import { sockets } from './memory'
import { setQuestionCatalog, type Question } from '@quizapp/shared'
import bundledQuestions from '@quizapp/shared/data/questions.json'

// Wie die Lambda ohne DDB-Tabelle: der gebündelte Katalog (sonst sind alle MC-Modi leer).
setQuestionCatalog(bundledQuestions as unknown as Question[])

const port = Number(process.argv[2] ?? process.env.PORT ?? 8787)
const wss = new WebSocketServer({ host: '127.0.0.1', port })

function event(connectionId: string, routeKey: string, body?: string): APIGatewayProxyWebsocketEventV2 {
  return {
    requestContext: { connectionId, routeKey, domainName: '127.0.0.1', stage: 'local' },
    body,
  } as unknown as APIGatewayProxyWebsocketEventV2
}

wss.on('connection', (ws) => {
  const id = randomUUID()
  sockets.set(id, (data) => ws.readyState === ws.OPEN && ws.send(data))
  void handleConnect(event(id, '$connect'))
  // Nachrichten pro Verbindung strikt nacheinander verarbeiten (wie bei API Gateway pro Lambda-Aufruf).
  let queue = Promise.resolve()
  ws.on('message', (raw) => {
    queue = queue.then(() => handleMessage(event(id, '$default', raw.toString())).then(() => undefined)).catch((e) => {
      console.error('message error', e)
    })
  })
  ws.on('close', () => {
    sockets.delete(id)
    void handleDisconnect(event(id, '$disconnect'))
  })
})

console.log(`QUIZO local ws server on ws://127.0.0.1:${port}`)
