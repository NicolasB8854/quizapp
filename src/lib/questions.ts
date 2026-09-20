/**
 * Fragen-Zugriff mit Typ-Sicherheit + einfachen Filterhelfern.
 *
 * Kein Backend nötig — Katalog kommt aus JSON und wird beim Import einmal geladen und
 * gecacht. Für den Prototyp reicht das; ab Amplify wird `getQuestionsByTopic` gegen die
 * generierte GraphQL-API ausgetauscht.
 */

import rawQuestions from '@/data/questions.json'
import type {
  MultipleChoiceQuestion,
  Question,
  Topic,
  TrueFalseQuestion,
} from '@/types/question'
import type { InterestProfile } from './interestProfile'

// JSON-Import ist untypisiert — hier einmal narrowen.
const ALL_QUESTIONS = rawQuestions as unknown as Question[]

export function getAllQuestions(): Question[] {
  return ALL_QUESTIONS
}

export function getMultipleChoiceByTopic(topic: Topic): MultipleChoiceQuestion[] {
  return ALL_QUESTIONS.filter(
    (q): q is MultipleChoiceQuestion => q.type === 'multiple-choice' && q.topic === topic,
  )
}

/**
 * Zieht per Zufall die nächste ungenutzte Frage zu einem Topic. Falls alle bereits
 * verwendet wurden, greift die Funktion auf den kompletten Pool zurück.
 */
export function pickQuestion(
  topic: Topic,
  usedIds: ReadonlySet<string>,
): MultipleChoiceQuestion | null {
  const pool = getMultipleChoiceByTopic(topic)
  if (pool.length === 0) return null
  const fresh = pool.filter((q) => !usedIds.has(q.id))
  const candidates = fresh.length > 0 ? fresh : pool
  return candidates[Math.floor(Math.random() * candidates.length)]
}

// ---------- Blitzrunde: True-False ---------------------------------------------

export function getTrueFalsePool(): TrueFalseQuestion[] {
  return ALL_QUESTIONS.filter((q): q is TrueFalseQuestion => q.type === 'true-false')
}

/**
 * Gewichtete Buckets (Session E): 60% shared, 30% individual, 10% wildcard.
 *
 * Diese Verteilung ist die pragmatische Kurzform der 30/30/25/15-Formel aus
 * konzept-v2.md, Kapitel 6. Ohne dedizierte „general vs. shared-interest"-
 * Klassifizierung in der DB kollabieren wir general in wildcard und heben shared
 * gegenüber individual an, damit gemeinsame Themen die Runde tragen.
 */
const FLASH_WEIGHTS = { shared: 60, individual: 30, wildcard: 10 } as const

/**
 * Zieht die nächste ungenutzte True-False-Behauptung.
 *
 * Ohne `profile` (oder mit leerem Profile): uniforme Auswahl aus dem Pool.
 *
 * Mit `profile`: gewichtete Wahl über drei Töpfe (shared / individual / wildcard).
 * Leere Töpfe fallen weg, das verbleibende Gewicht wird proportional verteilt.
 *
 * Duplicate-Check: wird bevorzugt eingehalten. Wenn nach Ausschluss der `usedIds`
 * gar nichts mehr übrig bleibt, greift der volle Pool als Fallback.
 */
export function pickTrueFalse(
  usedIds: ReadonlySet<string>,
  profile?: InterestProfile,
): TrueFalseQuestion | null {
  const fullPool = getTrueFalsePool()
  if (fullPool.length === 0) return null

  const fresh = fullPool.filter((q) => !usedIds.has(q.id))
  const pool = fresh.length > 0 ? fresh : fullPool

  const hasProfile =
    profile !== undefined &&
    (profile.shared.size > 0 || profile.individual.size > 0)

  if (!hasProfile) {
    return pool[Math.floor(Math.random() * pool.length)]
  }

  const sharedItems = pool.filter((q) => profile.shared.has(q.topic))
  const individualItems = pool.filter((q) => profile.individual.has(q.topic))
  const wildcardItems = pool.filter(
    (q) => !profile.shared.has(q.topic) && !profile.individual.has(q.topic),
  )

  const picked = pickWeighted([
    { weight: FLASH_WEIGHTS.shared, items: sharedItems },
    { weight: FLASH_WEIGHTS.individual, items: individualItems },
    { weight: FLASH_WEIGHTS.wildcard, items: wildcardItems },
  ])
  return picked ?? pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Gewichtete Zufallsauswahl über mehrere Töpfe. Leere Töpfe werden ignoriert und ihr
 * Gewicht verfällt (bzw. entfällt aus der Summe). Innerhalb eines Topfes uniforme
 * Auswahl.
 */
function pickWeighted<T>(
  buckets: readonly { weight: number; items: readonly T[] }[],
): T | null {
  const nonEmpty = buckets.filter((b) => b.items.length > 0 && b.weight > 0)
  if (nonEmpty.length === 0) return null
  const total = nonEmpty.reduce((s, b) => s + b.weight, 0)
  const r = Math.random() * total
  let acc = 0
  for (const bucket of nonEmpty) {
    acc += bucket.weight
    if (r < acc) {
      return bucket.items[Math.floor(Math.random() * bucket.items.length)]
    }
  }
  // Numerische Sicherheitsnetzknote — Math.random kann in seltenen Fällen r = total-eps
  // liefern; wir fallen dann auf den letzten Bucket zurück.
  const last = nonEmpty[nonEmpty.length - 1]
  return last.items[Math.floor(Math.random() * last.items.length)]
}
