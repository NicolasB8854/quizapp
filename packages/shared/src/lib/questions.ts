/**
 * Fragen-Zugriff mit Typ-Sicherheit + Filter- und Auswahl-Helfern.
 *
 * Kein Backend nötig — Katalog kommt aus JSON und wird beim Import einmal geladen und
 * gecacht. Ab einem Backend-Schritt wandert `getQuestionsByTopic` gegen die generierte
 * API.
 *
 * Session E hat den gewichteten Bucket-Ansatz für die Blitzrunde eingeführt
 * (shared / individual / wildcard, 60/30/10). Session H legt darüber die Difficulty-
 * Präferenz per Skill-Level: `nerd` bekommt schwerere Fragen, `bisschen` leichtere.
 */

import rawQuestions from '../data/questions.json'
import type {
  Difficulty,
  MultipleChoiceQuestion,
  Question,
  Topic,
  TrueFalseQuestion,
  WarmupRiddleQuestion,
} from '../types/question'
import type { SkillLevel } from '../types/round'
import { normalizeTag, type InterestProfile } from './interestProfile'

// JSON-Import ist untypisiert — hier einmal narrowen. `let` statt `const`,
// damit der Server zur Laufzeit den Katalog aus DynamoDB nachladen kann
// (siehe `setQuestionCatalog`). Frontend nutzt weiter den Default aus JSON.
let ALL_QUESTIONS: Question[] = rawQuestions as unknown as Question[]

export function getAllQuestions(): Question[] {
  return ALL_QUESTIONS
}

/**
 * Ersetzt den globalen Fragenkatalog zur Laufzeit.
 *
 * Wird vom Lambda-Handler beim Cold-Start aufgerufen, nachdem er die
 * Fragen aus DDB gescannt hat. Frontend ruft es typischerweise nicht auf
 * — der Bundle-Import mit `rawQuestions` liefert dort schon alles.
 *
 * Idempotent: kann bei jedem Handler-Aufruf sicher aufgerufen werden
 * (macht Sinn: der Handler verifiziert den Cache-Status).
 */
export function setQuestionCatalog(questions: Question[]): void {
  ALL_QUESTIONS = questions
}

/**
 * Liefert alle im Katalog gepflegten Tags gruppiert nach Topic (Session AA).
 *
 * Wird für die Interessen-Auto-Complete genutzt: wenn der Nutzer im Roster
 * Sub-Interessen für ein Topic angibt, schlagen wir die Tags aus dem Fragen-
 * Katalog vor, damit die Personalisierung später matchen kann.
 *
 * Reihenfolge: nach Häufigkeit absteigend, dann alphabetisch. So kommen die
 * relevantesten Tags zuerst.
 */
export function getCatalogTagsByTopic(): Partial<Record<Topic, string[]>> {
  const counts = new Map<string, Map<string, number>>()
  for (const q of ALL_QUESTIONS) {
    if (!q.tags || q.tags.length === 0) continue
    let topicMap = counts.get(q.topic)
    if (!topicMap) {
      topicMap = new Map<string, number>()
      counts.set(q.topic, topicMap)
    }
    for (const tag of q.tags) {
      if (!tag) continue
      topicMap.set(tag, (topicMap.get(tag) ?? 0) + 1)
    }
  }
  const out: Partial<Record<Topic, string[]>> = {}
  for (const [topic, map] of counts) {
    out[topic as Topic] = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
  }
  return out
}

export function getMultipleChoiceByTopic(topic: Topic): MultipleChoiceQuestion[] {
  return ALL_QUESTIONS.filter(
    (q): q is MultipleChoiceQuestion => q.type === 'multiple-choice' && q.topic === topic,
  )
}

export function getAllMultipleChoice(): MultipleChoiceQuestion[] {
  return ALL_QUESTIONS.filter(
    (q): q is MultipleChoiceQuestion => q.type === 'multiple-choice',
  )
}

/**
 * Zieht die nächste ungenutzte Multiple-Choice-Frage aus dem gesamten Pool.
 *
 * Für Modi, die Fragen quer durch alle Topics jagen (Sprinter, Alles-oder-Nichts).
 * Optional mit `preferredLevel` für Difficulty-Match — analog zu `pickQuestion`.
 */
