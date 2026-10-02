import { describe, it, expect } from 'vitest'
import { applySoloRun, EMPTY_STATS } from './soloStats'

const day = (iso: string) => new Date(`${iso}T12:00:00Z`)

describe('applySoloRun', () => {
  it('zählt pro Thema und merkt den Bestwert', () => {
    const s = applySoloRun(
      EMPTY_STATS,
      [
        { topic: 'chemie', correct: true },
        { topic: 'chemie', correct: false },
        { topic: 'film', correct: true },
      ],
      700,
      day('2026-10-02'),
    )
    expect(s.runs).toBe(1)
    expect(s.bestScore).toBe(700)
    expect(s.perTopic.chemie).toEqual({ answered: 2, correct: 1 })
    expect(s.perTopic.film).toEqual({ answered: 1, correct: 1 })
  })

  it('Serie: +1 am Folgetag, gleich am selben Tag, Reset nach Lücke', () => {
    let s = applySoloRun(EMPTY_STATS, [], 100, day('2026-10-01'))
    expect(s.streakDays).toBe(1)
    s = applySoloRun(s, [], 100, day('2026-10-01'))
    expect(s.streakDays).toBe(1)
    s = applySoloRun(s, [], 100, day('2026-10-02'))
    expect(s.streakDays).toBe(2)
    s = applySoloRun(s, [], 100, day('2026-10-05'))
    expect(s.streakDays).toBe(1)
  })
})
