/**
 * WebSocket-Message-Schema für die quizapp-Multiplayer-API.
 *
 * Alle Nachrichten sind JSON und diskriminieren über das `type`-Feld. Client
 * und Server nutzen dieselben Typen; die Client-Seite sendet `ClientMessage`,
 * die Server-Seite sendet `ServerMessage`.
 *
 * Warum ein Envelope statt direkt `GameAction`? Weil wir zusätzlich zu den
 * State-verändernden Actions auch Session-Meta-Messages brauchen (Join, Leave,
 * Ping). Der Reducer-Payload steckt gekapselt in `{ type: 'DISPATCH', action }`.
 */

import type { GameAction, GameState } from '../state/reducer'

// ---------- Client → Server -------------------------------------------------

/**
 * Verbindet den Client mit einem Room. Wenn `playerId` bereits gesetzt ist,
 * versucht der Server, den Player im aktuellen Room-State zu erkennen und
 * seinen Verbindungsstatus zu aktualisieren. Ohne `playerId` legt der Server
 * ein frisches Profil an und schickt die neue ID im `JOINED`-Response zurück.
 */
export interface JoinRoomMessage {
  type: 'JOIN_ROOM'
  roomCode: string
  playerName: string
  playerId?: string
  /**
   * `master` = Read-only-Anzeige-Client (großer Bildschirm), darf State
   * beobachten aber nicht dispatchen.
   * `player` = Interaktiver Client (Handy), darf State-Actions senden.
   */
  role: 'player' | 'master'
}

/**
 * Wendet eine Reducer-Action gegen den aktuellen Room-State an.
 * Der Server validiert, dass die Verbindung tatsächlich in einem Room sitzt
 * und die Rolle die Action erlaubt (Master darf keine State-Actions senden).
 */
export interface DispatchMessage {
  type: 'DISPATCH'
  action: GameAction
}

/**
 * Explizites Leave. Alternativ (und häufiger) triggert `$disconnect` das
 * automatisch, wenn der Client die Verbindung schließt.
 */
export interface LeaveRoomMessage {
  type: 'LEAVE_ROOM'
}

/**
 * Keepalive-Ping, damit Router / Proxies die WS-Verbindung nicht drop'en.
 * Server antwortet mit `PONG`. Kein State-Effekt.
 */
export interface PingMessage {
  type: 'PING'
}

export type ClientMessage =
  | JoinRoomMessage
  | DispatchMessage
  | LeaveRoomMessage
  | PingMessage

// ---------- Server → Client -------------------------------------------------

/**
 * Bestätigt einen erfolgreichen Room-Join. Enthält den vollen State-Snapshot
 * und die vom Server bestätigte `playerId` (falls neu generiert).
 */
export interface JoinedMessage {
  type: 'JOINED'
  roomCode: string
  playerId: string
  role: 'player' | 'master'
  state: GameState
}

/**
 * Vollständiger State-Broadcast nach einer erfolgreichen Reducer-Action.
 * Wir senden bewusst den kompletten State (kein Delta) — für Party-Größe
 * ist der Overhead irrelevant und der Client bleibt garantiert konsistent.
 */
export interface StateMessage {
  type: 'STATE'
  state: GameState
}

/**
 * Fehler-Response. Wird an den auslösenden Client geschickt, nicht broadcastet.
 */
export interface ErrorMessage {
  type: 'ERROR'
  code:
    | 'INVALID_MESSAGE'
    | 'ROOM_NOT_FOUND'
    | 'NOT_IN_ROOM'
    | 'ROLE_NOT_ALLOWED'
    | 'REDUCER_REJECTED'
    | 'INTERNAL_ERROR'
  message: string
}

/** Antwort auf `PING`. */
export interface PongMessage {
  type: 'PONG'
}

export type ServerMessage =
  | JoinedMessage
  | StateMessage
  | ErrorMessage
  | PongMessage

// ---------- Helper ---------------------------------------------------------

/**
 * Parst einen eingehenden Message-String und stellt sicher, dass er ein
 * gültiger `ClientMessage` ist. Gibt `null` zurück bei kaputtem JSON oder
 * unbekanntem `type`.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const msg = parsed as { type?: unknown }
    switch (msg.type) {
      case 'JOIN_ROOM':
      case 'DISPATCH':
      case 'LEAVE_ROOM':
      case 'PING':
        return parsed as ClientMessage
      default:
        return null
    }
  } catch {
    return null
  }
}
