import { describe, it, expect } from 'vitest'
import { directEvening, minutesOf } from './director'

const seq = (vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

describe('Quiz Director', () => {
  const base = { playerCount: 6, teamCount: 2, playersWithInterests: 5, random: seq([0.1, 0.7, 0.3, 0.9, 0.5]) }

  it('baut einen Abend mit Opener und Finale', () => {
    const plan = directEvening({ ...base, minutes: 60 })
    expect(plan[0]).toBe('around-corner')
    expect(plan[plan.length - 1]).toBe('points-ladder')
    expect(new Set(plan).size).toBe(plan.length)
  })

  it('hält die Wunschdauer ungefähr ein', () => {
    for (const minutes of [30, 45, 60, 90]) {
      const total = minutesOf(directEvening({ ...base, minutes }))
      expect(total).toBeGreaterThanOrEqual(minutes - 15)
      expect(total).toBeLessThanOrEqual(minutes + 10)
    }
  })

  it('kurzer Abend: Blitzrunde als Opener, Elimination als Finale', () => {
    const plan = directEvening({ ...base, minutes: 30 })
    expect(plan[0]).toBe('flash')
    expect(plan[plan.length - 1]).toBe('elimination')
  })

  it('nie zwei Buzzer-Modi direkt hintereinander', () => {
    const buzzer = new Set(['category-board', 'duel-1v1'])
    for (let s = 0; s < 20; s++) {
      const plan = directEvening({ ...base, minutes: 120, random: seq([s / 20, 0.5, 0.9 - s / 40]) })
      for (let i = 1; i < plan.length; i++) {
        expect(buzzer.has(plan[i]) && buzzer.has(plan[i - 1])).toBe(false)
      }
    }
  })

  it('berücksichtigt die Gruppe', () => {
    const noInterests = directEvening({ ...base, minutes: 120, playersWithInterests: 0 })
    expect(noInterests).not.toContain('player-spotlight')
    const fewPlayers = directEvening({ ...base, minutes: 120, playerCount: 3 })
    expect(fewPlayers).not.toContain('duel-1v1')
  })
})
