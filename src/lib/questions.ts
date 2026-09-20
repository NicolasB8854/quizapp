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
 * Zieht die nächste ungenutzte True-False-Behauptung.
 *
 * Optionaler `allowedTopics`-Filter für die Personalisierung: Fragen werden zuerst aus
 * den bevorzugten Topics gezogen. Fallback-Kaskade:
 *  1. Nicht-verbrauchte Frage aus den Interessen  ← Best-Case
 *  2. Nicht-verbrauchte Frage aus dem gesamten Pool (Topic-Filter aufweichen)
 *  3. Beliebige Frage aus dem Pool (Duplicate-Check aufweichen)
 *
 * Damit halten kurze Interessen-Listen die Blitzrunde nicht künstlich klein.
 */
export function pickTrueFalse(
  usedIds: ReadonlySet<string>,
  allowedTopics?: readonly Topic[],
): TrueFalseQuestion | null {
  const pool = getTrueFalsePool()
  if (pool.length === 0) return null

  const hasFilter = allowedTopics !== undefined && allowedTopics.length > 0
  if (hasFilter) {
    const topicSet = new Set(allowedTopics)
    const inTopics = pool.filter((q) => topicSet.has(q.topic))
    const freshInTopics = inTopics.filter((q) => !usedIds.has(q.id))
    if (freshInTopics.length > 0) {
      return freshInTopics[Math.floor(Math.random() * freshInTopics.length)]
    }
    // Interessen im Pool sind entweder leer oder erschöpft — weiche Topic-Filter auf.
  }

  const fresh = pool.filter((q) => !usedIds.has(q.id))
  const candidates = fresh.length > 0 ? fresh : pool
  return candidates[Math.floor(Math.random() * candidates.length)]
}
