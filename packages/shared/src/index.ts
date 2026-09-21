/**
 * Barrel-Export des gemeinsamen Codes zwischen Vite-Frontend und AWS-Lambda.
 *
 * Konsumenten importieren idealerweise entweder alles über den Root:
 *   `import { Question, pickQuestion } from '@quizapp/shared'`
 *
 * oder gezielt aus den Sub-Barrels:
 *   `import type { Question } from '@quizapp/shared/types'`
 *   `import { MODES } from '@quizapp/shared/data'`
 *
 * Neue Module hier direkt re-exportieren, damit sie serverseitig verfügbar
 * werden ohne dass der Aufrufer den Import-Pfad kennt.
 */

// Types
export type * from './types/question'
export type * from './types/round'

// Pure logic
export * from './lib/questions'
export * from './lib/interestProfile'
export * from './lib/shuffle'
export * from './lib/roomCode'

// Data / Konstanten
export * from './data/modes'
export * from './data/topics'
export * from './data/teams'
export * from './data/avatars'
export * from './data/interest-suggestions'
