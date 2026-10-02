import { describe, it, expect } from 'vitest'
import { findMatchWinner } from './WinnerHero'
import type { Team } from '@quizapp/shared'

const teams = [
  { id: 'a', name: 'Rot', color: 'red' },
  { id: 'b', name: 'Blau', color: 'blue' },
] as unknown as Team[]

describe('findMatchWinner', () => {
  it('liefert das Team mit den meisten Match-Punkten', () => {
    expect(findMatchWinner(teams, { a: 1, b: 3 })?.id).toBe('b')
  })
  it('liefert null bei Gleichstand an der Spitze', () => {
    expect(findMatchWinner(teams, { a: 2, b: 2 })).toBeNull()
  })
  it('liefert null ohne Teams', () => {
    expect(findMatchWinner([], {})).toBeNull()
  })
})
