import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clearPlayerLibrary,
  readPlayerLibrary,
  removeFromPlayerLibrary,
  saveToPlayerLibrary,
} from './playerLibrary'
import type { Player } from '@/types/round'

function player(id: string, name: string, extras: Partial<Player> = {}): Player {
  return {
    id,
    name,
    teamId: 'team-a',
    interests: [],
    avatar: { emoji: '🦊', colorHex: '#7C5CFF' },
    ...extras,
  }
}

describe('playerLibrary', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('liefert leere Liste ohne gespeicherte Daten', () => {
    expect(readPlayerLibrary()).toEqual([])
  })

  it('speichert Spieler mit echtem Namen und liest sie zurück', () => {
    saveToPlayerLibrary([player('p1', 'Alice')])
    const library = readPlayerLibrary()
    expect(library).toHaveLength(1)
    expect(library[0].id).toBe('p1')
    expect(library[0].name).toBe('Alice')
    expect(library[0].lastUsedAt).toBeTruthy()
  })

  it('ignoriert Spieler ohne Namen', () => {
    saveToPlayerLibrary([player('p1', ''), player('p2', '   ')])
    expect(readPlayerLibrary()).toHaveLength(0)
  })

  it('überschreibt bestehende Profile mit gleicher ID (Update)', () => {
    saveToPlayerLibrary([player('p1', 'Alice')])
    saveToPlayerLibrary([
      player('p1', 'Alicia', { avatar: { emoji: '🐼', colorHex: '#27D8FF' } }),
    ])
    const library = readPlayerLibrary()
    expect(library).toHaveLength(1)
    expect(library[0].name).toBe('Alicia')
    expect(library[0].avatar.emoji).toBe('🐼')
  })

  it('sortiert bei Read nach Recency — jüngste zuerst', () => {
    // Zwei Speicherungen mit realistischem Zeitversatz.
    const first = new Date('2024-01-01T10:00:00Z')
    const second = new Date('2024-01-02T10:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(first)
    saveToPlayerLibrary([player('p1', 'Alice')])
    vi.setSystemTime(second)
    saveToPlayerLibrary([player('p2', 'Bob')])
    vi.useRealTimers()

    const library = readPlayerLibrary()
    expect(library.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('removeFromPlayerLibrary entfernt gezielt ein Profil', () => {
    saveToPlayerLibrary([player('p1', 'Alice'), player('p2', 'Bob')])
    removeFromPlayerLibrary('p1')
    const library = readPlayerLibrary()
    expect(library).toHaveLength(1)
    expect(library[0].id).toBe('p2')
  })

  it('clearPlayerLibrary leert die gesamte Bibliothek', () => {
    saveToPlayerLibrary([player('p1', 'Alice'), player('p2', 'Bob')])
    clearPlayerLibrary()
    expect(readPlayerLibrary()).toEqual([])
  })

  it('toleriert kaputte Daten im localStorage', () => {
    localStorage.setItem('quizapp:playerLibrary', 'not-json')
    expect(readPlayerLibrary()).toEqual([])
  })

  it('toleriert Nicht-Array-JSON', () => {
    localStorage.setItem('quizapp:playerLibrary', '{"foo":"bar"}')
    expect(readPlayerLibrary()).toEqual([])
  })

  it('filtert Einträge ohne Pflichtfelder', () => {
    // Ein valides Profil und ein kaputtes daneben.
    localStorage.setItem(
      'quizapp:playerLibrary',
      JSON.stringify([
        {
          id: 'p1',
          name: 'Alice',
          interests: [],
          avatar: { emoji: '🦊', colorHex: '#7C5CFF' },
          lastUsedAt: '2024-01-01T10:00:00Z',
        },
        { id: 'p2' /* fehlende Felder */ },
      ]),
    )
    const library = readPlayerLibrary()
    expect(library).toHaveLength(1)
    expect(library[0].id).toBe('p1')
  })
})
