/**
 * HTTP-CRUD-Handler für den Fragen-Katalog.
 *
 * Endpoints (Terraform: infra/apigateway_http.tf):
 *   GET    /questions          → Liste aller Fragen
 *   GET    /questions/{id}     → Einzelne Frage
 *   POST   /questions          → Neue Frage anlegen (Server generiert id)
 *   PUT    /questions/{id}     → Update
 *   DELETE /questions/{id}     → Löschen
 *
 * Response ist immer JSON. Fehler kommen mit sinnvollem statusCode und
 * `{ error: string }`-Body. CORS wird von API Gateway automatisch
 * gehandelt (siehe cors_configuration im Terraform).
 *
 * Nach jedem Write ruft der Handler `invalidateCatalog()`, damit die
 * WS-Handler-Aufrufe direkt den aktualisierten Katalog nutzen.
 *
 * Schreibende Routen (POST/PUT/DELETE /questions) sowie GET /reports und
 * GET /metrics verlangen den Header `x-admin-token` (Lambda-Env ADMIN_TOKEN).
 * Ist kein Token konfiguriert, sind sie gesperrt (sicherer Default).
 *
 * Öffentlich: GET /questions, POST /reports (Frage melden), POST /events
 * (Kennzahlen aus einer Allowlist, keine personenbezogenen Daten).
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'
import type { Question, Topic } from '@quizapp/shared'
import { timingSafeEqual } from 'node:crypto'
import { invalidateCatalog } from '../catalog'
import {
  countMetric,
  listReports,
  METRIC_EVENTS,
  readMetrics,
  REPORT_REASONS,
  saveReport,
  type MetricEvent,
  type QuestionReport,
} from '../insights'

const raw = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
})

const QUESTIONS_TABLE = process.env.QUESTIONS_TABLE ?? ''

// ---------- Response-Helper ------------------------------------------------

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// ---------- Auth -----------------------------------------------------------

function isAdmin(event: APIGatewayProxyEventV2): boolean {
  const expected = process.env.ADMIN_TOKEN ?? ''
  const given = event.headers?.['x-admin-token'] ?? ''
  if (expected.length < 16 || given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

const FORBIDDEN = json(403, { error: 'admin token required' })

// ---------- Reports & Events -----------------------------------------------

function parseBody(body: string | undefined, maxBytes = 2000): Record<string, unknown> | null {
  if (!body || body.length > maxBytes) return null
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function createReport(body: string | undefined): Promise<APIGatewayProxyResultV2> {
  const b = parseBody(body)
  const questionId = typeof b?.questionId === 'string' ? b.questionId.slice(0, 80) : ''
  const reason = b?.reason as QuestionReport['reason']
  if (!questionId || !(REPORT_REASONS as readonly string[]).includes(reason)) {
    return json(400, { error: 'questionId und gültiger reason nötig' })
  }
  await saveReport({
    questionId,
    reason,
    note: typeof b?.note === 'string' ? b.note : undefined,
    source: b?.source === 'solo' ? 'solo' : 'room',
  })
  await countMetric('question_reported')
  return json(201, { ok: true })
}

/** Nur Client-seitige Ereignisse; Spielabend-Kennzahlen zählt der WS-Handler selbst. */
const CLIENT_EVENTS: ReadonlySet<MetricEvent> = new Set<MetricEvent>(['solo_finished', 'invite_shared', 'director_used'])

async function trackEvent(body: string | undefined): Promise<APIGatewayProxyResultV2> {
  const b = parseBody(body, 300)
  const name = b?.event as MetricEvent
  if (!(METRIC_EVENTS as readonly string[]).includes(name) || !CLIENT_EVENTS.has(name)) {
    return json(400, { error: 'unknown event' })
  }
  await countMetric(name)
  return json(202, { ok: true })
}

// ---------- ID-Generator ----------------------------------------------------

function newQuestionId(topic: Topic): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `q-${topic}-${suffix}`
}

// ---------- Validation -----------------------------------------------------

/**
 * Minimal-Validation. Wir sind wohlwollend — der Reducer selbst wird
 * gegen kaputte Daten robust. Hier nur die absoluten Muss-Felder prüfen.
 */
function validateQuestion(input: unknown): { ok: true; question: Question } | { ok: false; reason: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: 'body must be a JSON object' }
  }
  const rec = input as Record<string, unknown>
  if (typeof rec.type !== 'string') {
    return { ok: false, reason: 'type is required (multiple-choice|open|true-false|warmup-riddle)' }
  }
  if (typeof rec.topic !== 'string') {
    return { ok: false, reason: 'topic is required' }
  }
  if (typeof rec.question !== 'string' || rec.question.trim().length === 0) {
    return { ok: false, reason: 'question text is required' }
  }
  if (rec.type === 'multiple-choice') {
    if (!Array.isArray(rec.options) || rec.options.length < 2) {
      return { ok: false, reason: 'multiple-choice needs options[] with >= 2 entries' }
    }
    if (typeof rec.correctIndex !== 'number' || rec.correctIndex < 0 || rec.correctIndex >= rec.options.length) {
      return { ok: false, reason: 'correctIndex must reference an existing option' }
    }
  }
  if (rec.type === 'true-false') {
    if (typeof rec.correctAnswer !== 'boolean') {
      return { ok: false, reason: 'true-false needs correctAnswer boolean' }
    }
  }
  if (rec.type === 'warmup-riddle') {
    if (typeof rec.solution !== 'string') {
      return { ok: false, reason: 'warmup-riddle needs solution string' }
    }
    if (!Array.isArray(rec.hints)) {
      return { ok: false, reason: 'warmup-riddle needs hints[]' }
    }
  }
  return { ok: true, question: input as Question }
}