export function pickAnyMultipleChoice(
  usedIds: ReadonlySet<string>,
  preferredLevel?: SkillLevel,
  preferredTags?: readonly string[],
): MultipleChoiceQuestion | null {
  const pool = getAllMultipleChoice()
  if (pool.length === 0) return null
  const fresh = pool.filter((q) => !usedIds.has(q.id))
  const candidates = fresh.length > 0 ? fresh : pool

  const tagSet = buildPreferredTagSet(preferredTags)
  if (!preferredLevel && !tagSet) {
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
  return pickByDifficulty(
    candidates,
    () => preferredLevel,
    tagSet ? (q) => questionMatchesTags(q, tagSet) : undefined,
  )
}

// ---------- Interest-Tag-Bonus (Session AB) ----------------------------------

/**
 * Multiplikator, den eine Frage bekommt, wenn ihr Tag-Set mit den vom Spieler
 * gepflegten Sub-Interessen überlappt. Weicher Bonus (kein harter Filter) —
 * Non-Match-Fragen bleiben ziehbar, tauchen aber seltener auf.
 *
 * Werte-Empfehlung:
 *   • 1  → deaktiviert
 *   • 3  → mildes Priming
 *   • 5  → deutliches Priming (aktuell)
 *   • 10 → aggressives Priming; Katalog droht monokulturell zu werden
 */
export const TAG_MATCH_BONUS = 5

/**
 * Baut aus einer Tag-Liste die case-insensitive Menge für Match-Checks. Gibt
 * `undefined` zurück, wenn die Eingabe leer ist (Vereinfacht die Aufrufer:
 * `if (!tagSet)` als Deaktivierungs-Signal).
 */
function buildPreferredTagSet(
  tags?: readonly string[],
): ReadonlySet<string> | undefined {
  if (!tags || tags.length === 0) return undefined
  const set = new Set<string>()
  for (const t of tags) {
    const n = normalizeTag(t)
    if (n) set.add(n)
  }
  return set.size > 0 ? set : undefined
}

/**
 * Prüft, ob eine Frage mindestens einen Tag mit der Vorzugs-Menge teilt.
 * Vergleich case-insensitive; Fragen ohne `tags`-Array matchen nie.
 */
function questionMatchesTags(
  q: { tags?: readonly string[] },
  preferred: ReadonlySet<string>,
): boolean {
  if (!q.tags || q.tags.length === 0) return false
  for (const t of q.tags) {
    if (preferred.has(normalizeTag(t))) return true
  }
  return false
}

// ---------- Difficulty-Präferenz (Session H, numerisch in Session X) ---------

/**
 * Gewichtung der Difficulty-Stufen (1-5) je Selbsteinschätzung (SkillLevel 1-5).
 *
 * Diagonale = Peak: SkillLevel N bevorzugt Difficulty N. Aber flach genug, dass
 * Fragen +/- 1 Stufe auch regelmäßig fallen — kein hartes Cut-off. Werte sind
 * Prozente pro SkillLevel-Zeile (Summe 100).
 *
 * Bestehende Semantik bleibt erhalten:
 *   SkillLevel 2 („bisschen") bevorzugt Difficulty 2 (die alten „leicht"-Fragen)
 *   SkillLevel 3 („gut")      bevorzugt Difficulty 3 („mittel")
 *   SkillLevel 5 („nerd")     bevorzugt Difficulty 4-5 („schwer" + „experten")
 */
export const DIFFICULTY_WEIGHTS: Record<SkillLevel, Record<Difficulty, number>> = {
  1: { 1: 70, 2: 25, 3:  5, 4:  0, 5:  0 },
  2: { 1: 20, 2: 60, 3: 15, 4:  5, 5:  0 },
  3: { 1:  5, 2: 20, 3: 50, 4: 20, 5:  5 },
  4: { 1:  0, 2:  5, 3: 20, 4: 50, 5: 25 },
  5: { 1:  0, 2:  5, 3: 10, 4: 45, 5: 40 },
}

/**
 * Gewichtete Zufallswahl aus einer Liste von Fragen mit passender Difficulty für ein
 * (optional pro Frage variierendes) Skill-Level.
 *
 * `getLevel` liefert das Level pro Item; wenn `undefined`, wird die Frage neutral mit
 * Gewicht 1 behandelt. Fragen ohne `difficulty` (z. B. Warmup-Rätsel) bekommen ebenfalls
 * Gewicht 1. Ist die Summe aller Gewichte 0, gibt es uniformen Fallback über die Items.
 */
export function pickByDifficulty<Q extends { difficulty?: Difficulty }>(
  items: readonly Q[],
  getLevel: (item: Q) => SkillLevel | undefined,
  matchesTag?: (item: Q) => boolean,
): Q | null {
  if (items.length === 0) return null
  const weights = items.map((q) => {
    const level = getLevel(q)
    let w = 1
    if (level && q.difficulty) {
      w = DIFFICULTY_WEIGHTS[level][q.difficulty] ?? 0
    }
    if (matchesTag && matchesTag(q)) {
      w *= TAG_MATCH_BONUS
    }
    return w
  })
  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) {
    return items[Math.floor(Math.random() * items.length)]
  }
  const r = Math.random() * total
  let acc = 0
  for (let i = 0; i < items.length; i++) {
    acc += weights[i]
    if (r < acc) return items[i]
  }
  return items[items.length - 1]
}

// ---------- Multiple-Choice-Fragen -------------------------------------------

