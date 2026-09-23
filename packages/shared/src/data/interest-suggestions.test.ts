import { describe, it, expect } from 'vitest'

import {
  INTEREST_SUGGESTIONS,
  getInterestSuggestionsForTopic,
} from './interest-suggestions'

/**
 * Unit-Tests für die Interessens-Vorschläge (Session AA).
 */

describe('INTEREST_SUGGESTIONS', () => {
  it('hat für jedes Topic mindestens 8 Vorschläge', () => {
    // Alle 50 Topics müssen Suggestions haben; wir sampeln die 11 Klassiker
    // + 4 aufgesplittete Wissenschafts-Topics als Stichprobe.
    const topics = ['film', 'serien', 'musik', 'games', 'geografie', 'geschichte',
                    'sport', 'essen', 'technik', 'sprache', 'kurioses',
                    'medizin', 'physik', 'chemie', 'biologie'] as const
    for (const t of topics) {
      expect(INTEREST_SUGGESTIONS[t].length).toBeGreaterThanOrEqual(8)
    }
  })

  it('enthält für Sport typische deutsche Interessen wie Fußball und Basketball', () => {
    const list = INTEREST_SUGGESTIONS['sport']
    expect(list).toContain('Fußball')
    expect(list).toContain('Basketball')
  })

  it('enthält keine Duplikate innerhalb eines Topics', () => {
    for (const [_topic, list] of Object.entries(INTEREST_SUGGESTIONS)) {
      const lower = list.map((s) => s.toLowerCase())
      expect(new Set(lower).size).toBe(lower.length)
    }
  })
})

describe('getInterestSuggestionsForTopic', () => {
  it('zeigt zuerst Katalog-Tags, dann Standard-Vorschläge', () => {
    const out = getInterestSuggestionsForTopic('sport', ['NBA-Finals', 'Bundesliga'], [])
    expect(out[0]).toBe('NBA-Finals')
    expect(out[1]).toBe('Bundesliga')
    // Der Standard-Fußball kommt danach
    expect(out).toContain('Fußball')
  })

  it('filtert bereits gewählte Tags case-insensitive raus', () => {
    const out = getInterestSuggestionsForTopic('sport', [], ['fußball', 'BASKETBALL'])
    expect(out.map((s) => s.toLowerCase())).not.toContain('fußball')
    expect(out.map((s) => s.toLowerCase())).not.toContain('basketball')
    // Andere Vorschläge kommen normal
    expect(out).toContain('Tennis')
  })

  it('dedupliziert überlappende Tags zwischen Katalog und Standard', () => {
    const out = getInterestSuggestionsForTopic('sport', ['Tennis'], [])
    // Tennis nur einmal (aus Katalog), nicht doppelt aus INTEREST_SUGGESTIONS
    const tennisCount = out.filter((s) => s.toLowerCase() === 'tennis').length
    expect(tennisCount).toBe(1)
  })
})
