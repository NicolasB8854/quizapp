import { describe, it, expect } from 'vitest'
import {
  buildInterestSearchIndex,
  searchInterests,
  ensureTopicInInterests,
} from './interestSearch'

describe('buildInterestSearchIndex', () => {
  it('produziert einen nicht-leeren Index', () => {
    const index = buildInterestSearchIndex()
    expect(index.length).toBeGreaterThan(0)
  })

  it('enthält sowohl Katalog-Tags als auch Suggestions', () => {
    const index = buildInterestSearchIndex()
    const hasTag = index.some((e) => e.source === 'tag')
    const hasSuggestion = index.some((e) => e.source === 'suggestion')
    expect(hasTag).toBe(true)
    expect(hasSuggestion).toBe(true)
  })

  it('dedupliziert identische Labels case-insensitive', () => {
    const index = buildInterestSearchIndex()
    const seen = new Set<string>()
    for (const e of index) {
      expect(seen.has(e.normalized)).toBe(false)
      seen.add(e.normalized)
    }
  })

  it('normalisiert immer klein und getrimmt', () => {
    const index = buildInterestSearchIndex()
    for (const e of index) {
      expect(e.normalized).toBe(e.label.toLowerCase())
    }
  })
})

describe('searchInterests', () => {
  const index = buildInterestSearchIndex()

  it('gibt leeres Array bei leerem Query', () => {
    expect(searchInterests(index, '')).toEqual([])
    expect(searchInterests(index, '   ')).toEqual([])
  })

  it('findet Katalog-Tags per Prefix-Match', () => {
    // „Serotonin" ist ein Tag der neuen Wissenschaft-Fragen.
    const results = searchInterests(index, 'sero')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].label.toLowerCase()).toContain('sero')
  })

  it('bevorzugt Prefix-Match vor Substring-Match', () => {
    const results = searchInterests(index, 'net')
    // Ein Ergebnis mit Prefix „net…" muss vor solchen mit „…net" liegen,
    // wenn beide existieren (Rangordnungs-Regel #1).
    if (results.length >= 2) {
      const prefixResults = results.filter((r) => r.label.toLowerCase().startsWith('net'))
      const otherResults = results.filter((r) => !r.label.toLowerCase().startsWith('net'))
      if (prefixResults.length > 0 && otherResults.length > 0) {
        expect(results.indexOf(prefixResults[0])).toBeLessThan(
          results.indexOf(otherResults[0]),
        )
      }
    }
  })

  it('ordnet dem Ergebnis das Topic korrekt zu', () => {
    // Katalog hat "Cochlea" tag, gehört zu wissenschaft (Anatomie/Ohr-Frage).
    const results = searchInterests(index, 'cochlea')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].topic).toBe('wissenschaft')
  })

  it('filtert bereits gewählte Labels raus', () => {
    const alreadyChosen = new Set(['marvel'])
    const results = searchInterests(index, 'mar', alreadyChosen)
    for (const r of results) {
      expect(r.label.toLowerCase()).not.toBe('marvel')
    }
  })

  it('respektiert das Limit-Argument', () => {
    const results = searchInterests(index, 'e', new Set(), 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })
})

describe('ensureTopicInInterests', () => {
  it('fügt neues Topic mit defaultLevel hinzu', () => {
    const out = ensureTopicInInterests([], 'film', 3)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ topic: 'film', level: 3 })
  })

  it('lässt existierendes Topic unverändert', () => {
    const before = [{ topic: 'film' as const, level: 5 as const, tags: ['Marvel'] }]
    const after = ensureTopicInInterests(before, 'film', 2)
    expect(after).toBe(before)
  })

  it('behält andere Topics bei', () => {
    const before = [{ topic: 'sport' as const, level: 2 as const }]
    const after = ensureTopicInInterests(before, 'film', 3)
    expect(after).toHaveLength(2)
    expect(after.find((i) => i.topic === 'sport')).toBeDefined()
    expect(after.find((i) => i.topic === 'film')).toBeDefined()
  })
})
