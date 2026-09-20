/**
 * Runden- und Spielabend-Struktur.
 *
 * Ein „Quizabend" besteht aus mehreren Games/Modi in beliebiger Reihenfolge.
 * Ein „Free-Play" ist ein einzelnes Game ohne Match-Kontext.
 *
 * Modus-Namen: bewusst neutrale Eigenbezeichnungen, keine Referenz auf existierende
 * TV-Show-Marken (Design-Direction v1, Kapitel „Guardrails"). IDs bleiben in kebab-case.
 */

import type { Question, Topic } from './question'

export type GameModeId =
  // Aktiv im Prototyp:
  | 'category-duel'    // 12-Kategorien-Grid + Multiple Choice
  | 'flash'            // Wahr/Falsch Speed-Round
  | 'player-spotlight' // „Heimspiel" — Frage aus Spieler-Interessen, Steal bei Fehler
  // Coming soon:
  | 'around-corner'    // Warm-up mit stufenweisen Hinweisen
  | 'category-board'   // 5×4 Board mit steigenden Punktwerten
  | 'experts'          // Fachrunde: pro Person ein Fachgebiet, Solo-Timer + Steal
  | 'sprinter'         // Zeit-Sprint: 90 s pro Team, schnelle Fragefolge
  | 'points-ladder'    // Aufsteigende Punkt-Ladder mit hohem Endgewinn
  | 'wordsnippets'     // Songzeilen / Zitate raten
  | 'sorting'          // Reihenfolge sortieren
  | 'blindguess'       // Media-Guess (Audio/Bild/Video)
  | 'family-feud'      // Umfrage-Top-Antworten
  | 'duel-1v1'         // 1:1 Buzzer-Duell
  | 'elimination'      // Elimination-Runde
  | 'name-three'       // „Nenn drei aus Kategorie X"
  | 'pantomime'        // Activity-Style

export type ModeAccent =
  | 'duel' | 'corner' | 'board' | 'experts' | 'sprinter' | 'ladder' | 'flash' | 'spotlight'

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

/**
 * Selbsteinschätzung pro Interesse (siehe konzept-v2.md, Kapitel 2c „bisschen / gut / Nerd").
 *
 * Beeinflusst später die Fragen-Schwierigkeit für dieses Topic. In Session E dient sie
 * primär als Signal im UI und in `computeInterestProfile`; der Difficulty-Match folgt
 * in einer Folgestufe.
 */
export type SkillLevel = 'bisschen' | 'gut' | 'nerd'

/** Ein einzelnes Spieler-Interesse mit Selbsteinschätzung. */
export interface PlayerInterest {
  topic: Topic
  level: SkillLevel
}

/**
 * Visuelle Spieler-Identität: ein Emoji-Symbol (universell, kein Gesicht)
 * plus eine Farbe aus einer festen Palette. Bewusst simpel — kein SVG-Avatar-
 * Editor, sondern kombinierbare Grundbausteine.
 */
export interface Avatar {
  emoji: string
  colorHex: string
}

/**
 * Spieler-Entität für die Personalisierung (siehe konzept-v2.md, Kapitel 2c und 8).
 *
 * Zuordnung zu einem Team über `teamId`. `name` kann leer sein — die UI zeigt dann
 * einen Platzhalter („Spieler 1"). `interests` sind die selbstgewählten Topics mit
 * ihrer Selbsteinschätzung; leere Liste = keine Präferenz.
 */
export interface Player {
  id: string
  name: string
  teamId: string
  interests: PlayerInterest[]
  avatar: Avatar
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
  /**
   * Spielerprofile (siehe konzept-v2.md, Kapitel 8). In der Lobby wählt jeder Spieler
   * seine Interessen. `round.interests` wird daraus aggregiert (Union aller
   * player.interests) und ist die Datenquelle für den Quiz Director.
   */
  players: Player[]
  /**
   * Aggregiertes Personalisierungs-Signal (siehe konzept-v2.md, Kapitel 6 „Quiz Director").
   * Union aller `players[i].interests`. Leeres Array = kein Filter, alle Topics gleich
   * gewichtet. Wird vom Reducer bei Player-Änderungen neu berechnet.
   */
  interests: Topic[]
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
