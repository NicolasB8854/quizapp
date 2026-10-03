import { describe, it, expect, vi, afterEach } from 'vitest'
import { createReducer, INITIAL_STATE, picturePoints, type GameState } from './reducer'
import { setQuestionCatalog, getAllQuestions } from '../lib/questions'
import type { Question } from '../types/question'

const reducer = createReducer({ getAskedQuestionIds: () => new Set<string>() })

function pic(id: string, difficulty: 1 | 2 | 3 | 4 | 5): Question {
  return {
    id, type: 'multiple-choice', category: 'allgemeinbildung', topic: 'natur', difficulty,
    question: 'Welches Tier ist das?', options: ['Okapi', 'Zebra', 'Giraffe', 'Tapir'], correctIndex: 0,
    explanation: 'x', image: `/img/pictures/${id}.jpg`, tags: [],
  } as unknown as Question
}

function boot(): GameState {
  let s = reducer(INITIAL_STATE, { type: 'SET_MODE_SELECTION', modeIds: ['blindguess'] })
  s = reducer(s, { type: 'GO_TO_LOBBY' })
  const teams = s.round!.teams
  s.round!.players.forEach((p, i) => {
    s = reducer(s, { type: 'MOVE_PLAYER_TO_TEAM', playerId: p.id, teamId: teams[i % teams.length].id })
  })
  return reducer(s, { type: 'START_PLAYING' })
}

describe('Bilderrätsel', () => {
  const original = getAllQuestions()
  afterEach(() => {
    setQuestionCatalog(original)
    vi.restoreAllMocks()
  })

  it('Punkte fallen von 300 auf 100 über 10 s', () => {
    expect(picturePoints(0)).toBe(300)
    expect(picturePoints(5000)).toBe(200)
    expect(picturePoints(20000)).toBe(100)
  })

  it('zieht nur Bild-Fragen, wertet schnelle richtige Antworten höher, endet nach 6 Bildern', () => {
    setQuestionCatalog([...original, ...[1, 2, 2, 3, 4, 5, 3].map((d, i) => pic(`p${i}`, d as 1))])
    let s = boot()
    expect(s.live?.kind).toBe('blindguess')
    if (s.live?.kind !== 'blindguess') throw new Error()
    expect(s.live.activeQuestion?.image).toBeTruthy()
    const [t1, t2] = s.round!.teams.map((t) => t.id)
    const start = s.live.startedAt!
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(start + 1000)
    s = reducer(s, { type: 'PICTURE_SET_ANSWER', teamId: t1, renderedIndex: s.live.correctRenderedIndex })
    now.mockReturnValue(start + 9000)
    if (s.live?.kind !== 'blindguess') throw new Error()
    s = reducer(s, { type: 'PICTURE_SET_ANSWER', teamId: t2, renderedIndex: s.live.correctRenderedIndex })
    s = reducer(s, { type: 'PICTURE_REVEAL' })
    if (s.live?.kind !== 'blindguess') throw new Error()
    expect(s.live.scores[t1]).toBeGreaterThan(s.live.scores[t2])
    for (let i = 0; i < 5; i++) {
      s = reducer(s, { type: 'PICTURE_NEXT' })
      if (s.live?.kind === 'blindguess') s = reducer(s, { type: 'PICTURE_REVEAL' })
    }
    s = reducer(s, { type: 'PICTURE_NEXT' })
    expect(s.phase).toBe('scoreboard')
  })

  it('Text-Modi ziehen keine Bild-Fragen', async () => {
    setQuestionCatalog([...original, pic('px', 3)])
    const { getAllMultipleChoice } = await import('../lib/questions')
    expect(getAllMultipleChoice().some((q) => q.image)).toBe(false)
  })
})
