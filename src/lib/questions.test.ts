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

  describe('pickTrueFalse mit InterestProfile (Session E)', () => {
    it('undefined Profile verhält sich wie ohne Filter', () => {
      const pool = getTrueFalsePool()
      const picked = pickTrueFalse(new Set(), undefined)
      expect(picked?.id).toBe(pool[0].id)
    })

    it('leeres Profile (keine shared/individual) verhält sich wie ohne Filter', () => {
      const pool = getTrueFalsePool()
      const picked = pickTrueFalse(new Set(), {
        shared: new Set(),
        individual: new Set(),
        levelPerTopic: new Map(),
      })
      expect(picked?.id).toBe(pool[0].id)
    })

    it('shared-only Profile bei Math.random=0: nimmt aus dem shared-Bucket', () => {
      // Math.random=0 → r = 0 * total → landet im ersten (shared-)Bucket.
      // Erste wissenschaft-TF-Frage ist q-flash-02 laut Katalog-Reihenfolge.
      const picked = pickTrueFalse(new Set(), {
        shared: new Set(['wissenschaft']),
        individual: new Set(),
        levelPerTopic: new Map(),
      })
      expect(picked?.topic).toBe('wissenschaft')
    })

    it('individual-only Profile: greift auf individual-Bucket bei Math.random=0', () => {
      const picked = pickTrueFalse(new Set(), {
        shared: new Set(),
        individual: new Set(['wissenschaft']),
        levelPerTopic: new Map(),
      })
      expect(picked?.topic).toBe('wissenschaft')
    })

    it('leerer Shared-Bucket fällt automatisch auf individual/wildcard', () => {
      // Games hat keine TF-Fragen → shared-Bucket ist leer, individual-Bucket auch,
      // Wildcard trägt alles.
      const picked = pickTrueFalse(new Set(), {
        shared: new Set(['games']),
        individual: new Set(),
        levelPerTopic: new Map(),
      })
      expect(picked).not.toBeNull()
      expect(picked!.topic).not.toBe('games')
    })

    it('nach voller Exclusion fällt der Duplicate-Check auf den kompletten Pool zurück', () => {
      const pool = getTrueFalsePool()
      const excluded = new Set(pool.map((q) => q.id))
      const picked = pickTrueFalse(excluded, {
        shared: new Set(['wissenschaft']),
        individual: new Set(),
        levelPerTopic: new Map(),
      })
      expect(picked).not.toBeNull()
      // Der Filter greift trotzdem — wissenschaft ist im Pool vertreten.
      expect(picked!.topic).toBe('wissenschaft')
    })

    it('Verteilung über 500 Ziehungen: shared wird deutlich häufiger gezogen als wildcard', () => {
      // Verifikation der 60/30/10-Gewichtung mit Math.random-Mock aufgeräumt.
      vi.restoreAllMocks()
      const profile = {
        shared: new Set(['wissenschaft'] as const),
        individual: new Set(['sprache'] as const),
        levelPerTopic: new Map(),
      }
      const counts = { shared: 0, individual: 0, wildcard: 0 }
      for (let i = 0; i < 500; i++) {
        const p = pickTrueFalse(new Set(), profile)
        if (!p) continue
        if (p.topic === 'wissenschaft') counts.shared++
        else if (p.topic === 'sprache') counts.individual++
        else counts.wildcard++
      }
      // Gewichtung ist 60/30/10; erlaubt ist normale Statistik-Streuung.
      expect(counts.shared).toBeGreaterThan(counts.individual)
      expect(counts.individual).toBeGreaterThan(counts.wildcard)
    })
  })
})
