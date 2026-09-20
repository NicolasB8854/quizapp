/**
 * Fragen-Schema für alle Modi.
 *
 * Design-Prinzipien (siehe steering/project-context.md):
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
  gmNote?: string
  source?: string
  timeReference?: {
    isTimeSensitive: boolean
    referenceDate?: string
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
