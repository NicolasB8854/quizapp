import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAllMultipleChoice,
  getAllQuestions,
  getMultipleChoiceByTopic,
  getTrueFalsePool,
  getWarmupRiddlePool,
  pickAnyMultipleChoice,
  pickByDifficulty,
  pickQuestion,
  pickTrueFalse,
  pickWarmupRiddle,
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

  describe('pickAnyMultipleChoice (Session J)', () => {
    it('zieht eine MC-Frage aus dem gesamten Pool', () => {
      const picked = pickAnyMultipleChoice(new Set())
      expect(picked).not.toBeNull()
      expect(picked!.type).toBe('multiple-choice')
    })

    it('respektiert usedIds und fällt bei erschöpftem Pool auf den vollen zurück', () => {
      const pool = getAllMultipleChoice()
      const excluded = new Set([pool[0].id])
      const picked = pickAnyMultipleChoice(excluded)
      expect(picked).not.toBeNull()
      expect(excluded.has(picked!.id)).toBe(false)
    })

    it('mit vollem Excluded fällt auf ersten Katalog-Eintrag zurück (Math.random=0)', () => {
      const pool = getAllMultipleChoice()
      const excluded = new Set(pool.map((q) => q.id))
      const picked = pickAnyMultipleChoice(excluded)
      expect(picked?.id).toBe(pool[0].id)
    })

    it('mit preferredLevel=nerd bevorzugt schwere Fragen (Verteilungscheck)', () => {
      vi.restoreAllMocks()
      const counts: Record<string, number> = { leicht: 0, mittel: 0, schwer: 0 }
      for (let i = 0; i < 400; i++) {
        const picked = pickAnyMultipleChoice(new Set(), 'nerd')
        if (picked) counts[picked.difficulty] = (counts[picked.difficulty] ?? 0) + 1
      }
      expect(counts.schwer).toBeGreaterThan(counts.leicht)
    })
  })

  describe('pickWarmupRiddle (Session I)', () => {
    it('zieht ein Rätsel aus dem Warm-Up-Pool', () => {
      const picked = pickWarmupRiddle(new Set())
      expect(picked).not.toBeNull()
      expect(picked!.type).toBe('warmup-riddle')
      expect(picked!.hints.length).toBeGreaterThan(0)
      expect(picked!.solution.length).toBeGreaterThan(0)
    })

    it('respektiert usedIds und fällt bei erschöpftem Pool auf voll zurück', () => {
      const pool = getWarmupRiddlePool()
      expect(pool.length).toBeGreaterThan(0)
      const excluded = new Set([pool[0].id])
      const picked = pickWarmupRiddle(excluded)
      expect(picked).not.toBeNull()
      expect(excluded.has(picked!.id)).toBe(false)
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

  describe('pickByDifficulty (Session H)', () => {
    interface Fake {
      id: string
      difficulty: 'leicht' | 'mittel' | 'schwer' | 'experten'
    }
    const items: Fake[] = [
      { id: 'l1', difficulty: 'leicht' },
      { id: 'l2', difficulty: 'leicht' },
      { id: 'm1', difficulty: 'mittel' },
      { id: 'm2', difficulty: 'mittel' },
      { id: 's1', difficulty: 'schwer' },
      { id: 's2', difficulty: 'schwer' },
    ]

    it('leerer Input liefert null', () => {
      const picked = pickByDifficulty([] as Fake[], () => 'gut')
      expect(picked).toBeNull()
    })

    it('ohne Level (getLevel returns undefined) fällt auf uniforme Wahl zurück', () => {
      // Math.random ist auf 0 gepinnt → nimmt den ersten Kandidaten.
      const picked = pickByDifficulty(items, () => undefined)
      expect(picked?.id).toBe('l1')
    })

    it("preferredLevel 'bisschen': leicht-Fragen dominieren deutlich über N=800", () => {
      vi.restoreAllMocks()
      const counts = { leicht: 0, mittel: 0, schwer: 0 }
      for (let i = 0; i < 800; i++) {
        const picked = pickByDifficulty(items, () => 'bisschen')
        if (picked) counts[picked.difficulty as keyof typeof counts]++
      }
      expect(counts.leicht).toBeGreaterThan(counts.mittel)
      expect(counts.mittel).toBeGreaterThan(counts.schwer)
    })

    it("preferredLevel 'nerd': schwer-Fragen dominieren deutlich über N=800", () => {
      vi.restoreAllMocks()
      const counts = { leicht: 0, mittel: 0, schwer: 0 }
      for (let i = 0; i < 800; i++) {
        const picked = pickByDifficulty(items, () => 'nerd')
        if (picked) counts[picked.difficulty as keyof typeof counts]++
      }
      expect(counts.schwer).toBeGreaterThan(counts.mittel)
      expect(counts.mittel).toBeGreaterThan(counts.leicht)
    })

    it('nur experten-verlangende Fragen bei bisschen-Level: uniforme Fallback-Wahl', () => {
      // 'bisschen' hat für 'experten' Gewicht 0 → total = 0 → uniform fallback.
      const expertOnly: Fake[] = [
        { id: 'e1', difficulty: 'experten' },
        { id: 'e2', difficulty: 'experten' },
      ]
      const picked = pickByDifficulty(expertOnly, () => 'bisschen')
      // Math.random=0 → nimmt den ersten Kandidaten im uniformen Fallback.
      expect(picked?.id).toBe('e1')
    })
  })

  describe('pickQuestion mit preferredLevel (Session H)', () => {
    it('ohne preferredLevel: aktuelles Verhalten (uniform, Math.random=0 → erstes Item)', () => {
      const pool = getMultipleChoiceByTopic('film')
      const picked = pickQuestion('film', new Set())
      expect(picked?.id).toBe(pool[0].id)
    })

    it("preferredLevel 'bisschen': bevorzugt leichte Fragen für Topics mit Level-Vielfalt", () => {
      vi.restoreAllMocks()
      const counts = { leicht: 0, mittel: 0, schwer: 0 }
      for (let i = 0; i < 500; i++) {
        const picked = pickQuestion('film', new Set(), 'bisschen')
        if (picked) counts[picked.difficulty as keyof typeof counts]++
      }
      // 'film' hat je genau 1 Frage pro Difficulty im Bestand.
      // Bei 60/30/10-Verteilung (bisschen): leicht dominiert klar.
      expect(counts.leicht).toBeGreaterThan(counts.mittel)
      expect(counts.mittel).toBeGreaterThan(counts.schwer)
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
        shared: new Set<Topic>(['wissenschaft']),
        individual: new Set<Topic>(['sprache']),
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

    it('Level nerd auf sprache: Innerhalb des Buckets bevorzugt schwer über leicht', () => {
      // sprache hat je genau 1 TF-Frage in leicht und schwer.
      vi.restoreAllMocks()
      const profile = {
        shared: new Set<Topic>(['sprache']),
        individual: new Set<Topic>(),
        levelPerTopic: new Map<Topic, 'nerd'>([['sprache', 'nerd']]),
      }
      const counts = { leicht: 0, schwer: 0 }
      // Wir zählen nur sprache-Treffer, damit die 60/30/10-Bucket-Wahl uns nicht
      // verzerrt (der wildcard-Anteil verdünnt sonst die Level-Signale).
      let sprachHits = 0
      for (let i = 0; i < 1500 && sprachHits < 400; i++) {
        const p = pickTrueFalse(new Set(), profile)
        if (p?.topic === 'sprache') {
          sprachHits++
          counts[p.difficulty as 'leicht' | 'schwer']++
        }
      }
      // Bei level=nerd: schwer 45 vs. leicht 5 → schwer sollte dominieren.
      expect(counts.schwer).toBeGreaterThan(counts.leicht * 3)
    })

    it('Level bisschen auf sprache: bevorzugt leicht über schwer', () => {
      vi.restoreAllMocks()
      const profile = {
        shared: new Set<Topic>(['sprache']),
        individual: new Set<Topic>(),
        levelPerTopic: new Map<Topic, 'bisschen'>([['sprache', 'bisschen']]),
      }
      const counts = { leicht: 0, schwer: 0 }
      let sprachHits = 0
      for (let i = 0; i < 1500 && sprachHits < 400; i++) {
        const p = pickTrueFalse(new Set(), profile)
        if (p?.topic === 'sprache') {
          sprachHits++
          counts[p.difficulty as 'leicht' | 'schwer']++
        }
      }
      // Bei level=bisschen: leicht 60 vs. schwer 10 → leicht dominiert.
      expect(counts.leicht).toBeGreaterThan(counts.schwer * 3)
    })
  })
})
