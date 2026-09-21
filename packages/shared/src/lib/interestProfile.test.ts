import { describe, it, expect } from 'vitest'
import {
  aggregatePlayerInterests,
  computeInterestProfile,
} from './interestProfile'
import type { Player, SkillLevel } from '../types/round'

function player(id: string, teamId: string, interests: Array<[string, SkillLevel]>): Player {
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

/** Variante mit Sub-Interessen-Tags (Session AB). */
function playerWithTags(
  id: string,
  teamId: string,
  interests: Array<[string, SkillLevel, string[]?]>,
): Player {
  return {
    id,
    name: '',
    teamId,
    interests: interests.map(([topic, level, tags]) => ({
      topic: topic as Player['interests'][number]['topic'],
      level,
      tags,
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
      player('p1', 'a', [['film', 3], ['musik', 2]]),
      player('p2', 'b', [['musik', 5], ['sport', 3]]),
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
      player('p1', 'a', [['film', 3], ['musik', 2]]),
      player('p2', 'b', [['musik', 3]]),
      player('p3', 'a', [['sport', 5]]),
    ]
    const profile = computeInterestProfile(players)
    expect(profile.shared.has('musik')).toBe(true)
    expect(profile.individual.has('film')).toBe(true)
    expect(profile.individual.has('sport')).toBe(true)
    expect(profile.shared.has('film')).toBe(false)
  })

  it('levelPerTopic nimmt das höchste Level (Max-Aggregation)', () => {
    const players = [
      player('p1', 'a', [['musik', 2]]),
      player('p2', 'b', [['musik', 5]]),
      player('p3', 'a', [['musik', 3]]),
    ]
    const profile = computeInterestProfile(players)
    expect(profile.levelPerTopic.get('musik')).toBe(5)
  })

  it('individuelles Topic behält sein einzelnes Level', () => {
    const players = [player('p1', 'a', [['film', 2]])]
    const profile = computeInterestProfile(players)
    expect(profile.levelPerTopic.get('film')).toBe(2)
  })

  it('kein Topic doppelt in shared und individual', () => {
    const players = [
      player('p1', 'a', [['film', 3], ['musik', 3]]),
      player('p2', 'b', [['musik', 3]]),
    ]
    const profile = computeInterestProfile(players)
    // musik ist shared, film ist individual, keine Überschneidung.
    for (const topic of profile.shared) {
      expect(profile.individual.has(topic)).toBe(false)
    }
  })

  describe('tagsPerTopic (Session AB)', () => {
    it('leere Sub-Interessen ergeben leere tagsPerTopic', () => {
      const profile = computeInterestProfile([player('p1', 'a', [['film', 3]])])
      // Field existiert; keine Einträge, weil keine Tags gepflegt.
      expect(profile.tagsPerTopic?.get('film')).toBeUndefined()
    })

    it('Sub-Interessen eines Spielers landen normalisiert in tagsPerTopic', () => {
      const profile = computeInterestProfile([
        playerWithTags('p1', 'a', [['sport', 3, ['Basketball', 'Formel 1']]]),
      ])
      const sportTags = profile.tagsPerTopic?.get('sport')
      expect(sportTags).toBeDefined()
      expect(sportTags!.has('basketball')).toBe(true)
      expect(sportTags!.has('formel 1')).toBe(true)
    })

    it('Sub-Interessen mehrerer Spieler werden pro Topic zur Union', () => {
      const profile = computeInterestProfile([
        playerWithTags('p1', 'a', [['sport', 3, ['Basketball']]]),
        playerWithTags('p2', 'b', [['sport', 3, ['Tennis', 'basketball']]]),
      ])
      const sportTags = profile.tagsPerTopic?.get('sport')
      expect(sportTags).toBeDefined()
      // Dedupliziert case-insensitive: nur ein „basketball"-Eintrag.
      expect(Array.from(sportTags!).sort()).toEqual(['basketball', 'tennis'])
    })

    it('Whitespace wird beim Normalisieren entfernt', () => {
      const profile = computeInterestProfile([
        playerWithTags('p1', 'a', [['film', 3, ['  Marvel  ']]]),
      ])
      const filmTags = profile.tagsPerTopic?.get('film')
      expect(filmTags?.has('marvel')).toBe(true)
    })
  })
})
