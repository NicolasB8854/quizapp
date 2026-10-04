import { beforeEach, describe, expect, it } from 'vitest'
import { readMyProfile, saveMyProfile } from './myProfile'

const KEY = 'quizapp:myProfile'

describe('readMyProfile – Default Figur', () => {
  beforeEach(() => localStorage.clear())

  it('neues Gerät startet mit Figur', () => {
    const p = readMyProfile()
    expect(p.avatar.look).not.toBeNull()
    expect(p.avatar.emoji).toBeNull()
  })

  it('altes Profil mit Emoji (vor dem Baukasten) bekommt einmalig eine Figur', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: 'Ana', avatar: { colorHex: '#27D8FF', photoDataUrl: null, emoji: '🦊' } }))
    const p = readMyProfile()
    expect(p.name).toBe('Ana')
    expect(p.avatar.colorHex).toBe('#27D8FF')
    expect(p.avatar.look).not.toBeNull()
    expect(p.avatar.emoji).toBeNull()
  })

  it('bewusst gewähltes Emoji bleibt erhalten', () => {
    const p = readMyProfile()
    saveMyProfile({ ...p, avatar: { ...p.avatar, look: null, emoji: '🦊' } })
    const again = readMyProfile()
    expect(again.avatar.look).toBeNull()
    expect(again.avatar.emoji).toBe('🦊')
  })
})
