/**
 * Fragen-Schema für alle Modi.
 *
 * Design-Prinzipien:
 * - Multiple-Choice-Optionen als Array, damit bei Bedarf 2/3/4 Optionen unterstützt werden.
 * - `correctIndex` referenziert die richtige Option (0-basiert). App shufflet die Optionen
 *   beim Rendern, damit ABCD-Balance keine Rolle spielt (Learning aus Runde 6).
 * - `hints[]` für Warm-up-Rätsel (stufenweises Aufdecken).
 * - `gmNote` = Kontext für den Quizmaster (Fun-Fact, Quelle, Nebeninfos). Gehört NICHT in
 *   die Frage selbst.
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

export interface BaseQuestion {
  id: string
  type: QuestionType
  category: Category
  subCategory?: string
  difficulty: Difficulty
  question: string
  gmNote?: string
  source?: string
  timeReference?: {
    isTimeSensitive: boolean
    referenceDate?: string // ISO-Datum, wenn zeitkritisch
  }
  tags?: string[]
  usedInRounds?: string[] // z. B. ["round-1", "round-6"]
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
  acceptableVariants?: string[] // z. B. Schreibweisen-Varianten
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true-false'
  correctAnswer: boolean
}

export interface WarmupRiddleQuestion extends BaseQuestion {
  type: 'warmup-riddle'
  hints: string[] // in Reveal-Reihenfolge
  solution: string
}

export type Question =
  | MultipleChoiceQuestion
  | OpenQuestion
  | TrueFalseQuestion
  | WarmupRiddleQuestion
