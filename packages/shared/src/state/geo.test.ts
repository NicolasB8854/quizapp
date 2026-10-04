import { describe, expect, it } from 'vitest'
import { createReducer, INITIAL_STATE, scoreGeo, GEO_CURVE, type GameState, type GeoLive } from './reducer'
import { authorizeAction } from './authorize'
import { PLACES } from '../data/places'
import { MAP_HEIGHT, MAP_WIDTH, distanceKm, fromMap, geoPoints, toMap } from '../lib/geo'

const reducer = createReducer({ getAskedQuestionIds: () => new Set<string>() })

function startGeo(): GameState {
  let s = reducer(INITIAL_STATE, { type: 'SET_MODE_SELECTION', modeIds: ['geoguess'] })
  s = reducer(s, { type: 'GO_TO_LOBBY' })
  const [t1, t2] = s.round!.teams
  for (const [i, p] of s.round!.players.entries()) {
    s = reducer(s, { type: 'MOVE_PLAYER_TO_TEAM', playerId: p.id, teamId: i % 2 ? t2.id : t1.id })
  }
  return reducer(s, { type: 'START_PLAYING' })
}
const geo = (s: GameState) => s.live as GeoLive

describe('Geo-Helfer', () => {
  it('Entfernung Berlin–Paris ≈ 878 km', () => {
    expect(distanceKm({ lat: 52.52, lon: 13.405 }, { lat: 48.857, lon: 2.352 })).toBeGreaterThan(860)
    expect(distanceKm({ lat: 52.52, lon: 13.405 }, { lat: 48.857, lon: 2.352 })).toBeLessThan(890)
  })
  it('Projektion hin und zurück', () => {
    const p = fromMap(toMap({ lat: -33.869, lon: 151.209 }).x, toMap({ lat: -33.869, lon: 151.209 }).y)
    expect(p.lat).toBeCloseTo(-33.869, 2)
    expect(p.lon).toBeCloseTo(151.209, 2)
    expect(toMap({ lat: 85, lon: -180 })).toEqual({ x: 0, y: 0 })
    expect(toMap({ lat: -60, lon: 180 })).toEqual({ x: MAP_WIDTH, y: MAP_HEIGHT })
  })
  it('Punktestufen', () => {
    expect([geoPoints(40), geoPoints(300), geoPoints(1200), geoPoints(5000)]).toEqual([300, 200, 100, 0])
  })
})

describe('Ortskatalog', () => {
  it('genug Orte pro Stufe, eindeutig und gültig', () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length)
    for (const d of [1, 2, 3, 4, 5]) expect(PLACES.filter((p) => p.difficulty === d).length).toBeGreaterThanOrEqual(10)
    for (const p of PLACES) {
      expect(p.fact.trim().length).toBeGreaterThan(10)
      expect(p.lat).toBeGreaterThanOrEqual(-60)
      expect(p.lat).toBeLessThanOrEqual(85)
    }
  })
})

describe('Wo liegt das? (Reducer)', () => {
  it('startet mit Ort, Nadeln verschiebbar, Auflösung zählt Punkte + Bonus', () => {
    let s = startGeo()
    const live = geo(s)
    expect(live.kind).toBe('geoguess')
    expect(live.place).not.toBeNull()
    expect(live.place!.difficulty).toBe(GEO_CURVE[0])
    const [t1, t2] = s.round!.teams.map((t) => t.id)
    const target = live.place!
    s = reducer(s, { type: 'GEO_SET_PIN', teamId: t1, lat: 0, lon: 0 })
    s = reducer(s, { type: 'GEO_SET_PIN', teamId: t1, lat: target.lat + 0.1, lon: target.lon })
    s = reducer(s, { type: 'GEO_SET_PIN', teamId: t2, lat: target.lat - 10, lon: target.lon })
    expect(geo(s).pins[t1]!.lat).toBeCloseTo(target.lat + 0.1, 2)
    s = reducer(s, { type: 'GEO_REVEAL' })
    const r = geo(s).lastResult
    expect(r[t1]).toMatchObject({ closest: true, points: 400 })
    expect(r[t2]!.closest).toBe(false)
    expect(geo(s).scores[t1]).toBe(400)
    // Nach der Auflösung keine Nadeln mehr
    const after = reducer(s, { type: 'GEO_SET_PIN', teamId: t2, lat: target.lat, lon: target.lon })
    expect(geo(after).pins[t2]!.lat).toBeCloseTo(target.lat - 10, 2)
  })

  it('ungültige Koordinaten werden ignoriert', () => {
    let s = startGeo()
    const t1 = s.round!.teams[0].id
    s = reducer(s, { type: 'GEO_SET_PIN', teamId: t1, lat: 200, lon: 0 })
    s = reducer(s, { type: 'GEO_SET_PIN', teamId: t1, lat: Number.NaN, lon: 0 })
    expect(geo(s).pins[t1]).toBeNull()
  })

  it('läuft 8 Orte ohne Wiederholung und beendet den Modus', () => {
    let s = startGeo()
    const seen = new Set<string>()
    for (let i = 0; i < GEO_CURVE.length; i++) {
      seen.add(geo(s).place!.id)
      s = reducer(s, { type: 'GEO_REVEAL' })
      s = reducer(s, { type: 'GEO_NEXT' })
    }
    expect(seen.size).toBe(GEO_CURVE.length)
    expect(s.live?.kind === 'geoguess').toBe(false)
  })

  it('Gleichstand: beide bekommen den Bonus, Team ohne Nadel 0', () => {
    const r = scoreGeo({ lat: 0, lon: 0 }, { a: { lat: 1, lon: 0 }, b: { lat: -1, lon: 0 }, c: null })
    expect(r.a!.closest && r.b!.closest).toBe(true)
    expect(r.c).toBeNull()
  })

  it('Rechte: Nadel nur fürs eigene Team, Auflösen nur Host', () => {
    const s = startGeo()
    const [t1, t2] = s.round!.teams.map((t) => t.id)
    const p1 = s.round!.players.find((p) => p.teamId === t1)!
    expect(authorizeAction(s, { type: 'GEO_SET_PIN', teamId: t1, lat: 1, lon: 1 }, { playerId: p1.id, role: 'player' }).ok).toBe(true)
    expect(authorizeAction(s, { type: 'GEO_SET_PIN', teamId: t2, lat: 1, lon: 1 }, { playerId: p1.id, role: 'player' }).ok).toBe(false)
    expect(authorizeAction(s, { type: 'GEO_REVEAL' }, { playerId: p1.id, role: 'player' }).ok).toBe(false)
  })
})
