// Minimale Typen für `ws` (nur was localServer.ts nutzt) — spart @types/ws.
declare module 'ws' {
  export class WebSocket {
    static readonly OPEN: number
    readonly OPEN: number
    readyState: number
    send(data: string): void
    on(event: 'message', cb: (data: { toString(): string }) => void): this
    on(event: 'close', cb: () => void): this
  }
  export class WebSocketServer {
    constructor(opts: { host: string; port: number })
    on(event: 'connection', cb: (ws: WebSocket) => void): this
  }
}
