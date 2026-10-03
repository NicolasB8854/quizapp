/**
 * „Insights"-Tabelle (Single-Table, PK `pk` + SK `sk`, TTL `expiresAt`):
 *
 *   REPORT          | <iso>#<rand>    → gemeldete Frage (Question Dispute Rate)
 *   METRIC#<tag>    | <event>         → Tageszähler (keine personenbezogenen Daten)
 *   GROUP#<groupId> | HISTORY         → gestellte Frage-IDs einer Gruppe (Host-Gerät),
 *                                       damit sich Fragen über Abende nicht wiederholen
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})
const TABLE = process.env.INSIGHTS_TABLE ?? ''
const DAY = 86_400

/** Erlaubte Kennzahlen. Unbekannte Namen werden ignoriert (kein Freitext-Tracking). */
export const METRIC_EVENTS = [
  'room_created', 'player_joined', 'night_started', 'night_finished', 'players_in_nights',
  'mode_played', 'question_reported', 'solo_finished', 'invite_shared', 'director_used',
] as const
export type MetricEvent = (typeof METRIC_EVENTS)[number]

export const REPORT_REASONS = ['falsch', 'mehrdeutig', 'zu-leicht', 'zu-schwer', 'tippfehler', 'sonstiges'] as const

/** Gruppen-Historie: maximal so viele IDs (älteste fallen raus). */
const GROUP_HISTORY_CAP = 2500

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function countMetric(event: MetricEvent, by = 1): Promise<void> {
  if (!TABLE || !(METRIC_EVENTS as readonly string[]).includes(event)) return
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: `METRIC#${today()}`, sk: event },
        UpdateExpression: 'ADD #c :n SET expiresAt = if_not_exists(expiresAt, :exp)',
        ExpressionAttributeNames: { '#c': 'count' },
        ExpressionAttributeValues: { ':n': by, ':exp': Math.floor(Date.now() / 1000) + 400 * DAY },
      }),
    )
  } catch (err) {
    // Kennzahlen dürfen nie das Spiel stören.
    console.error(JSON.stringify({ level: 'warn', msg: 'metric-failed', event, err: String(err) }))
  }
}

export async function readMetrics(days: number): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * DAY * 1000).toISOString().slice(0, 10)
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `METRIC#${d}` },
      }),
    )
    if (res.Items?.length) {
      out[d] = Object.fromEntries(res.Items.map((it) => [String(it.sk), Number(it.count ?? 0)]))
    }
  }
  return out
}

export interface QuestionReport {
  questionId: string
  reason: (typeof REPORT_REASONS)[number]
  note?: string
  source: 'room' | 'solo'
}

export async function saveReport(r: QuestionReport): Promise<void> {
  const now = new Date()
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: 'REPORT',
        sk: `${now.toISOString()}#${Math.random().toString(36).slice(2, 8)}`,
        ...r,
        note: r.note?.slice(0, 300),
        createdAt: now.toISOString(),
        expiresAt: Math.floor(now.getTime() / 1000) + 365 * DAY,
      },
    }),
  )
}

export async function listReports(limit = 200): Promise<Record<string, unknown>[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'REPORT' },
      ScanIndexForward: false,
      Limit: limit,
    }),
  )
  return (res.Items ?? []) as Record<string, unknown>[]
}

/** Gruppen-ID prüfen: nur zufällige, vom Client erzeugte IDs akzeptieren. */
export function isValidGroupId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id)
}

export async function getGroupHistory(groupId: string): Promise<string[]> {
  if (!TABLE) return []
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: `GROUP#${groupId}`, sk: 'HISTORY' } }))
  const ids = res.Item?.askedQuestionIds
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
}

export async function saveGroupHistory(groupId: string, ids: readonly string[]): Promise<void> {
  if (!TABLE) return
  const capped = ids.slice(-GROUP_HISTORY_CAP)
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `GROUP#${groupId}`,
        sk: 'HISTORY',
        askedQuestionIds: capped,
        updatedAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 180 * DAY,
      },
    }),
  )
}
