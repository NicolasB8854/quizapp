import { describe, expect, it } from 'vitest'
import { createReducer, INITIAL_STATE, GEO_HINTS_CURVE, scoreGeo, type GameState, type GeoLive } from './reducer'
import { authorizeAction } from './authorize'
import { GEO_EVENTS, GEO_RIDDLES, GEO_SHAPES } from '../data/places'
import type { GameModeId } from '../types/round'

const reducer = createReducer({ getAskedQuestionIds: () => new Set<string>() })

function start(mode: GameModeId): GameState {
  let s = reducer(INITIAL_STATE, { type: 'SET_MODE_SELECTION', modeIds: [mode] })
  s = reducer(s, { type: 'GO_TO_LOBBY' })
  const teams = s.round!.teams
  s.round!.players.forEach((p, i) => {
    s = reducer(s, { type: 'MOVE_PLAYER_TO_TEAM', playerId: p.id, teamId: teams[i % teams.length].id })
  })
  return reducer(s, { type: 'START_PLAYING' })
}
const geo = (s: GameState) => s.live as GeoLive

describe('Geo-Kataloge', () => {
  it('Heißer Draht: 4 Hinweise pro Ort, alle Stufen 2–5 vertreten', () => {
    expect(GEO_RIDDLES.length).toBeGreaterThanOrEqual(30)
    for (const r of GEO_RIDDLES) expect(r.hints).toHaveLength(4)
    for (const d of [2, 3, 4, 5]) expect(GEO_RIDDLES.some((r) => r.difficulty === d)).toBe(true)
  })
  it('Zeitreise: jedes Ereignis hat Text, Ort und Fakt', () => {
    expect(GEO_EVENTS.length).toBeGreaterThanOrEqual(40)
    for (const e of GEO_EVENTS) expect(e.prompt && e.name && e.fact).toBeTruthy()
  })
  it('Länder-Umriss: Pfad, Radius, Drehung', () => {
    expect(GEO_SHAPES.length).toBeGreaterThanOrEqual(50)
    for (const c of GEO_SHAPES) {
      expect(c.path?.startsWith('M')).toBe(true)
      expect(c.radiusKm).toBeGreaterThan(0)
      expect(Math.abs(c.rotate ?? 0)).toBeLessThanOrEqual(180)
    }
  })
  it('IDs sind über alle Kataloge eindeutig', () => {
    const ids = [...GEO_RIDDLES, ...GEO_EVENTS, ...GEO_SHAPES].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Heißer Draht', () => {
  it('Host deckt Hinweise auf, frühe Nadel zählt doppelt', () => {
    let s = start('geo-hints')
    expect(geo(s).variant).toBe('hints')
    expect(geo(s).totalRounds).toBe(GEO_HINTS_CURVE.length)
    expect(geo(s).revealedHints).toBe(1)
    const [t1, t2] = s.round!.teams.map((t) => t.id)
    const p = geo(s).place!
    s = reducer(s, { type: 'GEO_SET_PIN', teamId: t1, lat: p.lat, lon: p.lon })
    for (let i = 0; i < 5; i++) s = reducer(s, { type: 'GEO_HINT' })
    expect(geo(s).revealedHints).toBe(4)
    s = reducer(s, { type: 'GEO_SET_PIN', teamId: t2, lat: p.lat, lon: p.lon })
    s = reducer(s, { type: 'GEO_REVEAL' })
    // Beide exakt: t1 bei Hinweis 1 → 300×2 + 100 Bonus, t2 bei Hinweis 4 → 300 + 100
    expect(geo(s).lastResult[t1]!.points).toBe(700)
    expect(geo(s).lastResult[t2]!.points).toBe(400)
  })
  it('Hinweis aufdecken nur Host', () => {
    const s = start('geo-hints')
    const p = s.round!.players[0]
    expect(authorizeAction(s, { type: 'GEO_HINT' }, { playerId: p.id, role: 'player' }).ok).toBe(false)
    expect(authorizeAction(s, { type: 'GEO_HINT' }, { playerId: p.id, role: 'host' }).ok).toBe(true)
  })
})

describe('Länder-Umriss & Zeitreise', () => {
  it('Treffer innerhalb des Landes = 0 km', () => {
    const r = scoreGeo({ lat: 50, lon: 10 }, { a: { lat: 51, lon: 10 }, b: null }, { radiusKm: 300 })
    expect(r.a!.km).toBe(0)
    expect(r.a!.points).toBe(300)
  })
  it('Modi starten mit passendem Katalog und laufen durch', () => {
    for (const [mode, variant] of [['geo-shape', 'shape'], ['geo-history', 'history']] as const) {
      let s = start(mode)
      expect(geo(s).variant).toBe(variant)
      const seen = new Set<string>()
      const total = geo(s).totalRounds
      for (let i = 0; i < total; i++) {
        seen.add(geo(s).place!.id)
        s = reducer(s, { type: 'GEO_REVEAL' })
        s = reducer(s, { type: 'GEO_NEXT' })
      }
      expect(seen.size).toBe(8)
      expect(s.live?.kind === 'geoguess').toBe(false)
    }
  })
})
