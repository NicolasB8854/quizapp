/**
 * Avatar-Palette: kompaktes Emoji- + Farb-Set für die Spielerkarten.
 *
 * Bewusst kein Gesicht — die App bleibt neutral gegen Geschlecht/Alter/Ethnie.
 * Emojis sind universelle Symbole (Tiere, Objekte, Natur), Farben harmonieren
 * mit dem Design-System (Tailwind `mode.*` und `brand.*`).
 *
 * `getDefaultAvatar(seed)` liefert einen deterministischen Default für einen
 * neuen Spieler-Slot, damit die App nie „leer" wirkt.
 */

import type { Avatar } from '@/types/round'

export const AVATAR_EMOJIS: readonly string[] = [
  '🦊', '🐼', '🦁', '🐺', '🦉', '🐢',
  '🐙', '🦖', '🦩', '🦄', '🐝', '⚡',
] as const

export const AVATAR_COLORS: readonly string[] = [
  '#7C5CFF', // brand.purple
  '#27D8FF', // brand.cyan
  '#FF6E5C', // mode.sprinter
  '#E9C46A', // mode.ladder
  '#F4A261', // mode.corner
  '#B78BFF', // mode.experts
  '#FF3D8B', // mode.flash
  '#3FD98B', // correct
] as const

/**
 * Deterministischer Default-Avatar für einen Slot. Nutzt `seed` als Index-
 * Basis, damit derselbe Slot bei erneuter Berechnung dasselbe Symbol bekommt.
 */
export function getDefaultAvatar(seed: number): Avatar {
  const emoji = AVATAR_EMOJIS[seed % AVATAR_EMOJIS.length]
  const colorHex = AVATAR_COLORS[seed % AVATAR_COLORS.length]
  return { emoji, colorHex }
}

/** Zufälliger Avatar aus der Palette — für ganz neue Slots ohne Historie. */
export function makeRandomAvatar(): Avatar {
  const emoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)]
  const colorHex = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  return { emoji, colorHex }
}
