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

/**
 * Team-Farben aus der Design-Palette. Vier Farben sind das Maximum, weil vier
 * Teams die Konzept-Obergrenze sind (siehe konzept-v2.md, „2–4 pro Team").
 */
export type TeamColor = 'purple' | 'cyan' | 'orange' | 'pink'

export interface Team {
  id: string
  name: string
  color: TeamColor
}

/**
 * Selbsteinschätzung pro Interesse (Session X: numerisches Format 1-5).
 *
 * Skala orientiert sich an `Difficulty` (siehe `@/types/question`). Die UI nutzt
 * aktuell 3 Werte (bisschen=2, gut=3, nerd=5), das interne Modell erlaubt aber
 * schon 1-5, damit spätere Ergänzungen (z. B. „profi=4") nichts brechen.
 *
 *   1 · fast keine Ahnung       (selten in UI angezeigt)
 *   2 · bisschen                 (default „Einstieg")
 *   3 · gut                      (default „solide")
 *   4 · sehr gut                (Reserve)
 *   5 · nerd / expert            (Spezialwissen)
 *
 * Ein niedriger SkillLevel spielt tendenziell einfachere Fragen aus dem
 * gleichen Topic, ein hoher SkillLevel schwerere (siehe DIFFICULTY_WEIGHTS).
 */
export type SkillLevel = 1 | 2 | 3 | 4 | 5

/**
 * Ein einzelnes Spieler-Interesse mit Selbsteinschätzung.
 *
 * `tags` sind optionale Sub-Interessen (Session AA): der Spieler darf pro Topic
 * beliebig viele Feinkategorien angeben (z. B. Topic „sport" + Tags
 * `['Fußball', 'Basketball', 'Formel 1']`). Freier Text, gepflegt via Auto-
 * Complete aus vordefinierten Vorschlägen und Katalog-Tags.
 */
export interface PlayerInterest {
  topic: Topic
  level: SkillLevel
  tags?: string[]
}

/**
 * Visuelle Spieler-Identität (Session T).
 *
 * Wir favorisieren echte Portrait-Fotos: der Master lädt pro Spieler ein Bild
 * aus dem Filesystem, wir speichern es downscaled als DataURL. Ohne Foto zeigt
 * der Avatar einen farbigen Kreis mit Namens-Initiale (die Farbe kommt aus einer
 * festen Palette, siehe `AVATAR_COLORS`).
 *
 * `photoDataUrl` = `null` → Initial-Fallback. Der Farb-Kreis wird auch als
 * Rahmen unter dem Foto genutzt (Team-Identifikation + Personalfarbe).
 */
export interface Avatar {
  colorHex: string
  photoDataUrl: string | null
}

/**
 * Spieler-Entität für die Personalisierung (siehe konzept-v2.md, Kapitel 2c und 8).
 *
 * `teamId` ist optional (`null` = im Wartebereich/Pool): der neue Roster-Flow
 * (Session S) erstellt Player erst ohne Team; die Zuordnung passiert per
 * Shuffle oder Drag-and-Drop nach der Interessen-Erfassung. Beim Start eines
 * Spiels muss jeder Player einem Team zugeordnet sein (Reducer-Guard).
 *
 * `name` kann leer sein — die UI zeigt dann einen Platzhalter („Spieler 1").
 * `interests` sind die selbstgewählten Topics mit ihrer Selbsteinschätzung;
 * leere Liste = keine Präferenz.
 */
export interface Player {
  id: string
  name: string
  teamId: string | null
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