/**
 * Zieht per Zufall die nächste ungenutzte Frage zu einem Topic.
 *
 * Mit `preferredLevel`: gewichtete Wahl nach Difficulty (`bisschen` → tendenziell
 * leichte Fragen, `nerd` → tendenziell schwere). Ohne Level: uniform.
 *
 * Fallback-Kaskade:
 *   1. Nicht-verbrauchte Frage (mit Difficulty-Match, falls Level gesetzt)
 *   2. Falls alle Fragen verbraucht: kompletter Pool, gleiche Regel für Difficulty.
 */
export function pickQuestion(
  topic: Topic,
  usedIds: ReadonlySet<string>,
  preferredLevel?: SkillLevel,
  preferredTags?: readonly string[],
): MultipleChoiceQuestion | null {
  const pool = getMultipleChoiceByTopic(topic)
  if (pool.length === 0) return null
  const fresh = pool.filter((q) => !usedIds.has(q.id))
  const candidates = fresh.length > 0 ? fresh : pool

  const tagSet = buildPreferredTagSet(preferredTags)
  if (!preferredLevel && !tagSet) {
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
  return pickByDifficulty(
    candidates,
    () => preferredLevel,
    tagSet ? (q) => questionMatchesTags(q, tagSet) : undefined,
  )
}

// ---------- True-False (Blitzrunde) ------------------------------------------

export function getTrueFalsePool(): TrueFalseQuestion[] {
  return ALL_QUESTIONS.filter((q): q is TrueFalseQuestion => q.type === 'true-false')
}

/**
 * Gewichtete Buckets für die Blitzrunde: 60% shared, 30% individual, 10% wildcard.
 * Kurzform der 30/30/25/15-Formel aus konzept-v2.md, Kapitel 6.
 */
const FLASH_WEIGHTS = { shared: 60, individual: 30, wildcard: 10 } as const

/**
 * Zieht die nächste ungenutzte True-False-Behauptung.
 *
 * Ohne `profile` (oder mit leerem Profile): uniforme Auswahl aus dem Pool.
 *
 * Mit `profile`: zweistufig gewichtete Wahl.
 *   1. Bucket-Wahl (shared / individual / wildcard) mit den FLASH_WEIGHTS.
 *   2. Innerhalb des Buckets: Difficulty-Match per `profile.levelPerTopic` (Session H).
 *      In der wildcard-Bucket gibt es kein Ziel-Level → uniform.
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

  const nonEmpty = [
    { key: 'shared' as const, weight: FLASH_WEIGHTS.shared, items: sharedItems },
    { key: 'individual' as const, weight: FLASH_WEIGHTS.individual, items: individualItems },
    { key: 'wildcard' as const, weight: FLASH_WEIGHTS.wildcard, items: wildcardItems },
  ].filter((b) => b.items.length > 0 && b.weight > 0)

  if (nonEmpty.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)]
  }

  const total = nonEmpty.reduce((s, b) => s + b.weight, 0)
  const r = Math.random() * total
  let acc = 0
  let chosen = nonEmpty[nonEmpty.length - 1]
  for (const bucket of nonEmpty) {
    acc += bucket.weight
    if (r < acc) {
      chosen = bucket
      break
    }
  }

  // Innerhalb des Buckets: Difficulty-Match, außer für Wildcards (unbekanntes Level).
  const getLevel = chosen.key === 'wildcard'
    ? (() => undefined)
    : ((q: TrueFalseQuestion) => profile.levelPerTopic.get(q.topic))
  // Tag-Bonus greift überall dort, wo der Spieler Sub-Interessen für das
  // Frage-Topic gepflegt hat. Wildcards kennen keine Tags → matcht nie.
  const matchesTag = (q: TrueFalseQuestion) => {
    const topicTags = profile.tagsPerTopic?.get(q.topic)
    if (!topicTags || topicTags.size === 0) return false
    return questionMatchesTags(q, topicTags)
  }
  return pickByDifficulty(chosen.items, getLevel, matchesTag)
}

// ---------- Klick! / Warm-Up-Rätsel ------------------------------------------

export function getWarmupRiddlePool(): WarmupRiddleQuestion[] {
  return ALL_QUESTIONS.filter(
    (q): q is WarmupRiddleQuestion => q.type === 'warmup-riddle',
  )
}

/**
 * Zieht das nächste ungenutzte Warm-Up-Rätsel. Kein Topic- oder Difficulty-Filter —
 * Klick! ist bewusst breit und kollaborativ.
 */
export function pickWarmupRiddle(
  usedIds: ReadonlySet<string>,
): WarmupRiddleQuestion | null {
  const pool = getWarmupRiddlePool()
  if (pool.length === 0) return null
  const fresh = pool.filter((q) => !usedIds.has(q.id))
  const candidates = fresh.length > 0 ? fresh : pool
  return candidates[Math.floor(Math.random() * candidates.length)]
}
