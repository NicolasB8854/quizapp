import { describe, expect, it } from 'vitest'
import { createReducer, INITIAL_STATE, scoreYears, HUM_STEAL_POINTS, HUM_TEAM_POINTS, YEAR_CURVE, type GameState, type HumLive, type YearLive } from './reducer'
import { authorizeAction } from './authorize'
import { SONGS, yearPoints } from '../data/songs'
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

describe('Songkatalog', () => {
  it('genug Songs, eindeutig, plausible Jahre, Fakt vorhanden', () => {
    expect(SONGS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length)
    for (const s of SONGS) {
      expect(s.year).toBeGreaterThanOrEqual(1950)
      expect(s.year).toBeLessThanOrEqual(new Date().getFullYear())
      expect(s.fact.length).toBeGreaterThan(10)
    }
    for (const d of [1, 2] as const) expect(SONGS.filter((s) => s.difficulty === d).length).toBeGreaterThanOrEqual(15)
  })
})

describe('Welches Jahr?', () => {
  it('Punktestufen und Bonus', () => {
    expect([0, 1, 3, 5, 6].map(yearPoints)).toEqual([300, 200, 100, 50, 0])
    const r = scoreYears(1990, { a: 1990, b: 1993, c: null })
    expect(r.a).toMatchObject({ diff: 0, closest: true, points: 400 })
    expect(r.b).toMatchObject({ diff: 3, closest: false, points: 100 })
    expect(r.c).toBeNull()
  })
  it('Ablauf: Tipps, ungültige Jahre ignoriert, Auflösung, 8 Songs', () => {
    let s = start('song-year')
    const [t1, t2] = s.round!.teams.map((t) => t.id)
    const live = () => s.live as YearLive
    expect(live().kind).toBe('song-year')
    const y = live().song!.year
    s = reducer(s, { type: 'YEAR_SET_GUESS', teamId: t1, year: 1800 })
    s = reducer(s, { type: 'YEAR_SET_GUESS', teamId: t1, year: 1990.5 })
    expect(live().guesses[t1]).toBeNull()
    s = reducer(s, { type: 'YEAR_SET_GUESS', teamId: t1, year: y })
    s = reducer(s, { type: 'YEAR_SET_GUESS', teamId: t2, year: y - 4 })
    s = reducer(s, { type: 'YEAR_REVEAL' })
    expect(live().scores[t1]).toBe(400)
    expect(live().scores[t2]).toBe(50)
    const seen = new Set([live().song!.id])
    for (let i = 1; i < YEAR_CURVE.length; i++) {
      s = reducer(s, { type: 'YEAR_NEXT' })
      seen.add(live().song!.id)
      s = reducer(s, { type: 'YEAR_REVEAL' })
    }
    expect(seen.size).toBe(YEAR_CURVE.length)
    s = reducer(s, { type: 'YEAR_NEXT' })
    expect(s.live?.kind === 'song-year').toBe(false)
  })
})

describe('Summ-Duell', () => {
  it('Teams wechseln sich ab, Summer kommt aus dem aktiven Team', () => {
    let s = start('hum-duel')
    const live = () => s.live as HumLive
    expect(live().kind).toBe('hum-duel')
    const hummers: string[] = []
    for (let i = 0; i < live().totalTurns; i++) {
      const l = live()
      const hummer = s.round!.players.find((p) => p.id === l.hummerId)!
      expect(hummer.teamId).toBe(l.activeTeamId)
      expect(l.turnTeams[i]).toBe(l.activeTeamId)
      hummers.push(hummer.id)
      s = reducer(s, { type: 'HUM_GUESSED' })
      if (i < l.totalTurns - 1) s = reducer(s, { type: 'HUM_NEXT' })
    }
    // Zwei Teams à zwei Spieler: Summer wechseln innerhalb des Teams.
    expect(new Set(hummers).size).toBeGreaterThan(2)
  })
  it('Treffer und Steal geben die richtigen Punkte', () => {
    let s = start('hum-duel')
    const live = () => s.live as HumLive
    const active = live().activeTeamId!
    const other = s.round!.teams.find((t) => t.id !== active)!.id
    s = reducer(s, { type: 'HUM_GUESSED' })
    expect(live().scores[active]).toBe(HUM_TEAM_POINTS)
    s = reducer(s, { type: 'HUM_NEXT' })
    const active2 = live().activeTeamId!
    expect(active2).toBe(other)
    s = reducer(s, { type: 'HUM_FAIL' })
    expect(live().phase).toBe('steal')
    s = reducer(s, { type: 'HUM_STEAL', teamId: active2 }) // eigenes Team darf nicht stehlen
    expect(live().scores[active2]).toBe(0)
    expect(live().outcome).toMatchObject({ kind: 'none' })
  })
  it('Steal durch Gegner', () => {
    let s = start('hum-duel')
    const live = () => s.live as HumLive
    const active = live().activeTeamId!
    const other = s.round!.teams.find((t) => t.id !== active)!.id
    s = reducer(s, { type: 'HUM_FAIL' })
    s = reducer(s, { type: 'HUM_STEAL', teamId: other })
    expect(live().scores[other]).toBe(HUM_STEAL_POINTS)
    expect(live().outcome).toMatchObject({ kind: 'steal', teamId: other })
  })
  it('Rechte: bewerten darf nur, wer summt, oder der Host; Steal/Weiter nur Host', () => {
    const s = start('hum-duel')
    const l = s.live as HumLive
    const hummer = l.hummerId!
    const someoneElse = s.round!.players.find((p) => p.id !== hummer)!.id
    expect(authorizeAction(s, { type: 'HUM_GUESSED' }, { playerId: hummer, role: 'player' }).ok).toBe(true)
    expect(authorizeAction(s, { type: 'HUM_GUESSED' }, { playerId: someoneElse, role: 'player' }).ok).toBe(false)
    expect(authorizeAction(s, { type: 'HUM_GUESSED' }, { playerId: someoneElse, role: 'host' }).ok).toBe(true)
    expect(authorizeAction(s, { type: 'HUM_NEXT' }, { playerId: hummer, role: 'player' }).ok).toBe(false)
    expect(authorizeAction(s, { type: 'YEAR_REVEAL' }, { playerId: hummer, role: 'player' }).ok).toBe(false)
  })
})
