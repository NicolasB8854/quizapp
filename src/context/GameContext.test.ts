import { describe, it, expect, beforeEach, vi } from 'vitest'
import { INITIAL_STATE, reducer, type GameState } from './GameContext'
import { getMultipleChoiceByTopic, getTrueFalsePool } from '@/lib/questions'

/**
 * Reducer-Tests. Der Reducer ist die zentrale Wahrheitsquelle für Spielzustand;
 * alle Regressionen hier sind teuer, deshalb hoher Coverage-Bedarf.
 *
 * Konventionen:
 * - Math.random wird auf 0 fixiert → `pickQuestion` liefert reproducibel das erste
 *   Poolelement (nach Filter).
 * - localStorage wird vor jedem Test geleert (Duplicate-Check-Historie).
 */

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

// Kleiner Helper: Setup → Lobby → Playing für einen bestimmten Modus.
function bootIntoPlaying(modeId: 'category-duel' | 'flash'): GameState {
  let state = INITIAL_STATE
  state = reducer(state, { type: 'SET_MODE_SELECTION', modeIds: [modeId] })
  state = reducer(state, { type: 'GO_TO_LOBBY' })
  state = reducer(state, { type: 'START_PLAYING' })
  return state
}

describe('reducer — Setup / Draft', () => {
  it('startet im setup-Phase mit den beiden Default-Teams und category-duel gewählt', () => {
    expect(INITIAL_STATE.phase).toBe('setup')
    expect(INITIAL_STATE.draft.teams).toHaveLength(2)
    expect(INITIAL_STATE.draft.selectedModes).toEqual(['category-duel'])
  })

  it('SET_TEAM_NAME ändert nur den betroffenen Team-Namen', () => {
    const next = reducer(INITIAL_STATE, {
      type: 'SET_TEAM_NAME',
      teamId: 'team-a',
      name: 'Team Awesome',
    })
    expect(next.draft.teams[0].name).toBe('Team Awesome')
    expect(next.draft.teams[1].name).toBe(INITIAL_STATE.draft.teams[1].name)
  })

  it('TOGGLE_MODE fügt ready-Modi hinzu und entfernt sie beim zweiten Klick', () => {
    let s = reducer(INITIAL_STATE, { type: 'TOGGLE_MODE', modeId: 'flash' })
    expect(s.draft.selectedModes).toContain('flash')
    s = reducer(s, { type: 'TOGGLE_MODE', modeId: 'flash' })
    expect(s.draft.selectedModes).not.toContain('flash')
  })

  it('TOGGLE_MODE ignoriert planned-Modi', () => {
    const before = INITIAL_STATE.draft.selectedModes
    const s = reducer(INITIAL_STATE, { type: 'TOGGLE_MODE', modeId: 'points-ladder' })
    expect(s.draft.selectedModes).toEqual(before)
  })

  it('SET_MODE_SELECTION ersetzt die Auswahl und filtert planned-IDs raus', () => {
    const s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['flash', 'points-ladder', 'category-duel'],
    })
    expect(s.draft.selectedModes).toEqual(['flash', 'category-duel'])
  })

  it('GO_TO_LOBBY erzeugt eine Runde mit Room-Code und übernimmt Modi', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    expect(s.phase).toBe('lobby')
    expect(s.round).not.toBeNull()
    expect(s.round!.gameModes).toEqual(['category-duel'])
    expect(s.round!.teams).toHaveLength(2)
    expect(s.round!.roomCode).toMatch(/^[A-Z0-9]{4}$/)
  })

  it('GO_TO_LOBBY tut nichts, wenn keine Modi gewählt sind', () => {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: [],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    expect(s.phase).toBe('setup')
    expect(s.round).toBeNull()
  })
})

