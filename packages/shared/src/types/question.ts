/**
 * Fragen-Schema für alle Modi.
 *
 * Ausrichtung an Fragenpool-&-Contentlogik-Konzept v1 (Session X):
 * - `difficulty` ist **numerisch 1-5** (statt String-Skala). 1 = kinderleicht /
 *   Allgemeinwissen, 5 = Experten-Level. Der Wert ist konzept-konform und lässt
 *   sich später mit `difficulty_empirical` (Nutzungs-basiert) ergänzen.
 * - Multiple-Choice-Optionen als Array; `correctIndex` referenziert die
 *   richtige Option (0-basiert). Beim Rendern wird gemischt, damit ABCD-
 *   Balance keine Rolle spielt.
 * - `hints[]` für Warm-up-Rätsel (stufenweises Aufdecken).
 * - `gmNote` = **interne** Vorbereitungshinweise für den Quizmaster.
 * - `explanation` = **öffentliche** Auflösung, wird nach Antwort im UI gezeigt.
 * - `tags[]` = flexible Detail-Filter (Konzept: „NBA", „Finals", „2021"). Leer
 *   bei Migration; wird bei neuen Fragen gepflegt.
 * - `compatibleModes[]` = Liste der Spielmodi, in denen die Frage genutzt
 *   werden darf. Aus dem `type` abgeleitet, aber überschreibbar.
 * - `timeScope` = `timeless | dated | expiring`. Zeitloses Wissen vs. datierte
 *   Fakten (Rekorde, Charts).
 * - `aiGenerated` = Transparenz-Flag für den Review-Prozess.
 * - `createdAt/updatedAt` = Audit-Trail (ISO-Datum).
 * - `personalizationFit` steuert, wie der Quiz Director die Frage einordnet.
 * - `source` = URL/Referenz, damit Fakten prüfbar sind.
 */

import type { GameModeId } from './round'

/**
 * Redaktionelle Schwierigkeit auf 5-Stufen-Skala.
 *
 *   1 · kinderleicht / Allgemeinwissen — jeder löst
 *   2 · eher leicht — Bekannt, kurze Erinnerungsarbeit
 *   3 · mittel — Solides Wissen oder Ableitung nötig
 *   4 · schwer — Fachwissen, weniger bekannte Fakten
 *   5 · Experte — Spezialwissen
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5

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
 * Themenfelder — 50 Kategorien für Interessen-Matching, Themen-Battle-Grid
 * (12 Kacheln nach Team-Interessen), Board (5 Kategorien) und Experts-Fachwahl.
 *
 * Jede Frage verweist über `topic` auf genau eine Kategorie. Wenn eine Frage
 * mehrere Kategorien treffen könnte, wählt der Autor die spezifischste.
 *
 * Session AC: von 12 auf 50 erweitert. `wissenschaft` wurde in sieben
 * Sub-Disziplinen aufgesplittet (astronomie/physik/biologie/chemie/medizin/
 * psychologie/mathematik), `kurioses` bleibt breit für Fun-Facts und
 * Weltrekorde.
 */
export type Topic =
  // Klassiker (11)
  | 'film'
  | 'serien'
  | 'musik'
  | 'games'
  | 'geografie'
  | 'geschichte'
  | 'sport'
  | 'essen'
  | 'technik'
  | 'sprache'
  | 'kurioses'
  // Denken & Gesellschaft (5)
  | 'religion'
  | 'politik'
  | 'wirtschaft'
  | 'recht'
  | 'bildung'
  // Alltag & Lifestyle (6)
  | 'gesundheit'
  | 'reisen'
  | 'mode'
  | 'wohnen'
  | 'beauty'
  | 'autos'
  // Natur & Umwelt (3)
  | 'natur'
  | 'umwelt'
  | 'wetter'
  // Hobbys & Handwerk (4)
  | 'hobbys'
  | 'handwerk'
  | 'pflanzen'
  | 'fotografie'
  // Kunst & Buchstaben (5)
  | 'kunst'
  | 'literatur'
  | 'theater'
  | 'architektur'
  | 'comics'
  // Wissenschaft — vertieft (7)
  | 'astronomie'
  | 'physik'
  | 'biologie'
  | 'chemie'
  | 'medizin'
  | 'psychologie'
  | 'mathematik'
  // Fantasy & Fandom (2)
  | 'anime'
  | 'scifi'
  // Party & Fun (4)
  | 'beziehungen'
  | 'mystery'
  | 'astrologie'
  | 'prominente'
  // Trinken & Genuss (3)
  | 'getraenke'
  | 'kaffee'
  | 'suesses'

/**
 * Zeitbezug einer Frage.
 *
 *  - `timeless`  — zeitloses Wissen (Historie, Wissenschaft, Klassiker).
 *  - `dated`     — datierte Fakten mit `referenceDate` (z. B. „Stand 2025").
 *  - `expiring`  — Fakten mit Verfallsdatum (`validUntil`), z. B. aktuelle Rekorde.
 */
export type TimeScope = 'timeless' | 'dated' | 'expiring'

export interface BaseQuestion {
  id: string
  type: QuestionType
  category: Category
  topic: Topic
  subCategory?: string
  /** Redaktionelle Schwierigkeit 1-5 (nicht gesetzt bei warmup-riddle). */
  difficulty?: Difficulty
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
  /**
   * Flexible Detail-Tags (z. B. „NBA", „2021", „Ghibli"). Für Feinfilter und
   * Suche. Bewusst kein festes Vokabular — kann wachsen.
   */
  tags?: string[]
  /**
   * Zu welchen Spielmodi ist die Frage kompatibel? Bei nicht gesetzt: aus
   * `type` abgeleitet (siehe `defaultCompatibleModesFor` in `@/lib/questions`).
   */
  compatibleModes?: GameModeId[]
  /** Zeitbezug — Default `timeless`. */
  timeScope?: TimeScope
  /** Referenzdatum bei `timeScope: 'dated'`. */
  referenceDate?: string
  /** Verfallsdatum bei `timeScope: 'expiring'`. */
  expiresAt?: string
  /** Faktencheck-Datum (letzter Review). */
  verifiedAt?: string
  /** Wurde die Frage per KI-Assistent generiert? */
  aiGenerated?: boolean
  /** ISO-Datum der Erstellung. */
  createdAt?: string
  /** ISO-Datum der letzten Änderung. */
  updatedAt?: string
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
