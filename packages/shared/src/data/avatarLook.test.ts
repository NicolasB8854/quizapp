import { describe, expect, it } from 'vitest'
import {
  AVATAR_PALETTES,
  AVATAR_PARTS,
  DEFAULT_AVATAR_LOOK,
  randomAvatarLook,
  sameAvatarLook,
  sanitizeAvatar,
  sanitizeAvatarLook,
  type AvatarPartKey,
} from './avatarLook'

describe('Avatar-Baukasten', () => {
  it('Zufallsfigur ist deterministisch pro Seed und gültig', () => {
    expect(randomAvatarLook(42)).toEqual(randomAvatarLook(42))
    for (let seed = 0; seed < 300; seed++) {
      const look = randomAvatarLook(seed)
      expect(sanitizeAvatarLook(look)).toEqual(look)
    }
  })

  it('Zufall bleibt stimmig: max. 2 Extras, kein Visier + Vollbart, keine Hüte auf hohen Frisuren', () => {
    for (let seed = 0; seed < 500; seed++) {
      const l = randomAvatarLook(seed)
      const extras = [l.beard !== 'none', l.glasses !== 'none', l.accessory !== 'none', l.cheeks !== 'none'].filter(Boolean)
      expect(extras.length).toBeLessThanOrEqual(2)
      expect(l.glasses === 'visor' && l.beard === 'full').toBe(false)
      if (['mohawk', 'afro', 'bun', 'spiky', 'quiff'].includes(l.hair)) {
        expect(['cap', 'beanie', 'partyhat']).not.toContain(l.accessory)
      }
    }
  })

  it('sanitize ersetzt fremde Werte durch Defaults und wirft Zusatzfelder weg', () => {
    const dirty = { ...DEFAULT_AVATAR_LOOK, hair: '<script>', skin: 99, eyeColor: -1, extra: 'x'.repeat(10_000) }
    const clean = sanitizeAvatarLook(dirty)!
    expect(clean.hair).toBe(DEFAULT_AVATAR_LOOK.hair)
    expect(clean.skin).toBe(DEFAULT_AVATAR_LOOK.skin)
    expect(clean.eyeColor).toBe(DEFAULT_AVATAR_LOOK.eyeColor)
    expect(Object.keys(clean).sort()).toEqual(Object.keys(DEFAULT_AVATAR_LOOK).sort())
    expect(sanitizeAvatarLook(null)).toBeNull()
    expect(sanitizeAvatarLook('figur')).toBeNull()
  })

  it('jede Bauteil-ID und jede Palettenfarbe übersteht sanitize', () => {
    for (const key of Object.keys(AVATAR_PARTS) as AvatarPartKey[]) {
      for (const id of AVATAR_PARTS[key]) {
        expect(sanitizeAvatarLook({ ...DEFAULT_AVATAR_LOOK, [key]: id })![key]).toBe(id)
      }
    }
    for (const [key, list] of Object.entries(AVATAR_PALETTES)) {
      expect(list.every((hex) => /^#[0-9A-F]{6}$/i.test(hex))).toBe(true)
      expect(sanitizeAvatarLook({ ...DEFAULT_AVATAR_LOOK, [key]: list.length - 1 })![key as 'skin']).toBe(list.length - 1)
    }
  })

  it('sanitizeAvatar begrenzt Felder', () => {
    const a = sanitizeAvatar(
      { colorHex: 'red', photoDataUrl: 'x'.repeat(200_000), emoji: 'x'.repeat(50), title: 't'.repeat(100), look: randomAvatarLook(1) },
      '#27D8FF',
    )
    expect(a.colorHex).toBe('#27D8FF')
    expect(a.photoDataUrl).toBeNull()
    expect(a.emoji).toBeNull()
    expect(a.title).toHaveLength(60)
    expect(a.look).toEqual(randomAvatarLook(1))
  })

  it('sameAvatarLook', () => {
    expect(sameAvatarLook(randomAvatarLook(3), randomAvatarLook(3))).toBe(true)
    expect(sameAvatarLook(DEFAULT_AVATAR_LOOK, { ...DEFAULT_AVATAR_LOOK, hair: 'afro' })).toBe(false)
    expect(sameAvatarLook(null, undefined)).toBe(true)
    expect(sameAvatarLook(null, DEFAULT_AVATAR_LOOK)).toBe(false)
  })
})
