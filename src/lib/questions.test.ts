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
import type { Difficulty, Topic } from '@/types/question'
import type { SkillLevel } from '@/types/round'

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
      const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
      for (let i = 0; i < 400; i++) {
        const picked = pickAnyMultipleChoice(new Set(), 5)
        if (picked) counts[picked.difficulty!] = (counts[picked.difficulty!] ?? 0) + 1
      }
      expect(counts[4]).toBeGreaterThan(counts[2])
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
      difficulty: Difficulty
    }
    const items: Fake[] = [
      { id: 'l1', difficulty: 2 },
      { id: 'l2', difficulty: 2 },
      { id: 'm1', difficulty: 3 },
      { id: 'm2', difficulty: 3 },
      { id: 's1', difficulty: 4 },
      { id: 's2', difficulty: 4 },
    ]

    it('leerer Input liefert null', () => {
      const picked = pickByDifficulty([] as Fake[], () => 3 as SkillLevel)
      expect(picked).toBeNull()
    })

    it('ohne Level (getLevel returns undefined) fällt auf uniforme Wahl zurück', () => {
      // Math.random ist auf 0 gepinnt → nimmt den ersten Kandidaten.
      const picked = pickByDifficulty(items, () => undefined)
      expect(picked?.id).toBe('l1')
    })

    it("preferredLevel 'bisschen': leicht-Fragen dominieren deutlich über N=800", () => {
      vi.restoreAllMocks()
      const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
      for (let i = 0; i < 800; i++) {
        const picked = pickByDifficulty(items, () => 2 as SkillLevel)
        if (picked) counts[picked.difficulty!] = (counts[picked.difficulty!] ?? 0) + 1
      }
      expect(counts[2]).toBeGreaterThan(counts[3])
      expect(counts[3]).toBeGreaterThan(counts[4])
    })

    it("preferredLevel 'nerd': schwer-Fragen dominieren deutlich über N=800", () => {
      vi.restoreAllMocks()
      const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
      for (let i = 0; i < 800; i++) {
        const picked = pickByDifficulty(items, () => 5 as SkillLevel)
        if (picked) counts[picked.difficulty!] = (counts[picked.difficulty!] ?? 0) + 1
      }
      expect(counts[4]).toBeGreaterThan(counts[3])
      expect(counts[3]).toBeGreaterThan(counts[2])
    })

    it('nur experten-verlangende Fragen bei bisschen-Level: uniforme Fallback-Wahl', () => {
      // 'bisschen' hat für 'experten' Gewicht 0 → total = 0 → uniform fallback.
      const expertOnly: Fake[] = [
        { id: 'e1', difficulty: 5 },
        { id: 'e2', difficulty: 5 },
      ]
      const picked = pickByDifficulty(expertOnly, () => 2 as SkillLevel)
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

    it("preferredLevel 'bisschen': bevorzugt leichte und mittlere Fragen gegenüber schweren", () => {
      vi.restoreAllMocks()
      const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
      for (let i = 0; i < 800; i++) {
        const picked = pickQuestion('film', new Set(), 2)
        if (picked) counts[picked.difficulty!] = (counts[picked.difficulty!] ?? 0) + 1
      }
      // Bei level=bisschen: leicht 60, mittel 30, schwer 10, experten 0.
      // Kombiniert (leicht + mittel) sollte klar dominieren, schwer/experten selten.
      const easyish = counts[2] + counts[3]
      const hardish = counts[4] + counts[5]
      expect(easyish).toBeGreaterThan(hardish * 3)
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
      // Alle TF-Fragen zu 'games' excluden → der shared-Bucket ist frisch leer,
      // aber es gibt keine individuellen Interessen. Fallback muss auf wildcard fallen.
      const gamesTF = getTrueFalsePool().filter((q) => q.topic === 'games')
      const excluded = new Set(gamesTF.map((q) => q.id))
      const picked = pickTrueFalse(excluded, {
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
        levelPerTopic: new Map<Topic, SkillLevel>([['sprache', 5]]),
      }
      const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
      // Wir zählen nur sprache-Treffer, damit die 60/30/10-Bucket-Wahl uns nicht
      // verzerrt (der wildcard-Anteil verdünnt sonst die Level-Signale).
      let sprachHits = 0
      for (let i = 0; i < 1500 && sprachHits < 400; i++) {
        const p = pickTrueFalse(new Set(), profile)
        if (p?.topic === 'sprache') {
          sprachHits++
          counts[p.difficulty!] = (counts[p.difficulty!] ?? 0) + 1
        }
      }
      // Bei level=nerd: schwer 45 vs. leicht 5 → schwer sollte dominieren.
      expect(counts[4]).toBeGreaterThan(counts[2] * 3)
    })

    it('Level bisschen auf sprache: bevorzugt leicht über schwer', () => {
      vi.restoreAllMocks()
      const profile = {
        shared: new Set<Topic>(['sprache']),
        individual: new Set<Topic>(),
        levelPerTopic: new Map<Topic, SkillLevel>([['sprache', 2]]),
      }
      const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
      let sprachHits = 0
      for (let i = 0; i < 1500 && sprachHits < 400; i++) {
        const p = pickTrueFalse(new Set(), profile)
        if (p?.topic === 'sprache') {
          sprachHits++
          counts[p.difficulty!] = (counts[p.difficulty!] ?? 0) + 1
        }
      }
      // Bei level=bisschen: leicht 60 vs. schwer 10 → leicht dominiert.
      expect(counts[2]).toBeGreaterThan(counts[4] * 3)
    })
  })

  describe('Tag-Bonus (Session AB)', () => {
    it('pickByDifficulty ohne matchesTag verhält sich wie vorher (leerer Callback → keine Änderung)', () => {
      interface Fake { id: string; difficulty: Difficulty; tags?: string[] }
      const items: Fake[] = [
        { id: 'a', difficulty: 3, tags: ['foo'] },
        { id: 'b', difficulty: 3 },
      ]
      // Math.random=0 → erstes Item, weil Weights identisch.
      const picked = pickByDifficulty(items, () => 3 as SkillLevel)
      expect(picked?.id).toBe('a')
    })

    it('pickByDifficulty mit matchesTag: matchende Items bekommen deutlich mehr Zug-Chance', () => {
      vi.restoreAllMocks()
      interface Fake { id: string; difficulty: Difficulty; tags?: string[] }
      const items: Fake[] = [
        { id: 'match', difficulty: 3, tags: ['basketball'] },
        { id: 'nomatch-1', difficulty: 3 },
        { id: 'nomatch-2', difficulty: 3 },
        { id: 'nomatch-3', difficulty: 3 },
        { id: 'nomatch-4', difficulty: 3 },
      ]
      const wanted = new Set(['basketball'])
      const matchFn = (q: Fake) => !!q.tags?.some((t) => wanted.has(t))
      let matchHits = 0
      const N = 1500
      for (let i = 0; i < N; i++) {
        const p = pickByDifficulty(items, () => 3 as SkillLevel, matchFn)
        if (p?.id === 'match') matchHits++
      }
      // Ohne Bonus wäre die Erwartung N/5 = 300 Treffer. Mit 5x-Bonus:
      // Match-Weight = 5, andere = 1 pro Stück → Wahrscheinlichkeit = 5 / (5 + 4) ≈ 55%.
      // Ich lasse Streuung großzügig: mindestens 40%.
      expect(matchHits).toBeGreaterThan(N * 0.4)
    })

    it('pickQuestion mit preferredTags bevorzugt Fragen mit matchenden Katalog-Tags', () => {
      vi.restoreAllMocks()
      const pool = getMultipleChoiceByTopic('film')
      const tagged = pool.filter((q) => q.tags && q.tags.length > 0)
      expect(tagged.length).toBeGreaterThan(0)
      // Wähle einen konkret vorhandenen Katalog-Tag als „Player-Interesse".
      const someTag = tagged[0].tags![0]
      const matchIds = new Set(
        pool.filter((q) => q.tags?.includes(someTag)).map((q) => q.id),
      )
      let hits = 0
      const N = 400
      for (let i = 0; i < N; i++) {
        const picked = pickQuestion('film', new Set(), 3, [someTag])
        if (picked && matchIds.has(picked.id)) hits++
      }
      // Ohne Bonus wäre die Erwartung ~ (matchIds.size / pool.length) * N.
      // Wir prüfen konservativ, dass matchende Fragen deutlich öfter kommen als
      // ihr uniformer Erwartungswert.
      const uniformExpected = (matchIds.size / pool.length) * N
      expect(hits).toBeGreaterThan(uniformExpected * 1.5)
    })

    it('pickQuestion ohne preferredTags (kein Level) verhält sich uniform (Math.random=0 → erstes Item)', () => {
      const pool = getMultipleChoiceByTopic('film')
      const picked = pickQuestion('film', new Set())
      expect(picked?.id).toBe(pool[0].id)
    })

    it('pickAnyMultipleChoice mit preferredTags aber ohne Level nutzt weiterhin den Bonus', () => {
      vi.restoreAllMocks()
      const all = getAllMultipleChoice()
      const tagged = all.filter((q) => q.tags && q.tags.length > 0)
      expect(tagged.length).toBeGreaterThan(0)
      const someTag = tagged[0].tags![0]
      const matchIds = new Set(
        all.filter((q) => q.tags?.includes(someTag)).map((q) => q.id),
      )
      let hits = 0
      const N = 400
      for (let i = 0; i < N; i++) {
        const picked = pickAnyMultipleChoice(new Set(), undefined, [someTag])
        if (picked && matchIds.has(picked.id)) hits++
      }
      const uniformExpected = (matchIds.size / all.length) * N
      expect(hits).toBeGreaterThan(uniformExpected * 1.5)
    })

    it('leere preferredTags → keine Verhaltensänderung (kein Bonus, uniform)', () => {
      const pool = getMultipleChoiceByTopic('film')
      const picked = pickQuestion('film', new Set(), undefined, [])
      expect(picked?.id).toBe(pool[0].id)
    })

    it('preferredTags matchen case-insensitive', () => {
      vi.restoreAllMocks()
      const pool = getMultipleChoiceByTopic('film')
      const tagged = pool.filter((q) => q.tags && q.tags.length > 0)
      const someTag = tagged[0].tags![0]
      const matchIds = new Set(
        pool.filter((q) => q.tags?.includes(someTag)).map((q) => q.id),
      )
      const upper = someTag.toUpperCase()
      let hits = 0
      const N = 200
      for (let i = 0; i < N; i++) {
        const picked = pickQuestion('film', new Set(), 3, [upper])
        if (picked && matchIds.has(picked.id)) hits++
      }
      const uniformExpected = (matchIds.size / pool.length) * N
      expect(hits).toBeGreaterThan(uniformExpected * 1.5)
    })
  })
})
