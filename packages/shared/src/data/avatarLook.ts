/**
 * Avatar-Baukasten: Datenmodell, Paletten, Zufallsfigur und Validierung.
 *
 * Eine Figur ist nur eine kleine Konfiguration (Bauteil-IDs + Farb-Indizes,
 * < 300 Byte). Gezeichnet wird sie im Client (`src/components/avatar`), daher
 * geht sie problemlos im Spielstand per WebSocket an alle Geräte.
 *
 * Die Bauteil-Listen hier sind die einzige Quelle der Wahrheit: Client-Editor
 * und `sanitizeAvatarLook` (Reducer/Server) lesen dieselben IDs.
 */

import type { Avatar } from '../types/round'

export const AVATAR_PARTS = {
  head: ['oval', 'round', 'square', 'long'],
  hair: ['short', 'quiff', 'spiky', 'buzz', 'curly', 'afro', 'mohawk', 'bob', 'long', 'ponytail', 'bun', 'locs', 'bald'],
  eyes: ['round', 'dots', 'happy', 'wink', 'sleepy', 'wide'],
  brows: ['natural', 'raised', 'angry', 'worried', 'thick'],
  nose: ['soft', 'button', 'pointy'],
  mouth: ['smile', 'grin', 'laugh', 'smirk', 'neutral', 'oh'],
  beard: ['none', 'stubble', 'mustache', 'goatee', 'full'],
  glasses: ['none', 'round', 'square', 'shades', 'visor'],
  accessory: ['none', 'headphones', 'cap', 'beanie', 'earrings', 'partyhat'],
  outfit: ['hoodie', 'tee', 'blazer', 'turtleneck', 'jersey'],
  cheeks: ['none', 'blush', 'freckles'],
} as const

export type AvatarPartKey = keyof typeof AVATAR_PARTS
type PartId<K extends AvatarPartKey> = (typeof AVATAR_PARTS)[K][number]

/** Realistische Hauttöne, hell → dunkel. */
export const SKIN_TONES: readonly string[] = [
  '#FFE3D1', '#F6CFAE', '#EBB88E', '#D9A06C', '#C3844C', '#9E6440', '#7A4A2C', '#4F2F1E',
]
export const HAIR_COLORS: readonly string[] = [
  '#1D1820', '#3B2519', '#6A4127', '#9C6B3C', '#DDB56E', '#B4482B', '#9EA3AE', '#EDEDF2',
  '#FF3D8B', '#27D8FF', '#9C82FF',
]
export const EYE_COLORS: readonly string[] = ['#3B2519', '#6A4127', '#3A7BD5', '#3E8E5A', '#8C7A3A', '#5A6485']
export const OUTFIT_COLORS: readonly string[] = [
  '#7C5CFF', '#27D8FF', '#FF6E5C', '#E9C46A', '#FF3D8B', '#3FD98B', '#5B6A94', '#E8ECF8', '#2A2533',
]

export type AvatarColorKey = 'skin' | 'hairColor' | 'eyeColor' | 'outfitColor'
export const AVATAR_PALETTES: Record<AvatarColorKey, readonly string[]> = {
  skin: SKIN_TONES,
  hairColor: HAIR_COLORS,
  eyeColor: EYE_COLORS,
  outfitColor: OUTFIT_COLORS,
}

export interface AvatarLook {
  v: 1
  head: PartId<'head'>
  hair: PartId<'hair'>
  eyes: PartId<'eyes'>
  brows: PartId<'brows'>
  nose: PartId<'nose'>
  mouth: PartId<'mouth'>
  beard: PartId<'beard'>
  glasses: PartId<'glasses'>
  accessory: PartId<'accessory'>
  outfit: PartId<'outfit'>
  cheeks: PartId<'cheeks'>
  /** Indizes in die Paletten oben. */
  skin: number
  hairColor: number
  eyeColor: number
  outfitColor: number
}

export const DEFAULT_AVATAR_LOOK: AvatarLook = {
  v: 1,
  head: 'oval',
  hair: 'short',
  eyes: 'round',
  brows: 'natural',
  nose: 'soft',
  mouth: 'smile',
  beard: 'none',
  glasses: 'none',
  accessory: 'none',
  outfit: 'hoodie',
  cheeks: 'none',
  skin: 2,
  hairColor: 2,
  eyeColor: 0,
  outfitColor: 0,
}

/** Kleiner deterministischer PRNG (mulberry32) — gleiche Seed → gleiche Figur. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Zufällige, aber stimmige Figur: freundliche Mimik, höchstens zwei Extras,
 * keine Hüte auf hohen Frisuren, Neon-Haare selten und ohne Bart.
 */
