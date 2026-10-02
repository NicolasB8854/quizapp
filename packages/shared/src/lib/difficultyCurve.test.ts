import { describe, it, expect, afterEach, vi } from 'vitest'
import { clampDifficulty, getAllMultipleChoice, pickByTargetDifficulty } from './questions'
import { eliminationDifficulty, LADDER_DIFFICULTIES } from '../state/reducer'
import type { Difficulty } from '../types/question'

afterEach(() => vi.restoreAllMocks())

describe('pickByTargetDifficulty', () => {
  it('liefert exakt die Ziel-Stufe, solange vorhanden', () => {
    for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
      const q = pickByTargetDifficulty(new Set(), d)
      expect(q).not.toBeNull()
      expect(q!.difficulty).toBe(d)
    }
  })

  it('weicht auf die nächste Stufe aus, wenn die Ziel-Stufe verbraucht ist', () => {
    const used = new Set(getAllMultipleChoice().filter((q) => q.difficulty === 3).map((q) => q.id))
    const q = pickByTargetDifficulty(used, 3)
    expect(q).not.toBeNull()
    expect(used.has(q!.id)).toBe(false)
    expect([2, 4]).toContain(q!.difficulty)
  })

  it('bevorzugt beim Ausweichen die leichtere Stufe', () => {
    const used = new Set(getAllMultipleChoice().filter((q) => q.difficulty === 3).map((q) => q.id))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const q = pickByTargetDifficulty(used, 3)
    expect(q!.difficulty).toBe(2)
  })

  it('respektiert ein Topic-Filter', () => {
    const q = pickByTargetDifficulty(new Set(), 2, 'film')
    expect(q!.topic).toBe('film')
  })
})

describe('Schwierigkeitskurven', () => {
  it('clampDifficulty begrenzt auf 1-5', () => {
    expect(clampDifficulty(0)).toBe(1)
    expect(clampDifficulty(9)).toBe(5)
    expect(clampDifficulty(3)).toBe(3)
  })

  it('Punkte-Leiter steigt strikt von 1 bis 5', () => {
    expect(LADDER_DIFFICULTIES).toEqual([1, 2, 3, 4, 5])
  })

  it('Elimination steigt pro voller Spielerrunde um eine Stufe', () => {
    const players = 4
    expect([0, 1, 2, 3].map((n) => eliminationDifficulty(n, players))).toEqual([1, 1, 1, 1])
    expect(eliminationDifficulty(4, players)).toBe(2)
    expect(eliminationDifficulty(8, players)).toBe(3)
    expect(eliminationDifficulty(100, players)).toBe(5)
  })
})
