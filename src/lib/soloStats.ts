/**
 * Lokale Solo-Statistik (localStorage). Grundlage für Titel und Dashboard (#22):
 * pro Thema beantwortete/richtige Fragen, Bestwert, Anzahl Runden, Serie.
 */
import type { Topic } from '@quizapp/shared'

const STORAGE_KEY = 'quizapp:soloStats'

export interface TopicStat {
  answered: number
  correct: number
}

export interface SoloStats {
  runs: number
  bestScore: number
  totalScore: number
  perTopic: Partial<Record<Topic, TopicStat>>
  /** ISO-Datum (YYYY-MM-DD) der letzten Runde — für Tages-Serien. */
  lastPlayedDay: string | null
  /** Aufeinanderfolgende Tage mit mindestens einer Runde. */
  streakDays: number
  /** Gespielte / gewonnene Spieleabende auf diesem Gerät. */
  nightsPlayed: number
  nightsWon: number
  /** Schlüssel bereits gezählter Spieleabende (verhindert Doppelzählung bei Reconnect). */
  countedNights: string[]
}

export const EMPTY_STATS: SoloStats = {
  runs: 0,
  bestScore: 0,
  totalScore: 0,
  perTopic: {},
  lastPlayedDay: null,
  streakDays: 0,
  nightsPlayed: 0,
  nightsWon: 0,
  countedNights: [],
}

export function readSoloStats(): SoloStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_STATS, perTopic: {} }
    const parsed = JSON.parse(raw) as Partial<SoloStats>
    return {
      ...EMPTY_STATS,
      ...parsed,
      perTopic: { ...(parsed.perTopic ?? {}) },
      countedNights: [...(parsed.countedNights ?? [])],
    }
  } catch {
    return { ...EMPTY_STATS, perTopic: {} }
  }
}

function writeStats(stats: SoloStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // Silent.
  }
}

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Rechnet eine abgeschlossene Runde in die Statistik ein (pure, testbar). */
export function applySoloRun(
  stats: SoloStats,
  answers: ReadonlyArray<{ topic: Topic; correct: boolean }>,
  score: number,
  now: Date = new Date(),
): SoloStats {
  const perTopic: SoloStats['perTopic'] = { ...stats.perTopic }
  for (const a of answers) {
    const prev = perTopic[a.topic] ?? { answered: 0, correct: 0 }
    perTopic[a.topic] = { answered: prev.answered + 1, correct: prev.correct + (a.correct ? 1 : 0) }
  }
  const today = dayString(now)
  const yesterday = dayString(new Date(now.getTime() - 86_400_000))
  const streakDays =
    stats.lastPlayedDay === today
      ? stats.streakDays
      : stats.lastPlayedDay === yesterday
        ? stats.streakDays + 1
        : 1
  return {
    ...stats,
    runs: stats.runs + 1,
    bestScore: Math.max(stats.bestScore, score),
    totalScore: stats.totalScore + score,
    perTopic,
    lastPlayedDay: today,
    streakDays,
  }
}

export function saveSoloRun(
  answers: ReadonlyArray<{ topic: Topic; correct: boolean }>,
  score: number,
): SoloStats {
  const next = applySoloRun(readSoloStats(), answers, score)
  writeStats(next)
  return next
}

/** Spieleabend einrechnen (pure). Gleicher `key` zählt nur einmal. */
export function applyNight(stats: SoloStats, key: string, won: boolean, now: Date = new Date()): SoloStats {
  if (stats.countedNights.includes(key)) return stats
  const today = dayString(now)
  const yesterday = dayString(new Date(now.getTime() - 86_400_000))
  return {
    ...stats,
    nightsPlayed: stats.nightsPlayed + 1,
    nightsWon: stats.nightsWon + (won ? 1 : 0),
    countedNights: [...stats.countedNights, key].slice(-50),
    lastPlayedDay: today,
    streakDays:
      stats.lastPlayedDay === today ? stats.streakDays : stats.lastPlayedDay === yesterday ? stats.streakDays + 1 : 1,
  }
}

export function saveNight(key: string, won: boolean): SoloStats {
  const next = applyNight(readSoloStats(), key, won)
  writeStats(next)
  return next
}

/** Antworten aus einem Spieleabend ins Themen-Profil einrechnen. */
export function saveNightAnswers(answers: ReadonlyArray<{ topic: Topic; correct: boolean }>): SoloStats {
  const current = readSoloStats()
  const perTopic: SoloStats['perTopic'] = { ...current.perTopic }
  for (const a of answers) {
    const prev = perTopic[a.topic] ?? { answered: 0, correct: 0 }
    perTopic[a.topic] = { answered: prev.answered + 1, correct: prev.correct + (a.correct ? 1 : 0) }
  }
  const next = { ...current, perTopic }
  writeStats(next)
  return next
}
