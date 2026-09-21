/**
 * Fragenkatalog-Loader für den Server.
 *
 * Beim Cold-Start (erster Handler-Aufruf pro Container) scannt der Loader
 * die DDB-Tabelle `questions` einmal und ruft `setQuestionCatalog(...)`
 * aus `@quizapp/shared`, sodass der Reducer + alle Question-Helpers
 * (pickQuestion, pickTrueFalse, …) mit dem DDB-Katalog arbeiten.
 *
 * Container-Lifetime: typisch 15-30 Minuten (Lambda-Concurrency). Danach
 * frischer Cold-Start → frischer DDB-Read. Content-Updates greifen also
 * mit Verzögerung von einer Container-Lebenszeit, ohne Redeploy.
 *
 * Fallback: wenn DDB leer ist oder der Scan scheitert, bleibt der inline
 * JSON aus `@quizapp/shared/data/questions.json` aktiv. Damit ist der
 * Server auch dann funktional, wenn die Migration noch nicht durchlief.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { Question } from '@quizapp/shared'
import { setQuestionCatalog } from '@quizapp/shared'

const raw = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(raw)

const QUESTIONS_TABLE = process.env.QUESTIONS_TABLE ?? ''

/**
 * Wahrheitsstatus des Katalog-Caches. Bei true wurde bereits geladen
 * (auch wenn das Ergebnis leer war).
 */
let loaded = false

/**
 * Scannt die komplette Questions-Tabelle. Bei > 1 MB (DDB-Scan-Limit)
 * paginiert automatisch.
 */
async function scanAllQuestions(): Promise<Question[]> {
  const items: Question[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined = undefined

  do {
    const res: {
      Items?: Record<string, unknown>[]
      LastEvaluatedKey?: Record<string, unknown>
    } = await ddb.send(
      new ScanCommand({
        TableName: QUESTIONS_TABLE,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )
    if (res.Items) {
      for (const item of res.Items) {
        // Wir vertrauen dem Upload-Skript — Items sind bereits gültige Questions.
        items.push(item as unknown as Question)
      }
    }
    exclusiveStartKey = res.LastEvaluatedKey
  } while (exclusiveStartKey)

  return items
}

/**
 * Erzwingt einen frischen Katalog-Scan beim nächsten Aufruf. Wird nach
 * CRUD-Writes über die HTTP-API aufgerufen, damit Änderungen (auch aus
 * anderen Editor-Sessions) direkt im gleichen Container greifen.
 */
export function invalidateCatalog(): void {
  loaded = false
}

/**
 * Stellt sicher, dass der Katalog aus DDB geladen wurde. Idempotent —
 * wird bei jedem Handler-Aufruf gemacht, macht aber nur einmal pro
 * Container tatsächlich einen Scan.
 */
export async function ensureCatalogLoaded(): Promise<void> {
  if (loaded) return
  if (!QUESTIONS_TABLE) {
    // Kein Table-Name → Fallback auf inline JSON (schon aktiv seit Import).
    loaded = true
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'catalog-fallback',
        reason: 'QUESTIONS_TABLE env var not set',
      }),
    )
    return
  }
  try {
    const started = Date.now()
    const questions = await scanAllQuestions()
    if (questions.length === 0) {
      // Tabelle leer → behalte inline JSON. So funktioniert die App
      // auch vor dem ersten Upload.
      console.log(
        JSON.stringify({
          level: 'warn',
          msg: 'catalog-empty',
          reason: 'DDB questions table empty, keeping inline fallback',
        }),
      )
    } else {
      setQuestionCatalog(questions)
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'catalog-loaded',
          count: questions.length,
          durationMs: Date.now() - started,
        }),
      )
    }
    loaded = true
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'catalog-load-failed',
        err: err instanceof Error ? err.message : String(err),
      }),
    )
    // loaded bleibt false → nächster Aufruf versucht's erneut.
    // Bis der Scan durchgeht, arbeitet der Server mit dem inline JSON.
  }
}
