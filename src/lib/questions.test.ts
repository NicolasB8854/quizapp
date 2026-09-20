import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAllQuestions,
  getMultipleChoiceByTopic,
  getTrueFalsePool,
  pickQuestion,
  pickTrueFalse,
} from './questions'
import type { Topic } from '@/types/question'

describe('questions', () => {
  beforeEach(() => {
    // Deterministisch: Math.random gibt 0 → immer der erste Kandidat.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  describe('getAllQuestions', () => {
    it('enthält Multiple-Choice und True-False-Einträge', () => {
      const all = getAllQuestions()
      expect(all.length).toBeGreaterThan(0)
      const types = new Set(all.map((q) => q.type))
      expect(types.has('multiple-choice')).toBe(true)
      expect(types.has('true-false')).toBe(true)
    })
  })

  describe('getMultipleChoiceByTopic', () => {
    it('filtert nach Topic und Type', () => {
      const pool = getMultipleChoiceByTopic('film')
      expect(pool.length).toBeGreaterThan(0)
      for (const q of pool) {
        expect(q.type).toBe('multiple-choice')
        expect(q.topic).toBe('film')
      }
    })

    it('gibt einen leeren Array zurück für Topics ohne Fragen', () => {
      // Type-Cast, damit auch ein zur Laufzeit „exotischer" Topic getestet werden kann.
      const pool = getMultipleChoiceByTopic('nonsense' as Topic)
      expect(pool).toEqual([])
    })
  })

  describe('pickQuestion', () => {
    it('zieht eine Frage aus dem Topic-Pool, die nicht ausgeschlossen ist', () => {
      const pool = getMultipleChoiceByTopic('film')
      const excluded = new Set([pool[0].id])
      const picked = pickQuestion('film', excluded)
      expect(picked).not.toBeNull()
      expect(excluded.has(picked!.id)).toBe(false)
    })

    it('fällt auf den kompletten Pool zurück, wenn alle Fragen ausgeschlossen sind', () => {
      const pool = getMultipleChoiceByTopic('film')
      const excluded = new Set(pool.map((q) => q.id))
      const picked = pickQuestion('film', excluded)
      expect(picked).not.toBeNull()
      // Erste Frage im Pool ist die Rückfall-Wahl, weil Math.random=0.
      expect(picked!.id).toBe(pool[0].id)
    })

    it('gibt null zurück, wenn das Topic keine Fragen hat', () => {
      expect(pickQuestion('nonsense' as Topic, new Set())).toBeNull()
    })
  })

  describe('getTrueFalsePool', () => {
    it('enthält nur True-False-Fragen', () => {
      const pool = getTrueFalsePool()
      expect(pool.length).toBeGreaterThan(0)
      for (const q of pool) expect(q.type).toBe('true-false')
    })
  })

  describe('pickTrueFalse', () => {
    it('zieht eine ungenutzte Behauptung', () => {
      const pool = getTrueFalsePool()
      const excluded = new Set([pool[0].id])
      const picked = pickTrueFalse(excluded)
      expect(picked).not.toBeNull()
      expect(excluded.has(picked!.id)).toBe(false)
    })

    it('fällt auf den kompletten Pool zurück, wenn alles ausgeschlossen ist', () => {
      const pool = getTrueFalsePool()
      const excluded = new Set(pool.map((q) => q.id))
      const picked = pickTrueFalse(excluded)
      expect(picked).not.toBeNull()
      expect(picked!.id).toBe(pool[0].id)
    })
  })

  describe('pickTrueFalse mit Topic-Filter', () => {
    it('leerer Filter (undefined) verhält sich wie ohne Filter', () => {
      const pool = getTrueFalsePool()
      const picked = pickTrueFalse(new Set(), undefined)
      expect(picked?.id).toBe(pool[0].id)
    })

    it('leerer Filter (leeres Array) verhält sich wie ohne Filter', () => {
      const pool = getTrueFalsePool()
      const picked = pickTrueFalse(new Set(), [])
      expect(picked?.id).toBe(pool[0].id)
    })

    it('zieht nur aus den gewählten Topics, wenn frisch verfügbar', () => {
      // Wissenschaft ist im TF-Pool gut vertreten (4 Fragen).
      const picked = pickTrueFalse(new Set(), ['wissenschaft'])
      expect(picked?.topic).toBe('wissenschaft')
    })

    it('weicht Topic-Filter auf, wenn im Topic alles verbraucht ist', () => {
      const pool = getTrueFalsePool()
      const filmOnly = pool.filter((q) => q.topic === 'film')
      expect(filmOnly.length).toBeGreaterThan(0)
      // Alle film-TF-Fragen excluden → Fallback muss aus dem Rest-Pool ziehen.
      const excluded = new Set(filmOnly.map((q) => q.id))
      const picked = pickTrueFalse(excluded, ['film'])
      expect(picked).not.toBeNull()
      expect(picked!.topic).not.toBe('film')
      expect(excluded.has(picked!.id)).toBe(false)
    })

    it('fällt auf den vollen Pool zurück, wenn das Topic gar keine Fragen hat', () => {
      // 'games' hat keine True-False-Fragen im aktuellen Katalog.
      const gamesOnly = getTrueFalsePool().filter((q) => q.topic === 'games')
      expect(gamesOnly).toHaveLength(0)
      const picked = pickTrueFalse(new Set(), ['games'])
      expect(picked).not.toBeNull()
    })

    it('bevorzugt Interessen-Topics gegenüber Nicht-Interessen bei gleicher Verfügbarkeit', () => {
      // Ohne Math.random-Mock (weil wir Determinismus schon per Poolreihenfolge haben):
      // Erste Frage im Filter-Pool ist immer eine wissenschaft-Frage.
      const picked = pickTrueFalse(new Set(), ['wissenschaft', 'sprache'])
      expect(['wissenschaft', 'sprache']).toContain(picked?.topic)
    })
  })
})
