/**
 * Fragen-Schema für alle Modi.
 *
 * Design-Prinzipien (siehe konzept-v2.md, Kapitel 6 & 7):
 * - Multiple-Choice-Optionen als Array, damit bei Bedarf 2/3/4 Optionen unterstützt werden.
 * - `correctIndex` referenziert die richtige Option (0-basiert). App shufflet die Optionen
 *   beim Rendern, damit ABCD-Balance keine Rolle spielt (Learning aus Runde 6).
 * - `hints[]` für Warm-up-Rätsel (stufenweises Aufdecken).
 * - `gmNote` = **interne** Vorbereitungshinweise für den Quizmaster (nicht öffentlich).
 * - `explanation` = **öffentliche** Auflösung, wird nach Antwort im UI gezeigt.
 *   Erfüllt Prinzip „Erklärung statt nur Lösung". Wenn nicht gesetzt, kann das UI auf
 *   `gmNote` zurückfallen (Bestand aus v1).
 * - `personalizationFit` steuert, wie der Quiz Director die Frage einordnet
 *   (Allgemeinwissen / Common Ground / Expertenmoment / Wildcard).
 * - `timeReference` deckt Zeitbezug ab: `isTimeSensitive` + `referenceDate` bleiben aus v1,
 *   neu sind `verifiedAt` (Faktencheck-Datum) und `validUntil` (Verfallsdatum für Popkultur).
 * - `source` = URL oder Referenz, damit Fakten prüfbar sind.
 * - `usedInRounds[]` für Duplicate-Check gegen Vorrunden.
 */

export type Difficulty = 'leicht' | 'mittel' | 'schwer' | 'experten'

export type QuestionType = 'multiple-choice' | 'open' | 'true-false' | 'warmup-riddle'

export type Category =
  | 'popkultur'
  | 'allgemeinbildung'
  | 'alltag-lifestyle'
  | 'spezialgebiet'
  | 'kurioses'

/**
 * Wie eine Frage in den personalisierten Abend einsortiert wird.
 * Startpunkt-Verteilung (siehe konzept-v2.md, Kapitel 6):
 *   ~30 % general, ~30 % shared-interest, ~25 % expert, ~15 % wildcard
 */
export type PersonalizationFit =
  | 'general'          // Allgemeinwissen, sitzt bei allen
  | 'shared-interest'  // gemeinsames Interesse mehrerer Spieler
  | 'expert'           // Expertenfrage für einen einzelnen Spieler
  | 'wildcard'         // Überraschung / Out-of-Element

/**
 * Feinkategorien für das Themen-Battle-Grid (12 Kacheln).
 * Jede Frage verweist über `topic` auf genau eine Feinkategorie.
 */
export type Topic =
  | 'film'
  | 'serien'
  | 'musik'
  | 'games'
  | 'geografie'
  | 'geschichte'
  | 'wissenschaft'
  | 'sport'
  | 'essen'
  | 'technik'
  | 'sprache'
  | 'kurioses'

export interface BaseQuestion {
  id: string
  type: QuestionType
  category: Category
  topic: Topic
  subCategory?: string
  difficulty: Difficulty
  question: string
  /** Interne Vorbereitungsnotiz für den Quizmaster (nicht öffentlich). */
  gmNote?: string
  /**
   * Öffentliche Auflösungserklärung, wird nach Antwort im UI gezeigt.
   * Wenn leer, fällt das UI auf `gmNote` zurück (Bestandsdaten aus v1).
   */
  explanation?: string
  /** Wie die Frage vom Quiz Director eingeordnet wird. */
  personalizationFit?: PersonalizationFit
  source?: string
  timeReference?: {
    isTimeSensitive: boolean
    /** Referenzdatum in der Formulierung (z. B. „Stand 2025"). */
    referenceDate?: string
    /** Datum des letzten Faktenchecks (ISO-Datum, z. B. „2025-09-15"). */
    verifiedAt?: string
    /** Ablaufdatum für zeitgebundene Popkultur (ISO-Datum). */
    validUntil?: string
  }
  tags?: string[]
  usedInRounds?: string[]
  author?: string
  status?: 'draft' | 'reviewed' | 'approved' | 'retired'
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice'
  options: string[]
  correctIndex: number
}

export interface OpenQuestion extends BaseQuestion {
  type: 'open'
  answer: string
  acceptableVariants?: string[]
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true-false'
  correctAnswer: boolean
}

export interface WarmupRiddleQuestion extends BaseQuestion {
  type: 'warmup-riddle'
  hints: string[]
  solution: string
}

export type Question =
  | MultipleChoiceQuestion
  | OpenQuestion
  | TrueFalseQuestion
  | WarmupRiddleQuestion
