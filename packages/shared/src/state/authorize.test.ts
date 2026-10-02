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
})
