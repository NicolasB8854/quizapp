/**
 * Kurze Vibrationen fürs Handy (Buzz, richtig, falsch, Zeit um).
 * Läuft nur, wo `navigator.vibrate` existiert (Android/Chrome; iOS Safari
 * ignoriert es still) und respektiert `prefers-reduced-motion`.
 */
export type HapticKind = 'buzz' | 'correct' | 'wrong' | 'timeUp'

const PATTERNS: Record<HapticKind, number | number[]> = {
  buzz: 25,
  correct: [30, 40, 30],
  wrong: [80, 50, 80],
  timeUp: 150,
}

export function haptic(kind: HapticKind): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    navigator.vibrate(PATTERNS[kind])
  } catch {
    // Silent — reines Komfort-Feature.
  }
}
