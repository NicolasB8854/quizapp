/**
 * Auflösungs-Dramaturgie: In Modi, in denen alle Teams parallel tippen, wird
 * die richtige Antwort nicht sofort gezeigt. Erst sieht man, welches Team was
 * gewählt hat (Trommelwirbel), dann leuchtet die Lösung auf.
 */
import { DRUMROLL_MS } from '@/lib/audio'

/** Spannungs-Pause zwischen „wer hat was getippt" und der Lösung. */
export const REVEAL_SUSPENSE_MS = DRUMROLL_MS

const SUSPENSE_KINDS = new Set(['points-ladder', 'blindguess'])

export function isSuspenseKind(kind: string): boolean {
  return SUSPENSE_KINDS.has(kind)
}

/** Bei reduzierter Bewegung keine künstliche Wartezeit. */
export function suspenseMs(): number {
  if (typeof window === 'undefined') return 0
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return reduced ? 0 : REVEAL_SUSPENSE_MS
}