// ---------- Handler-Implementierungen --------------------------------------

async function listQuestions(): Promise<APIGatewayProxyResultV2> {
  const items: Question[] = []
  let ExclusiveStartKey: Record<string, unknown> | undefined = undefined
  do {
    const res: {
      Items?: Record<string, unknown>[]
      LastEvaluatedKey?: Record<string, unknown>
    } = await ddb.send(
      new ScanCommand({ TableName: QUESTIONS_TABLE, ExclusiveStartKey }),
    )
    for (const item of res.Items ?? []) items.push(item as unknown as Question)
    ExclusiveStartKey = res.LastEvaluatedKey
  } while (ExclusiveStartKey)

  return json(200, { questions: items, count: items.length })
}

async function getQuestion(id: string): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new GetCommand({ TableName: QUESTIONS_TABLE, Key: { id } }),
  )
  if (!res.Item) return json(404, { error: 'not found', id })
  return json(200, { question: res.Item })
}

async function createQuestion(body: string | undefined): Promise<APIGatewayProxyResultV2> {
  if (!body) return json(400, { error: 'body missing' })
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return json(400, { error: 'body is not valid JSON' })
  }
  const validation = validateQuestion(parsed)
  if (!validation.ok) return json(400, { error: validation.reason })

  const question = validation.question
  const now = new Date().toISOString()
  // Server generiert die ID, wenn keine gesetzt oder Duplikat.
  const id =
    typeof (question as { id?: unknown }).id === 'string' &&
    (question as { id: string }).id.trim().length > 0
      ? (question as { id: string }).id
      : newQuestionId(question.topic)

  const item: Question = {
    ...question,
    id,
    createdAt: (question as { createdAt?: string }).createdAt ?? now,
    updatedAt: now,
  }

  await ddb.send(
    new PutCommand({ TableName: QUESTIONS_TABLE, Item: item as unknown as Record<string, unknown> }),
  )
  invalidateCatalog()
  return json(201, { question: item })
}

async function updateQuestion(
  id: string,
  body: string | undefined,
): Promise<APIGatewayProxyResultV2> {
  if (!body) return json(400, { error: 'body missing' })
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return json(400, { error: 'body is not valid JSON' })
  }
  const validation = validateQuestion(parsed)
  if (!validation.ok) return json(400, { error: validation.reason })

  // ID aus Path gewinnt (URL ist die Wahrheit für die Row).
  const existing = await ddb.send(
    new GetCommand({ TableName: QUESTIONS_TABLE, Key: { id } }),
  )
  const item: Question = {
    ...validation.question,
    id,
    createdAt:
      (existing.Item as { createdAt?: string } | undefined)?.createdAt ??
      new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await ddb.send(
    new PutCommand({ TableName: QUESTIONS_TABLE, Item: item as unknown as Record<string, unknown> }),
  )
  invalidateCatalog()
  return json(200, { question: item })
}

async function deleteQuestion(id: string): Promise<APIGatewayProxyResultV2> {
  await ddb.send(
    new DeleteCommand({ TableName: QUESTIONS_TABLE, Key: { id } }),
  )
  invalidateCatalog()
  return json(200, { ok: true, id })
}

// ---------- Entry ----------------------------------------------------------

export async function handleHttp(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const { routeKey, pathParameters } = event
  console.log(
    JSON.stringify({ level: 'info', msg: 'http', routeKey, path: event.rawPath }),
  )

  try {
    switch (routeKey) {
      case 'GET /questions':
        return await listQuestions()
      case 'GET /questions/{id}':
        return pathParameters?.id
          ? await getQuestion(pathParameters.id)
          : json(400, { error: 'id missing in path' })
      case 'POST /questions':
        if (!isAdmin(event)) return FORBIDDEN
        return await createQuestion(event.body)
      case 'PUT /questions/{id}':
        if (!isAdmin(event)) return FORBIDDEN
        return pathParameters?.id
          ? await updateQuestion(pathParameters.id, event.body)
          : json(400, { error: 'id missing in path' })
      case 'DELETE /questions/{id}':
        if (!isAdmin(event)) return FORBIDDEN
        return pathParameters?.id
          ? await deleteQuestion(pathParameters.id)
          : json(400, { error: 'id missing in path' })
      case 'POST /reports':
        return await createReport(event.body)
      case 'GET /reports':
        if (!isAdmin(event)) return FORBIDDEN
        return json(200, { reports: await listReports() })
      case 'POST /events':
        return await trackEvent(event.body)
      case 'GET /metrics':
        if (!isAdmin(event)) return FORBIDDEN
        return json(200, { metrics: await readMetrics(30) })
      default:
        return json(404, { error: 'route not found', routeKey })
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'http-handler-threw',
        routeKey,
        err: err instanceof Error ? err.message : String(err),
      }),
    )
    return json(500, { error: 'internal server error' })
  }
}
