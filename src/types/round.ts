/**
 * Runden- und Spielabend-Struktur.
 *
 * Ein „Quizabend" besteht aus mehreren Games/Modi in beliebiger Reihenfolge.
 * Ein „Free-Play" ist ein einzelnes Game ohne Match-Kontext.
 *
 * Modus-Namen: bewusst neutrale Eigenbezeichnungen, keine Referenz auf existierende
 * TV-Show-Marken (Design-Direction v1, Kapitel „Guardrails"). IDs bleiben in kebab-case.
 */

import type { Question } from './question'

export type GameModeId =
  // Aktiv im Prototyp:
  | 'category-duel'    // 12-Kategorien-Grid + Multiple Choice
  // Coming soon:
  | 'around-corner'    // Warm-up mit stufenweisen Hinweisen
  | 'category-board'   // 5×4 Board mit steigenden Punktwerten
  | 'experts'          // Fachrunde: pro Person ein Fachgebiet, Solo-Timer + Steal
  | 'sprinter'         // Zeit-Sprint: 90 s pro Team, schnelle Fragefolge
  | 'points-ladder'    // Aufsteigende Punkt-Ladder mit hohem Endgewinn
  | 'flash'            // Wahr/Falsch Speed-Round
  | 'wordsnippets'     // Songzeilen / Zitate raten
  | 'sorting'          // Reihenfolge sortieren
  | 'blindguess'       // Media-Guess (Audio/Bild/Video)
  | 'family-feud'      // Umfrage-Top-Antworten
  | 'duel-1v1'         // 1:1 Buzzer-Duell
  | 'elimination'      // Elimination-Runde
  | 'name-three'       // „Nenn drei aus Kategorie X"
  | 'pantomime'        // Activity-Style

export type ModeAccent =
  | 'duel' | 'corner' | 'board' | 'experts' | 'sprinter' | 'ladder' | 'flash'

export interface GameMode {
  id: GameModeId
  name: string              // UI-Anzeigename, deutsch
  chipLabel: string         // Kurz-Kategorie für den Header-Chip (KLASSIKER/TEMPO/…)
  tagline: string           // Ein Satz Positionierung (siehe PDF „Farben je Spielmodus")
  description: string       // Regeln kurz
  estimatedMinutes: number
  scoresMatchPoint: boolean // trägt zum Match-Best-of-N bei?
  accent: ModeAccent        // Farb-Akzent-Key (mapped auf tailwind mode.*)
  status: 'ready' | 'planned'
}

export interface Team {
  id: string
  name: string
  color: 'purple' | 'cyan'  // MVP: zwei Teams, feste Marken-Zweifarben
}

export interface GameResult {
  gameModeId: GameModeId
  scores: Record<string, number>  // teamId → score
  winnerTeamId?: string
  questionsUsed: string[]         // Question-IDs für Verwendungs-Tracking
}

export interface RoundConfig {
  id: string
  name: string
  createdAt: string           // ISO-Datum
  roomCode: string            // z. B. "4KQ7" – 4-stellig, siehe Lobby-Screen (PDF)
  teams: Team[]
  bestOf: number              // z. B. 5 → wer zuerst ceil(5/2) = 3 Matchpunkte hat, gewinnt
  gameModes: GameModeId[]     // Ablauf-Reihenfolge
}

export interface RoundState {
  config: RoundConfig
  results: GameResult[]
  matchPoints: Record<string, number>  // teamId → Anzahl Matchpunkte
}

export interface Runtime {
  currentRound: RoundState | null
  freePlaySelection: {
    modeId: GameModeId
    questions: Question[]
  } | null
}
