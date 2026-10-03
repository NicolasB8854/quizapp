import { describe, it, expect } from 'vitest'
import { computeMetaTitles, computeTopicTitles, primaryTitle } from './titles'
import { EMPTY_STATS, applyNight, type SoloStats } from './soloStats'

function withTopics(perTopic: SoloStats['perTopic']): SoloStats {
  return { ...EMPTY_STATS, perTopic }
}

describe('Titel', () => {
  it('vergibt Chemie-Profi ab 40 Antworten und 75 %', () => {
    const t = computeTopicTitles(withTopics({ chemie: { answered: 40, correct: 30 } }))
    expect(t[0].label).toBe('Chemie-Profi')
    expect(t[0].next?.tier.id).toBe('legende')
  })

  it('viel spielen ohne Treffer reicht nicht', () => {
    expect(computeTopicTitles(withTopics({ chemie: { answered: 100, correct: 30 } }))).toEqual([])
  })

  it('primaryTitle nimmt die höchste Stufe', () => {
    const s = withTopics({
      film: { answered: 12, correct: 7 },
      chemie: { answered: 25, correct: 18 },
    })
    expect(primaryTitle(s)).toBe('Chemie-Kenner')
  })

  it('Meta-Titel für Serie und Siege', () => {
    const s = { ...EMPTY_STATS, streakDays: 7, nightsWon: 5 }
    const ids = computeMetaTitles(s).map((t) => t.id)
    expect(ids).toContain('stammgast')
    expect(ids).toContain('quizkoenig')
  })

  it('applyNight zählt denselben Abend nur einmal', () => {
    let s = applyNight(EMPTY_STATS, 'ABCD:1', true)
    s = applyNight(s, 'ABCD:1', true)
    expect(s.nightsPlayed).toBe(1)
    expect(s.nightsWon).toBe(1)
  })
})
