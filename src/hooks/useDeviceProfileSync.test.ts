import { describe, it, expect } from 'vitest'
import type { GameState } from '@quizapp/shared'
import { extractMyAnswer } from './useDeviceProfileSync'

const q = { id: 'q1', topic: 'chemie' }

function st(live: Record<string, unknown>): GameState {
  return { live } as unknown as GameState
}

describe('extractMyAnswer', () => {
  it('erkennt die eigene, bewertete Fachrunden-Antwort', () => {
    const s = st({ kind: 'experts', activePlayerId: 'me', activeQuestion: q, primaryOutcome: 'correct' })
    expect(extractMyAnswer(s, 'me')).toEqual({ key: 'experts:q1', topic: 'chemie', correct: true })
  })

  it('ignoriert fremde Züge und unbewertete Fragen', () => {
    expect(
      extractMyAnswer(st({ kind: 'experts', activePlayerId: 'other', activeQuestion: q, primaryOutcome: 'wrong' }), 'me'),
    ).toBeNull()
    expect(
      extractMyAnswer(st({ kind: 'player-spotlight', activePlayerId: 'me', activeQuestion: q, primaryOutcome: null }), 'me'),
    ).toBeNull()
  })

  it('Timeout zählt als falsch, Elimination erst nach Auflösung', () => {
    expect(
      extractMyAnswer(st({ kind: 'experts', activePlayerId: 'me', activeQuestion: q, primaryOutcome: 'timeout' }), 'me')
        ?.correct,
    ).toBe(false)
    expect(
      extractMyAnswer(st({ kind: 'elimination', activePlayerId: 'me', activeQuestion: q, phase: 'answering', lastOutcome: null }), 'me'),
    ).toBeNull()
    expect(
      extractMyAnswer(st({ kind: 'elimination', activePlayerId: 'me', activeQuestion: q, phase: 'revealed', lastOutcome: 'wrong' }), 'me'),
    ).toEqual({ key: 'elimination:q1', topic: 'chemie', correct: false })
  })
})