describe('reducer — Themen-Battle', () => {
  it('START_PLAYING initialisiert die Live-Session mit Team-Scores auf 0', () => {
    const s = bootIntoPlaying('category-duel')
    expect(s.phase).toBe('playing')
    expect(s.live?.kind).toBe('category-duel')
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    expect(s.live.scores).toEqual({ 'team-a': 0, 'team-b': 0 })
    expect(s.live.currentTeamIndex).toBe(0)
    expect(s.live.usedTopics).toEqual([])
  })

  it('CD_PICK_TOPIC zieht eine Frage und liefert konsistente Shuffle-Metadaten', () => {
    let s = bootIntoPlaying('category-duel')
    s = reducer(s, { type: 'CD_PICK_TOPIC', topic: 'film' })
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    expect(s.live.phase).toBe('answering')
    expect(s.live.activeQuestion).not.toBeNull()
    expect(s.live.shuffledOptions).toHaveLength(4)
    // correctRenderedIndex muss auf die tatsächlich richtige Option zeigen.
    const q = s.live.activeQuestion!
    expect(s.live.shuffledOptions[s.live.correctRenderedIndex]).toBe(
      q.options[q.correctIndex],
    )
  })

  it('CD_SELECT_ANSWER: richtig → Punkte für Team am Zug', () => {
    let s = bootIntoPlaying('category-duel')
    s = reducer(s, { type: 'CD_PICK_TOPIC', topic: 'film' })
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    const correctIdx = s.live.correctRenderedIndex
    s = reducer(s, { type: 'CD_SELECT_ANSWER', renderedIndex: correctIdx })
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.scores['team-a']).toBe(s.live.pointsPerQuestion)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('CD_SELECT_ANSWER: falsch → keine Punkte', () => {
    let s = bootIntoPlaying('category-duel')
    s = reducer(s, { type: 'CD_PICK_TOPIC', topic: 'film' })
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    const wrongIdx = (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length
    s = reducer(s, { type: 'CD_SELECT_ANSWER', renderedIndex: wrongIdx })
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('CD_NEXT_TURN wechselt Team, verbucht Topic und Question-ID', () => {
    let s = bootIntoPlaying('category-duel')
    s = reducer(s, { type: 'CD_PICK_TOPIC', topic: 'film' })
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    const askedId = s.live.activeQuestion!.id
    s = reducer(s, { type: 'CD_SELECT_ANSWER', renderedIndex: 0 })
    s = reducer(s, { type: 'CD_NEXT_TURN' })
    if (s.live?.kind !== 'category-duel') throw new Error('unreachable')
    expect(s.live.currentTeamIndex).toBe(1)
    expect(s.live.phase).toBe('pick-topic')
    expect(s.live.usedTopics).toContain('film')
    expect(s.live.usedQuestionIds).toContain(askedId)
    expect(s.live.activeQuestion).toBeNull()
  })

  it('CD_PICK_TOPIC schließt bereits verbrauchte Topics aus', () => {
    let s = bootIntoPlaying('category-duel')
    s = reducer(s, { type: 'CD_PICK_TOPIC', topic: 'film' })
    s = reducer(s, { type: 'CD_SELECT_ANSWER', renderedIndex: 0 })
    s = reducer(s, { type: 'CD_NEXT_TURN' })
    // Zweites CD_PICK_TOPIC auf gleichen Topic → wird ignoriert.
    const before = s.live
    s = reducer(s, { type: 'CD_PICK_TOPIC', topic: 'film' })
    expect(s.live).toBe(before)
  })

  it('Alle 12 Topics abgearbeitet → FINISH_MODE → scoreboard bei Single-Modus', () => {
    const topics = [
      'film', 'serien', 'musik', 'games',
      'geografie', 'geschichte', 'wissenschaft', 'sport',
      'essen', 'technik', 'sprache', 'kurioses',
    ] as const

    let s = bootIntoPlaying('category-duel')
    for (const t of topics) {
      s = reducer(s, { type: 'CD_PICK_TOPIC', topic: t })
      // Immer richtig → alle Punkte für Team A (Team-Wechsel geschieht in NEXT_TURN).
      const cd = s.live
      if (cd?.kind !== 'category-duel') throw new Error('unreachable')
      s = reducer(s, { type: 'CD_SELECT_ANSWER', renderedIndex: cd.correctRenderedIndex })
      s = reducer(s, { type: 'CD_NEXT_TURN' })
    }
    expect(s.phase).toBe('scoreboard')
    expect(s.live).toBeNull()
    // 12 richtige Antworten wandern durch die Teams (alternierend). Genau 6 pro Team.
    expect(s.results).toHaveLength(1)
    // Der Match-Punkt geht an das Team mit mehr Punkten (oder keiner bei Gleichstand).
    // Bei 12 richtigen Antworten und alternierendem Team-Zug: 6 für Team A, 6 für Team B.
    // Gleichstand → kein Match-Punkt.
    expect(s.matchPoints['team-a'] ?? 0).toBe(0)
    expect(s.matchPoints['team-b'] ?? 0).toBe(0)
  })
})

describe('reducer — Blitzrunde', () => {
  it('START_PLAYING mit flash zieht die erste Behauptung direkt', () => {
    const s = bootIntoPlaying('flash')
    expect(s.live?.kind).toBe('flash')
    if (s.live?.kind !== 'flash') throw new Error('unreachable')
    expect(s.live.activeQuestion).not.toBeNull()
    expect(s.live.currentIndex).toBe(0)
    expect(s.live.phase).toBe('answering')
    expect(s.live.teamAnswers).toEqual({ 'team-a': null, 'team-b': null })
    expect(s.live.scores).toEqual({ 'team-a': 0, 'team-b': 0 })
  })

  it('FLASH_SET_ANSWER speichert die Wahl pro Team', () => {
    let s = bootIntoPlaying('flash')
    s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-a', answer: true })
    if (s.live?.kind !== 'flash') throw new Error('unreachable')
    expect(s.live.teamAnswers['team-a']).toBe(true)
    expect(s.live.teamAnswers['team-b']).toBeNull()
  })

  it('FLASH_REVEAL bleibt no-op, solange nicht beide Teams getippt haben', () => {
    let s = bootIntoPlaying('flash')
    s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-a', answer: true })
    const before = s.live
    s = reducer(s, { type: 'FLASH_REVEAL' })
    expect(s.live).toBe(before)
  })

  it('FLASH_REVEAL verteilt Punkte pro richtiger Antwort', () => {
    let s = bootIntoPlaying('flash')
    if (s.live?.kind !== 'flash') throw new Error('unreachable')
    const correct = s.live.activeQuestion!.correctAnswer
    const pointsPerCorrect = s.live.pointsPerCorrect

    // Team A tippt richtig, Team B falsch.
    s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-a', answer: correct })
    s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-b', answer: !correct })
    s = reducer(s, { type: 'FLASH_REVEAL' })
    if (s.live?.kind !== 'flash') throw new Error('unreachable')

    expect(s.live.phase).toBe('revealed')
    expect(s.live.scores['team-a']).toBe(pointsPerCorrect)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('FLASH_NEXT geht zur nächsten Behauptung und resettet Team-Antworten', () => {
    let s = bootIntoPlaying('flash')
    if (s.live?.kind !== 'flash') throw new Error('unreachable')
    const firstQuestionId = s.live.activeQuestion!.id

    s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-a', answer: true })
    s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-b', answer: true })
    s = reducer(s, { type: 'FLASH_REVEAL' })
    s = reducer(s, { type: 'FLASH_NEXT' })
    if (s.live?.kind !== 'flash') throw new Error('unreachable')

    expect(s.live.currentIndex).toBe(1)
    expect(s.live.phase).toBe('answering')
    expect(s.live.teamAnswers).toEqual({ 'team-a': null, 'team-b': null })
    expect(s.live.usedQuestionIds).toContain(firstQuestionId)
    expect(s.live.activeQuestion?.id).not.toBe(firstQuestionId)
  })

  it('nach totalStatements Runden → FINISH_MODE + scoreboard', () => {
    let s = bootIntoPlaying('flash')
    if (s.live?.kind !== 'flash') throw new Error('unreachable')
    const total = s.live.totalStatements
    // Sanity: der Pool muss mindestens `total` Fragen bieten, sonst wird die
    // Runde vorzeitig via Fallback beendet.
    expect(getTrueFalsePool().length).toBeGreaterThanOrEqual(total)

    for (let i = 0; i < total; i++) {
      if (s.live?.kind !== 'flash') throw new Error('unreachable')
      const correct = s.live.activeQuestion!.correctAnswer
      s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-a', answer: correct })
      s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-b', answer: !correct })
      s = reducer(s, { type: 'FLASH_REVEAL' })
      s = reducer(s, { type: 'FLASH_NEXT' })
    }
    expect(s.phase).toBe('scoreboard')
    // Team A tippt jedes Mal richtig, Team B jedes Mal falsch → klarer Sieg.
    expect(s.matchPoints['team-a']).toBe(1)
    expect(s.matchPoints['team-b'] ?? 0).toBe(0)
  })
})

describe('reducer — Match-Tracker über mehrere Modi', () => {
  it('Mehrere Modi hintereinander: currentModeIndex wandert, Match-Punkte akkumulieren', () => {
    // Setup: zwei Modi in Reihe.
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['category-duel', 'flash'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })

    expect(s.currentModeIndex).toBe(0)
    expect(s.live?.kind).toBe('category-duel')

    // Themen-Battle „durchspielen" → wir simulieren nur 12 Topics.
    const topics = [
      'film', 'serien', 'musik', 'games',
      'geografie', 'geschichte', 'wissenschaft', 'sport',
      'essen', 'technik', 'sprache', 'kurioses',
    ] as const
    for (const t of topics) {
      s = reducer(s, { type: 'CD_PICK_TOPIC', topic: t })
      if (s.live?.kind !== 'category-duel') break
      s = reducer(s, { type: 'CD_SELECT_ANSWER', renderedIndex: s.live.correctRenderedIndex })
      s = reducer(s, { type: 'CD_NEXT_TURN' })
    }

    // Nach dem letzten NEXT_TURN wird FINISH_MODE ausgelöst — wir sollten jetzt im
    // zweiten Modus (flash) sein.
    expect(s.phase).toBe('playing')
    expect(s.currentModeIndex).toBe(1)
    expect(s.live?.kind).toBe('flash')
    expect(s.results).toHaveLength(1)
  })
})

describe('reducer — Utility-Actions', () => {
  it('BACK_TO_SETUP setzt den Live-Zustand zurück, hält aber den Draft', () => {
    let s = bootIntoPlaying('category-duel')
    s = reducer(s, { type: 'BACK_TO_SETUP' })
    expect(s.phase).toBe('setup')
    expect(s.live).toBeNull()
    expect(s.round).toBeNull()
    expect(s.draft.selectedModes).toEqual(['category-duel'])
  })

  it('RESET_ALL fährt komplett auf den Initialzustand zurück', () => {
    let s = bootIntoPlaying('flash')
    s = reducer(s, {
      type: 'SET_TEAM_NAME',
      teamId: 'team-a',
      name: 'Custom Team',
    })
    s = reducer(s, { type: 'RESET_ALL' })
    expect(s).toEqual(INITIAL_STATE)
  })
})

// Wir referenzieren getMultipleChoiceByTopic hier nur, damit der Import nicht
// als unused verworfen wird — der Sanity-Check am Pool ist trotzdem sinnvoll.
describe('reducer — Sanity', () => {
  it('Alle Themen-Battle-Topics haben mindestens eine Frage im Katalog', () => {
    const topics = [
      'film', 'serien', 'musik', 'games',
      'geografie', 'geschichte', 'wissenschaft', 'sport',
      'essen', 'technik', 'sprache', 'kurioses',
    ] as const
    for (const t of topics) {
      expect(getMultipleChoiceByTopic(t).length).toBeGreaterThan(0)
    }
  })
})
