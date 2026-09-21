import { describe, it, expect } from 'vitest'
import {
  aggregatePlayerInterests,
  computeInterestProfile,
} from './interestProfile'
import type { Player } from '@/types/round'

function player(id: string, teamId: string, interests: Array<[string, 'bisschen' | 'gut' | 'nerd']>): Player {
  return {
    id,
    name: '',
    teamId,
    interests: interests.map(([topic, level]) => ({
      topic: topic as Player['interests'][number]['topic'],
      level,
    })),
    avatar: { colorHex: '#7C5CFF', photoDataUrl: null },
  }
}

describe('aggregatePlayerInterests', () => {
  it('leerer Player-Array liefert leeres Array', () => {
    expect(aggregatePlayerInterests([])).toEqual([])
  })

  it('sammelt Topics dedupliziert und in Reihenfolge der ersten Nennung', () => {
    const players = [
      player('p1', 'a', [['film', 'gut'], ['musik', 'bisschen']]),
      player('p2', 'b', [['musik', 'nerd'], ['sport', 'gut']]),
    ]
    expect(aggregatePlayerInterests(players)).toEqual(['film', 'musik', 'sport'])
  })
})

describe('computeInterestProfile', () => {
  it('leerer Player-Array liefert leere Sets und Map', () => {
    const profile = computeInterestProfile([])
    expect(profile.shared.size).toBe(0)
    expect(profile.individual.size).toBe(0)
    expect(profile.levelPerTopic.size).toBe(0)
  })

  it('trennt shared (>=2) von individual (=1)', () => {
    const players = [
      player('p1', 'a', [['film', 'gut'], ['musik', 'bisschen']]),
      player('p2', 'b', [['musik', 'gut']]),
      player('p3', 'a', [['sport', 'nerd']]),
    ]
    const profile = computeInterestProfile(players)
    expect(profile.shared.has('musik')).toBe(true)
    expect(profile.individual.has('film')).toBe(true)
    expect(profile.individual.has('sport')).toBe(true)
    expect(profile.shared.has('film')).toBe(false)
  })

  it('levelPerTopic nimmt das höchste Level (Max-Aggregation)', () => {
    const players = [
      player('p1', 'a', [['musik', 'bisschen']]),
      player('p2', 'b', [['musik', 'nerd']]),
      player('p3', 'a', [['musik', 'gut']]),
    ]
    const profile = computeInterestProfile(players)
    expect(profile.levelPerTopic.get('musik')).toBe('nerd')
  })

  it('individuelles Topic behält sein einzelnes Level', () => {
    const players = [player('p1', 'a', [['film', 'bisschen']])]
    const profile = computeInterestProfile(players)
    expect(profile.levelPerTopic.get('film')).toBe('bisschen')
  })

  it('kein Topic doppelt in shared und individual', () => {
    const players = [
      player('p1', 'a', [['film', 'gut'], ['musik', 'gut']]),
      player('p2', 'b', [['musik', 'gut']]),
    ]
    const profile = computeInterestProfile(players)
    // musik ist shared, film ist individual, keine Überschneidung.
    for (const topic of profile.shared) {
      expect(profile.individual.has(topic)).toBe(false)
    }
  })
})
