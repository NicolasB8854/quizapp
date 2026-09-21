/**
 * Minimaler WebSocket-Wrapper für die quizapp-Multiplayer-API.
 *
 * Kern-Verhalten:
 *   - Öffnet eine Verbindung gegen `VITE_WS_URL` (siehe .env.example)
 *   - Serialisiert alle ausgehenden `ClientMessage` als JSON
 *   - Parst eingehende Frames zu `ServerMessage` und verteilt an Subscriber
 *   - Auto-Reconnect mit exponential backoff (1s → 2s → 4s → 8s → 16s → 30s cap)
 *   - Bewusst `close()` bricht Reconnect ab (User-initiiert = final)
 *
 * Keine externen Deps: Browser-natives `WebSocket` genügt. In Tests wird
 * das globale WebSocket per `vi.stubGlobal` gestubbt, wenn nötig.
 */

import type { ClientMessage, ServerMessage } from '@quizapp/shared'

type OpenHandler = () => void
type MessageHandler = (msg: ServerMessage) => void
type CloseHandler = (event: CloseEvent) => void
type ErrorHandler = (event: Event) => void

export type WSStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'reconnecting'

export interface WSClientOptions {
  /** Reconnect nach ungewolltem Close (default: true). */
  autoReconnect?: boolean
  /** Obergrenze für den Backoff in Millisekunden (default: 30 000). */
  maxReconnectDelayMs?: number
  /** Startwert des Backoff-Fensters in Millisekunden (default: 1 000). */
  initialReconnectDelayMs?: number
}

/**
 * Wrappt einen einzelnen WebSocket mit Subscribe-Registry und Reconnect.
 * Nicht thread-safe (React nutzt ohnehin single-threaded).
 */
export class WSClient {
  private readonly url: string
  private readonly autoReconnect: boolean
  private readonly maxReconnectDelayMs: number
  private readonly initialReconnectDelayMs: number

  private ws: WebSocket | null = null
  private status: WSStatus = 'idle'
  private reconnectAttempt = 0
  private reconnectTimer: number | null = null
  /** Gepuffert bis die Verbindung `open` ist. Simple FIFO-Queue. */
  private outbox: ClientMessage[] = []
  /** Bei explizitem close() wird Reconnect deaktiviert. */
  private disposed = false

  private openHandlers = new Set<OpenHandler>()
  private messageHandlers = new Set<MessageHandler>()
  private closeHandlers = new Set<CloseHandler>()
  private errorHandlers = new Set<ErrorHandler>()

  constructor(url: string, opts: WSClientOptions = {}) {
    this.url = url
    this.autoReconnect = opts.autoReconnect ?? true
    this.maxReconnectDelayMs = opts.maxReconnectDelayMs ?? 30_000
    this.initialReconnectDelayMs = opts.initialReconnectDelayMs ?? 1_000
  }

  getStatus(): WSStatus {
    return this.status
  }

  /**
   * Startet die Verbindung. Wird bei Reconnect intern erneut aufgerufen.
   * Ruft man `connect()` mehrmals, ignoriert der Client den zweiten Aufruf,
   * solange bereits eine Verbindung offen oder im Aufbau ist.
   */
  connect(): void {
    if (this.disposed) return
    if (this.status === 'open' || this.status === 'connecting') return

    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting')
    const socket = new WebSocket(this.url)
    this.ws = socket

    socket.addEventListener('open', () => {
      if (this.ws !== socket) return
      this.reconnectAttempt = 0
      this.setStatus('open')
      // Gepufferte Nachrichten flushen.
      const pending = this.outbox
      this.outbox = []
      for (const msg of pending) this.rawSend(msg)
      for (const h of this.openHandlers) h()
    })

    socket.addEventListener('message', (event: MessageEvent) => {
      if (this.ws !== socket) return
      if (typeof event.data !== 'string') return
      let parsed: ServerMessage | null = null
      try {
        parsed = JSON.parse(event.data) as ServerMessage
      } catch {
        return
      }
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return
      for (const h of this.messageHandlers) h(parsed)
    })

    socket.addEventListener('close', (event: CloseEvent) => {
      if (this.ws !== socket) return
      this.ws = null
      this.setStatus('closed')
      for (const h of this.closeHandlers) h(event)
      if (!this.disposed && this.autoReconnect) this.scheduleReconnect()
    })

    socket.addEventListener('error', (event: Event) => {
      if (this.ws !== socket) return
      for (const h of this.errorHandlers) h(event)
    })
  }

  /**
   * Sendet eine Client-Message. Wenn die Verbindung noch nicht offen ist,
   * wird die Message gepuffert und beim `open` ausgeliefert.
   * Rückgabewert: `true` wenn direkt gesendet, `false` wenn gepuffert.
   */
  send(msg: ClientMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.rawSend(msg)
    }
    this.outbox.push(msg)
    return false
  }

  private rawSend(msg: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    try {
      this.ws.send(JSON.stringify(msg))
      return true
    } catch {
      return false
    }
  }

  onOpen(handler: OpenHandler): () => void {
    this.openHandlers.add(handler)
    return () => this.openHandlers.delete(handler)
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler)
    return () => this.closeHandlers.delete(handler)
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  /** Beendet die Verbindung final. Kein Reconnect mehr, auch nicht auto. */
  close(): void {
    this.disposed = true
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    const socket = this.ws
    this.ws = null
    if (socket && socket.readyState <= WebSocket.OPEN) {
      try {
        socket.close(1000, 'client-disposed')
      } catch {
        /* ignore */
      }
    }
    this.setStatus('closed')
  }

  private scheduleReconnect(): void {
    if (this.disposed) return
    if (this.reconnectTimer !== null) return
    const delay = Math.min(
      this.maxReconnectDelayMs,
      this.initialReconnectDelayMs * 2 ** this.reconnectAttempt,
    )
    this.reconnectAttempt += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private setStatus(next: WSStatus): void {
    this.status = next
  }
}
