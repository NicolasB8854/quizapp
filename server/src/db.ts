/**
 * DynamoDB-Zugriffsschicht für den WebSocket-Handler.
 *
 * Nutzt den DocumentClient (aus `@aws-sdk/lib-dynamodb`), damit wir mit
 * nativen JS-Objekten arbeiten und uns AttributeValue-Marshalling sparen.
 *
 * Tabellen (siehe infra/dynamodb.tf):
 *   - ROOMS_TABLE    (PK: roomCode)
 *       - state:            serialisierter GameState
 *       - askedQuestionIds: string[]  — Cross-Round-Historie
 *       - updatedAt:        ISO-String
 *       - expiresAt:        Unix-Sekunden (TTL)
 *   - SESSIONS_TABLE (PK: connectionId, GSI: RoomIndex hash=roomCode)
 *       - roomCode:    string
 *       - playerId:    string
 *       - role:        'player' | 'master'
 *       - playerName:  string
 *       - connectedAt: ISO-String
 *       - expiresAt:   Unix-Sekunden (TTL)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import type { GameState } from '@quizapp/shared'

const raw = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: {
    // Undefined-Felder werden nicht geschrieben — sonst crashen die
    // vielen optionalen State-Felder (activeQuestion: null, ...).
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
})

const ROOMS_TABLE = process.env.ROOMS_TABLE ?? ''
const SESSIONS_TABLE = process.env.SESSIONS_TABLE ?? ''
const ROOM_TTL_HOURS = Number(process.env.ROOM_TTL_HOURS ?? 24)
const SESSION_TTL_HOURS = 8

// ---------- Rooms ----------------------------------------------------------

export interface RoomRecord {
  roomCode: string
  state: GameState
  askedQuestionIds: string[]
  updatedAt: string
  expiresAt: number
}

/** Lädt einen Room. `null` wenn nicht vorhanden. */
export async function getRoom(roomCode: string): Promise<RoomRecord | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: ROOMS_TABLE,
      Key: { roomCode },
    }),
  )
  return (res.Item as RoomRecord | undefined) ?? null
}

/** Erstellt oder ersetzt einen Room-Eintrag. */
export async function putRoom(record: Omit<RoomRecord, 'updatedAt' | 'expiresAt'>): Promise<RoomRecord> {
  const now = new Date()
  const full: RoomRecord = {
    ...record,
    updatedAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + ROOM_TTL_HOURS * 3600,
  }
  await ddb.send(
    new PutCommand({
      TableName: ROOMS_TABLE,
      Item: full,
    }),
  )
  return full
}

// ---------- Sessions -------------------------------------------------------

export interface SessionRecord {
  connectionId: string
  roomCode: string
  playerId: string
  role: 'player' | 'master'
  playerName: string
  connectedAt: string
  expiresAt: number
}

/** Legt oder aktualisiert eine WebSocket-Session an. */
export async function saveSession(
  session: Omit<SessionRecord, 'connectedAt' | 'expiresAt'>,
): Promise<SessionRecord> {
  const now = new Date()
  const full: SessionRecord = {
    ...session,
    connectedAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + SESSION_TTL_HOURS * 3600,
  }
  await ddb.send(
    new PutCommand({
      TableName: SESSIONS_TABLE,
      Item: full,
    }),
  )
  return full
}

/** Lädt eine Session anhand der connectionId. */
export async function getSession(connectionId: string): Promise<SessionRecord | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { connectionId },
    }),
  )
  return (res.Item as SessionRecord | undefined) ?? null
}

/**
 * Löscht eine Session und liefert die gelöschten Attribute zurück (für
 * eventuellen Broadcast, dass ein Player gegangen ist).
 */
export async function deleteSession(connectionId: string): Promise<SessionRecord | null> {
  const res = await ddb.send(
    new DeleteCommand({
      TableName: SESSIONS_TABLE,
      Key: { connectionId },
      ReturnValues: 'ALL_OLD',
    }),
  )
  return (res.Attributes as SessionRecord | undefined) ?? null
}

/**
 * Listet alle aktiven Sessions eines Rooms via GSI `RoomIndex`.
 * Wird für Broadcasts an alle Verbindungen im Raum genutzt.
 */
export async function listConnectionsInRoom(roomCode: string): Promise<SessionRecord[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: SESSIONS_TABLE,
      IndexName: 'RoomIndex',
      KeyConditionExpression: 'roomCode = :rc',
      ExpressionAttributeValues: { ':rc': roomCode },
    }),
  )
  return (res.Items as SessionRecord[] | undefined) ?? []
}
