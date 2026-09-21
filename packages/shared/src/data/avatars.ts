/**
 * Avatar-Palette: Farb-Set für die Spielerkarten (Session T).
 *
 * Ab Session T sind Avatare fotobasiert — jeder Spieler lädt ein Portrait
 * aus dem Filesystem. Ohne Foto (Default oder bewusste Entscheidung) zeigt
 * die UI einen farbigen Kreis mit Namens-Initiale.
 *
 * Die Palette harmoniert mit dem Design-System (Tailwind `mode.*` und
 * `brand.*`). `getDefaultAvatar(seed)` liefert einen deterministischen
 * Farb-Default für einen neuen Spieler-Slot.
 */

import type { Avatar } from '../types/round'

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
 * Deterministischer Default-Avatar für einen Slot. Rotiert die Farb-Palette
 * über `seed % AVATAR_COLORS.length` — derselbe Slot bekommt bei erneuter
 * Berechnung dieselbe Farbe.
 */
export function getDefaultAvatar(seed: number): Avatar {
  const colorHex = AVATAR_COLORS[seed % AVATAR_COLORS.length]
  return { colorHex, photoDataUrl: null }
}

/** Zufällige Farbe aus der Palette — für ganz neue Slots ohne Historie. */
export function makeRandomAvatar(): Avatar {
  const colorHex = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  return { colorHex, photoDataUrl: null }
}
