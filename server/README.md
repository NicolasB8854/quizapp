# quizapp-server

Lambda-Handler für die WebSocket-API des quizapp-Multiplayer-Modus.

Dieser Ordner enthält den TypeScript-Code für die einzige Lambda-Funktion
hinter dem API Gateway. Terraform in `../infra/` verpackt das gebaute
Bundle in ein ZIP und deployt es.

## Bauen

```sh
# einmalig
npm --prefix server install

# Bundle bauen (schreibt server/dist/index.js)
npm --prefix server run build

# Typecheck ohne Bundle
npm --prefix server run typecheck
```

Der Build nutzt `esbuild` und erzeugt ein einzelnes CommonJS-File mit
Inline-Sourcemap. Das AWS SDK v3 (`@aws-sdk/*`) wird als `external`
markiert — es liegt bereits in der Lambda-Runtime bei.

## Struktur

```
server/
├── src/
│   └── index.ts       Handler mit $connect / $disconnect / $default
├── build.mjs          esbuild-Konfiguration
├── package.json
└── tsconfig.json
```

## Handler-Vertrag

- Event-Typ: `APIGatewayProxyWebsocketEventV2`
- Response: `{ statusCode: 200 }` (oder 4xx bei bewusstem Reject)
- Routing: über `event.requestContext.routeKey`

## Umgebungsvariablen (aus Terraform gesetzt)

| Variable | Zweck |
|---|---|
| `ROOMS_TABLE` | DynamoDB-Tabelle mit Room-Snapshots |
| `SESSIONS_TABLE` | DynamoDB-Tabelle mit WS-Sessions |
| `PLAYERS_TABLE` | DynamoDB-Tabelle mit persistenten Player-Profilen |
| `ROOM_TTL_HOURS` | Auto-Cleanup-Fenster für Rooms |
| `LOG_LEVEL` | `debug` in dev, `info` in prod |

## Status

**Phase 1 — Skelett.** Der Handler loggt Events und antwortet mit 200,
mehr nicht. Ab Phase 2 wandert der Reducer aus
`../src/context/GameContext.tsx` hierher und $default dispatcht Actions
gegen den Room-State aus DynamoDB.
