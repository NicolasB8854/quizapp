import { describe, it, expect } from 'vitest'
import { answeringTeamId, authorizeAction } from './authorize'
import type { GameState } from './reducer'

const teams = [
  { id: 't1', name: 'Rot', color: 'red' },
  { id: 't2', name: 'Blau', color: 'blue' },
  { id: 't3', name: 'Grün', color: 'green' },
]
const players = [
  { id: 'p1', name: 'Ana', teamId: 't1' },
  { id: 'p2', name: 'Ben', teamId: 't2' },
  { id: 'p3', name: 'Cem', teamId: 't3' },
]

function stateWith(live: Record<string, unknown>): GameState {
  return { round: { teams, players }, live } as unknown as GameState
}

describe('authorizeAction', () => {
  const board = stateWith({ kind: 'category-board', phase: 'awaiting-buzz', buzzingTeamId: null })

  it('Spieler darf nur für das eigene Team buzzern', () => {
    expect(authorizeAction(board, { type: 'BOARD_BUZZER', teamId: 't1' }, { playerId: 'p1' }).ok).toBe(true)
    expect(authorizeAction(board, { type: 'BOARD_BUZZER', teamId: 't2' }, { playerId: 'p1' }).ok).toBe(false)
    expect(authorizeAction(board, { type: 'DUEL_BUZZER', teamId: 't2' }, { playerId: 'p1' }).ok).toBe(false)
  })

  it('Bühnen-/Master-Gerät ohne Spieler bleibt frei', () => {
    expect(authorizeAction(board, { type: 'BOARD_BUZZER', teamId: 't2' }, { playerId: null }).ok).toBe(true)
    expect(authorizeAction(board, { type: 'BOARD_BUZZER', teamId: 't2' }, { playerId: 'stage-x' }).ok).toBe(true)
  })

  it('Antwort nur vom Team, das gerade dran ist', () => {
    const primary = stateWith({ kind: 'category-board', phase: 'primary-answer', buzzingTeamId: 't1' })
    expect(authorizeAction(primary, { type: 'BOARD_ANSWER', renderedIndex: 0 }, { playerId: 'p1' }).ok).toBe(true)
    expect(authorizeAction(primary, { type: 'BOARD_ANSWER', renderedIndex: 0 }, { playerId: 'p2' }).ok).toBe(false)
  })

  it('Steal geht beim Board an das nächste Team, beim Duell an den Gegner', () => {
    const boardSteal = stateWith({ kind: 'category-board', phase: 'steal-answer', buzzingTeamId: 't1' })
    expect(answeringTeamId(boardSteal)).toBe('t2')
    expect(authorizeAction(boardSteal, { type: 'BOARD_ANSWER', renderedIndex: 1 }, { playerId: 'p3' }).ok).toBe(false)
    const duelSteal = stateWith({
      kind: 'duel-1v1', phase: 'steal-answer', buzzingTeamId: 't1', duelingTeamIds: ['t1', 't3'],
    })
    expect(answeringTeamId(duelSteal)).toBe('t3')
    expect(authorizeAction(duelSteal, { type: 'DUEL_ANSWER', renderedIndex: 1 }, { playerId: 'p3' }).ok).toBe(true)
  })

  it('Team-Tipps (Blitz, Leiter) nur fürs eigene Team', () => {
    const flash = stateWith({ kind: 'flash' })
    expect(authorizeAction(flash, { type: 'FLASH_SET_ANSWER', teamId: 't2', answer: true }, { playerId: 'p1' }).ok).toBe(false)
    expect(authorizeAction(flash, { type: 'LADDER_SET_ANSWER', teamId: 't1', renderedIndex: 2 }, { playerId: 'p1' }).ok).toBe(true)
  })

  it('Spotlight/Fachrunde: nur der aktive Spieler antwortet, Steal nur das nächste Team', () => {
    const experts = stateWith({ kind: 'experts', phase: 'primary', activePlayerId: 'p1' })
    expect(authorizeAction(experts, { type: 'EXPERTS_PRIMARY_ANSWER', renderedIndex: 0 }, { playerId: 'p1' }).ok).toBe(true)
    expect(authorizeAction(experts, { type: 'EXPERTS_PRIMARY_ANSWER', renderedIndex: 0 }, { playerId: 'p2' }).ok).toBe(false)
    const spot = stateWith({ kind: 'player-spotlight', phase: 'steal', activePlayerId: 'p1' })
    expect(authorizeAction(spot, { type: 'SPOTLIGHT_STEAL_ANSWER', renderedIndex: 0 }, { playerId: 'p2' }).ok).toBe(true)
    expect(authorizeAction(spot, { type: 'SPOTLIGHT_STEAL_ANSWER', renderedIndex: 0 }, { playerId: 'p3' }).ok).toBe(false)
  })

  it('Sprinter: Sprint nur aktives Team, Rebound nur das gebuzzte Team', () => {
    const sprint = stateWith({ kind: 'sprinter', phase: 'answering', activeTeamId: 't1', reboundTeamId: null })
    expect(authorizeAction(sprint, { type: 'SPRINTER_ANSWER', renderedIndex: 0 }, { playerId: 'p2' }).ok).toBe(false)
    expect(authorizeAction(sprint, { type: 'SPRINTER_REBOUND_BUZZ', teamId: 't1' }, { playerId: 'p2' }).ok).toBe(false)
    expect(authorizeAction(sprint, { type: 'SPRINTER_REBOUND_BUZZ', teamId: 't2' }, { playerId: 'p2' }).ok).toBe(true)
    const rebound = stateWith({ kind: 'sprinter', phase: 'rebound-answer', activeTeamId: 't1', reboundTeamId: 't2' })
    expect(authorizeAction(rebound, { type: 'SPRINTER_REBOUND_ANSWER', renderedIndex: 0 }, { playerId: 'p2' }).ok).toBe(true)
    expect(authorizeAction(rebound, { type: 'SPRINTER_REBOUND_ANSWER', renderedIndex: 0 }, { playerId: 'p1' }).ok).toBe(false)
  })

  it('Profilangaben nur für den eigenen Spieler', () => {
    const lobby = stateWith({ kind: 'flash' })
    const avatar = { colorHex: '#fff', photoDataUrl: null }
    expect(authorizeAction(lobby, { type: 'SET_PLAYER_AVATAR', playerId: 'p1', avatar }, { playerId: 'p1' }).ok).toBe(true)
    expect(authorizeAction(lobby, { type: 'SET_PLAYER_AVATAR', playerId: 'p2', avatar }, { playerId: 'p1' }).ok).toBe(false)
    expect(authorizeAction(lobby, { type: 'SET_PLAYER_NAME', playerId: 'p2', name: 'x' }, { playerId: null }).ok).toBe(true)
  })

  it('Host-Aktionen: Spieler abgelehnt, Host erlaubt (auch wenn er mitspielt)', () => {
    const st = stateWith({ kind: 'flash' })
    expect(authorizeAction(st, { type: 'FLASH_NEXT' }, { playerId: 'p2', role: 'player' }).ok).toBe(false)
    expect(authorizeAction(st, { type: 'FINISH_MODE' }, { playerId: 'p2', role: 'player' }).ok).toBe(false)
    expect(authorizeAction(st, { type: 'FLASH_NEXT' }, { playerId: 'p1', role: 'host' }).ok).toBe(true)
    expect(authorizeAction(st, { type: 'RESTART_MATCH' }, { playerId: 'stage', role: 'host' }).ok).toBe(true)
  })

  it('Team-Wechsel und Entfernen nur für sich selbst, außer Host', () => {
    const st = stateWith({ kind: 'flash' })
    expect(authorizeAction(st, { type: 'MOVE_PLAYER_TO_TEAM', playerId: 'p2', teamId: 't1' }, { playerId: 'p2', role: 'player' }).ok).toBe(true)
    expect(authorizeAction(st, { type: 'MOVE_PLAYER_TO_TEAM', playerId: 'p3', teamId: 't1' }, { playerId: 'p2', role: 'player' }).ok).toBe(false)
    expect(authorizeAction(st, { type: 'REMOVE_PLAYER', playerId: 'p3' }, { playerId: 'p1', role: 'host' }).ok).toBe(true)
  })

  it('Spieler-Aktionen bleiben für Spieler erlaubt', () => {
    const st = stateWith({ kind: 'experts', phase: 'question-shown', activePlayerId: 'p2' })
    expect(authorizeAction(st, { type: 'EXPERTS_SHOW_OPTIONS' }, { playerId: 'p2', role: 'player' }).ok).toBe(true)
    expect(authorizeAction(st, { type: 'SPRINTER_TIME_UP' }, { playerId: 'p2', role: 'player' }).ok).toBe(true)
  })
})