export function randomAvatarLook(seed: number = Math.floor(Math.random() * 2 ** 31)): AvatarLook {
  const r = rng(seed)
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]
  const idx = (n: number) => Math.floor(r() * n)
  const naturalHair = HAIR_COLORS.length - 3
  const hair = r() < 0.06 ? 'bald' : pick(AVATAR_PARTS.hair.filter((h) => h !== 'bald'))
  const hairColor = r() < 0.1 ? naturalHair + idx(3) : idx(naturalHair)

  // Höchstens zwei Extras, meist keins oder eins — das Gesicht bleibt frei.
  const extras = r() < 0.4 ? 0 : r() < 0.85 ? 1 : 2
  const slots = ['beard', 'glasses', 'accessory', 'cheeks'] as const
  const chosen = new Set<string>()
  while (chosen.size < extras) chosen.add(pick(slots))
  const hatOk = !['mohawk', 'afro', 'bun', 'spiky', 'quiff'].includes(hair)
  let accessory: AvatarLook['accessory'] = 'none'
  if (chosen.has('accessory')) {
    accessory = pick(hatOk ? (['headphones', 'cap', 'beanie', 'earrings', 'partyhat'] as const) : (['earrings', 'headphones'] as const))
  }
  // Visier nur im Editor wählbar — im Zufall verdeckt es zu oft die Augen.
  const glasses: AvatarLook['glasses'] = chosen.has('glasses') ? pick(['round', 'square', 'round', 'square', 'shades'] as const) : 'none'
  // Neon-Haare ohne Bart (sonst Kostüm).
  const beard: AvatarLook['beard'] = chosen.has('beard') && hairColor < naturalHair ? pick(['stubble', 'mustache', 'goatee', 'full'] as const) : 'none'

  return {
    v: 1,
    head: pick(AVATAR_PARTS.head),
    hair,
    eyes: pick(['round', 'round', 'round', 'dots', 'happy', 'wide', 'wink'] as const),
    brows: pick(['natural', 'natural', 'natural', 'raised', 'thick'] as const),
    nose: pick(AVATAR_PARTS.nose),
    mouth: pick(['smile', 'smile', 'smile', 'grin', 'grin', 'laugh', 'smirk'] as const),
    beard,
    glasses,
    accessory,
    outfit: pick(AVATAR_PARTS.outfit),
    cheeks: chosen.has('cheeks') ? pick(['blush', 'freckles'] as const) : 'none',
    skin: idx(SKIN_TONES.length),
    hairColor,
    eyeColor: idx(EYE_COLORS.length),
    outfitColor: idx(OUTFIT_COLORS.length),
  }
}

function partOr<K extends AvatarPartKey>(key: K, value: unknown): PartId<K> {
  const list = AVATAR_PARTS[key] as readonly string[]
  return (typeof value === 'string' && list.includes(value) ? value : DEFAULT_AVATAR_LOOK[key]) as PartId<K>
}

function colorOr(key: AvatarColorKey, value: unknown): number {
  const n = AVATAR_PALETTES[key].length
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < n ? value : DEFAULT_AVATAR_LOOK[key]
}

/** Unbekannte/fremde Werte → Default. Gibt nur bekannte Felder zurück. */
export function sanitizeAvatarLook(input: unknown): AvatarLook | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  const look = { v: 1 } as AvatarLook
  for (const key of Object.keys(AVATAR_PARTS) as AvatarPartKey[]) {
    ;(look as unknown as Record<string, unknown>)[key] = partOr(key, o[key])
  }
  for (const key of Object.keys(AVATAR_PALETTES) as AvatarColorKey[]) {
    look[key] = colorOr(key, o[key])
  }
  return look
}

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Avatar aus einem Client-Request bereinigen (Reducer `SET_PLAYER_AVATAR`):
 * nur bekannte Felder, Längen begrenzt, damit niemand den Spielstand aufbläht.
 */
export function sanitizeAvatar(input: Avatar, fallbackColor = '#7C5CFF'): Avatar {
  const photo = typeof input.photoDataUrl === 'string' && input.photoDataUrl.length <= 120_000 ? input.photoDataUrl : null
  return {
    colorHex: typeof input.colorHex === 'string' && HEX.test(input.colorHex) ? input.colorHex : fallbackColor,
    photoDataUrl: photo,
    emoji: typeof input.emoji === 'string' && input.emoji.length <= 16 ? input.emoji : null,
    title: typeof input.title === 'string' ? input.title.slice(0, 60) : null,
    look: sanitizeAvatarLook(input.look),
  }
}

/** Gleichheit zweier Figuren (für „muss ich den Avatar neu senden?"). */
export function sameAvatarLook(a: AvatarLook | null | undefined, b: AvatarLook | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return (Object.keys(DEFAULT_AVATAR_LOOK) as (keyof AvatarLook)[]).every((k) => a[k] === b[k])
}
