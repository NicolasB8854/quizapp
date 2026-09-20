/**
 * Minimaler className-Merger. Kein Zusatzpaket — reicht für Prototyp-Bedarfe.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
