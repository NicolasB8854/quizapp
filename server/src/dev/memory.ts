/**
 * In-Memory-Ersatz für DynamoDB, API-Gateway-Broadcast und Insights —
 * nur für den lokalen Test-Server (`localServer.ts`, E2E-Klicktests).
 * Wird per esbuild-Alias statt `../db`, `../broadcast`, `../insights`
 * eingebunden (siehe build-local.mjs); Produktionscode bleibt unverändert.
 */
import type { ServerMessage } from '@quizapp/shared'
import type { RoomRecord, SessionRecord } from '../db'

export const rooms = new Map<string, RoomRecord>()
export const sessions = new Map<string, SessionRecord>()
/** connectionId → Senden an den echten WebSocket. */
export const sockets = new Map<string, (data: string) => void>()
const groupHistory = new Map<string, string[]>()

// --- db -------------------------------------------------------------------

export async function getRoom(roomCode: string): Promise<RoomRecord | null> {
  return rooms.get(roomCode) ?? null
}

export async function putRoom(record: Omit<RoomRecord, 'updatedAt' | 'expiresAt'>): Promise<RoomRecord> {
  const full: RoomRecord = { ...record, updatedAt: new Date().toISOString(), expiresAt: 0 }
  rooms.set(record.roomCode, full)
  return full
}

export async function saveSession(session: Omit<SessionRecord, 'connectedAt' | 'expiresAt'>): Promise<SessionRecord> {
  const full: SessionRecord = { ...session, connectedAt: new Date().toISOString(), expiresAt: 0 }
  sessions.set(session.connectionId, full)
  return full
}

export async function getSession(connectionId: string): Promise<SessionRecord | null> {
  return sessions.get(connectionId) ?? null
}

export async function deleteSession(connectionId: string): Promise<SessionRecord | null> {
  const s = sessions.get(connectionId) ?? null
  sessions.delete(connectionId)
  return s
}

export async function listConnectionsInRoom(roomCode: string): Promise<SessionRecord[]> {
  return [...sessions.values()].filter((s) => s.roomCode === roomCode)
}

// --- broadcast ------------------------------------------------------------

export async function sendToConnection(_event: unknown, connectionId: string, message: ServerMessage): Promise<'sent' | 'gone' | 'error'> {
  const send = sockets.get(connectionId)
  if (!send) {
    sessions.delete(connectionId)
    return 'gone'
  }
  send(JSON.stringify(message))
  return 'sent'
}

export async function broadcastToRoom(
  event: unknown,
  roomCode: string,
  message: ServerMessage,
  exceptConnectionId?: string,
): Promise<{ sent: number; gone: number; errors: number }> {
  let sent = 0
  let gone = 0
  for (const s of await listConnectionsInRoom(roomCode)) {
    if (s.connectionId === exceptConnectionId) continue
    if ((await sendToConnection(event, s.connectionId, message)) === 'sent') sent++
    else gone++
  }
  return { sent, gone, errors: 0 }
}

// --- insights -------------------------------------------------------------

export async function countMetric(): Promise<void> {}

export function isValidGroupId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id)
}

export async function getGroupHistory(groupId: string): Promise<string[]> {
  return groupHistory.get(groupId) ?? []
}

export async function saveGroupHistory(groupId: string, ids: readonly string[]): Promise<void> {
  groupHistory.set(groupId, [...ids])
}
