/**
 * Runden- und Spielabend-Struktur.
 *
 * Ein „Quizabend" besteht aus mehreren Games/Modi in beliebiger Reihenfolge.
 * Ein „Free-Play" ist ein einzelnes Game ohne Match-Kontext.
 */

import type { Question } from './question'

export type GameModeId =
  | 'warmup'
  | 'quizduell'
  | 'jeopardy'
  | 'experts'
  | 'chase'
  | 'millionaire'
  | 'true-false-speed'
  | 'wordsnippets'
  | 'sorting'
  | 'blindguess'
  | 'family-feud'
  | 'duel-1v1'
  | 'elimination'
  | 'name-three'
  | 'pantomime'

export interface GameMode {
  id: GameModeId
  name: string
  description: string
  estimatedMinutes: number
  scoresMatchPoint: boolean // trägt zum Match-Best-of-N bei?
}

export interface Team {
  id: string
  name: string
  color?: string
}

export interface GameResult {
  gameModeId: GameModeId
  scores: Record<string, number> // teamId → score
  winnerTeamId?: string
  questionsUsed: string[] // Question-IDs für Verwendungs-Tracking
}

export interface RoundConfig {
  id: string
  name: string
  date?: string
  teams: Team[]
  bestOf: number // z. B. 5 → wer zuerst ceil(5/2) = 3 gewinnt, gewinnt den Abend
  gameModes: GameModeId[] // Ablauf-Reihenfolge
}

export interface RoundState {
  config: RoundConfig
  results: GameResult[]
  matchPoints: Record<string, number> // teamId → Anzahl Matchpunkte
}

export interface Runtime {
  currentRound: RoundState | null
  freePlaySelection: {
    modeId: GameModeId
    questions: Question[]
  } | null
}
