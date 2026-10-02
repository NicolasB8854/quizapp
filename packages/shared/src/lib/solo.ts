/**
 * Solo-Runde: eine Person spielt allein gegen die Uhr.
 *
 * Zehn Multiple-Choice-Fragen mit fester Kurve 1,1,2,2,3,3,4,4,5,5 — Punkte
 * = Stufe × 100. Optional auf eine Themenauswahl beschränkt; fehlt eine Stufe
 * im gewählten Pool, greift die Nachbarstufe (siehe `pickByTargetDifficulty`).
 */
import type { Difficulty, MultipleChoiceQuestion, Topic } from '../types/question'
import { pickByTargetDifficulty } from './questions'

export const SOLO_CURVE: readonly Difficulty[] = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
export const SOLO_SECONDS_PER_QUESTION = 20

export function soloPointsFor(difficulty: Difficulty): number {
  return difficulty * 100
}

/**
 * Baut die Fragenfolge. `topics` leer/undefined = alle Themen. Bei mehreren
 * Themen rotiert die Auswahl, damit nicht alle Fragen aus einem Thema kommen.
 */
export function buildSoloRun(
  topics: readonly Topic[] | undefined,
  usedIds: ReadonlySet<string> = new Set(),
): MultipleChoiceQuestion[] {
  const used = new Set(usedIds)
  const run: MultipleChoiceQuestion[] = []
  const pool = topics && topics.length > 0 ? [...topics] : undefined
  SOLO_CURVE.forEach((difficulty, i) => {
    const topic = pool ? pool[i % pool.length] : undefined
    const q =
      pickByTargetDifficulty(used, difficulty, topic) ??
      (topic ? pickByTargetDifficulty(used, difficulty) : null)
    if (q && !used.has(q.id)) {
      run.push(q)
      used.add(q.id)
    }
  })
  return run
}
