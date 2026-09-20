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
    const s = reducer(INITIAL_STATE, { type: 'TOGGLE_MODE', modeId: 'pantomime' })
    expect(s.draft.selectedModes).toEqual(before)
  })

  it('SET_MODE_SELECTION ersetzt die Auswahl und filtert planned-IDs raus', () => {
    const s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['flash', 'pantomime', 'category-duel'],
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

// Helper: kompakter Interest-Eintrag mit Level 'gut' (Session E default).
const gut = (topic: string) => ({ topic: topic as never, level: 'gut' as const })

describe('reducer — Player-Ebene (Session D + E)', () => {
  it('GO_TO_LOBBY legt pro Team zwei Default-Player mit leeren Interessen an', () => {
    const s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    expect(s.round?.players).toHaveLength(4)
    const perTeam = new Map<string, number>()
    for (const p of s.round!.players) {
      perTeam.set(p.teamId, (perTeam.get(p.teamId) ?? 0) + 1)
      expect(p.name).toBe('')
      expect(p.interests).toEqual([])
    }
    expect(perTeam.get('team-a')).toBe(2)
    expect(perTeam.get('team-b')).toBe(2)
    expect(s.round?.interests).toEqual([])
  })

  it('SET_PLAYER_INTERESTS setzt Spieler-Interessen und aggregiert round.interests', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    const firstPlayer = s.round!.players[0]
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: firstPlayer.id,
      interests: [gut('wissenschaft'), gut('sprache')],
    })
    expect(s.round?.interests).toEqual(['wissenschaft', 'sprache'])
    expect(s.round?.players[0].interests).toEqual([
      gut('wissenschaft'),
      gut('sprache'),
    ])
  })

  it('SET_PLAYER_INTERESTS dedupliziert pro Topic (letzter Eintrag gewinnt)', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    const firstPlayer = s.round!.players[0]
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: firstPlayer.id,
      interests: [
        { topic: 'film' as never, level: 'bisschen' },
        { topic: 'film' as never, level: 'nerd' },
        gut('musik'),
      ],
    })
    expect(s.round?.players[0].interests).toEqual([
      { topic: 'film', level: 'nerd' },
      gut('musik'),
    ])
  })

  it('Aggregation: gemeinsame Interessen zweier Spieler erscheinen nur einmal in round.interests', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    const [p1, p2] = s.round!.players
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p1.id,
      interests: [gut('film'), gut('musik')],
    })
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p2.id,
      interests: [gut('musik'), gut('wissenschaft')],
    })
    expect(s.round?.interests).toEqual(['film', 'musik', 'wissenschaft'])
  })

  it('Player-Actions werden während des Spiels ignoriert', () => {
    let s = bootIntoPlaying('flash')
    const firstPlayer = s.round!.players[0]
    const before = s.round?.interests
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: firstPlayer.id,
      interests: [gut('film'), gut('musik')],
    })
    expect(s.round?.interests).toEqual(before)
    expect(s.round?.players[0].interests).toEqual([])
  })

  it('ADD_PLAYER fügt einen leeren Spieler zum Team hinzu, respektiert Max 4', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'ADD_PLAYER', teamId: 'team-a' })
    s = reducer(s, { type: 'ADD_PLAYER', teamId: 'team-a' })
    s = reducer(s, { type: 'ADD_PLAYER', teamId: 'team-a' })
    // 2 default + 2 zusätzliche = 4 (Max) — der dritte Add wird geschluckt.
    const teamACount = s.round!.players.filter((p) => p.teamId === 'team-a').length
    expect(teamACount).toBe(4)
  })

  it('REMOVE_PLAYER entfernt, respektiert Min 1 pro Team', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    const teamAPlayers = s.round!.players.filter((p) => p.teamId === 'team-a')
    s = reducer(s, { type: 'REMOVE_PLAYER', playerId: teamAPlayers[0].id })
    let remaining = s.round!.players.filter((p) => p.teamId === 'team-a')
    expect(remaining).toHaveLength(1)
    s = reducer(s, { type: 'REMOVE_PLAYER', playerId: remaining[0].id })
    remaining = s.round!.players.filter((p) => p.teamId === 'team-a')
    expect(remaining).toHaveLength(1)
  })

  it('REMOVE_PLAYER rechnet round.interests neu aus', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    const [p1, p2] = s.round!.players
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p1.id,
      interests: [gut('film')],
    })
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p2.id,
      interests: [gut('musik')],
    })
    expect(s.round?.interests).toEqual(['film', 'musik'])
    s = reducer(s, { type: 'REMOVE_PLAYER', playerId: p1.id })
    expect(s.round?.interests).toEqual(['musik'])
  })

  it('SET_PLAYER_NAME lässt Interessen und Aggregation in Ruhe', () => {
    let s = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    const p1 = s.round!.players[0]
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p1.id,
      interests: [gut('film')],
    })
    s = reducer(s, { type: 'SET_PLAYER_NAME', playerId: p1.id, name: 'Alice' })
    expect(s.round?.players[0].name).toBe('Alice')
    expect(s.round?.players[0].interests).toEqual([gut('film')])
    expect(s.round?.interests).toEqual(['film'])
  })

  it('Blitzrunde: erste Frage kommt aus einem Interest-Topic der Spieler', () => {
    let s = reducer(INITIAL_STATE, { type: 'SET_MODE_SELECTION', modeIds: ['flash'] })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    const firstPlayer = s.round!.players[0]
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: firstPlayer.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'flash') throw new Error('unreachable')
    // Math.random ist auf 0 gepinnt → im weighted pick landen wir im ersten Bucket
    // (shared oder individual — hier: individual, weil nur ein Player Interesse hat).
    // Beide Buckets liefern eine wissenschaft-Frage.
    expect(s.live.activeQuestion?.topic).toBe('wissenschaft')
  })

  it('Blitzrunde: nächste Frage bleibt nach Möglichkeit im Interest-Topic', () => {
    let s = reducer(INITIAL_STATE, { type: 'SET_MODE_SELECTION', modeIds: ['flash'] })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    const firstPlayer = s.round!.players[0]
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: firstPlayer.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'flash') throw new Error('unreachable')

    const topics: string[] = []
    for (let i = 0; i < 2; i++) {
      if (s.live?.kind !== 'flash') throw new Error('unreachable')
      const q = s.live.activeQuestion
      if (!q) throw new Error('no question')
      topics.push(q.topic)
      s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-a', answer: true })
      s = reducer(s, { type: 'FLASH_SET_ANSWER', teamId: 'team-b', answer: true })
      s = reducer(s, { type: 'FLASH_REVEAL' })
      s = reducer(s, { type: 'FLASH_NEXT' })
    }
    expect(topics).toEqual(['wissenschaft', 'wissenschaft'])
  })
})

describe('reducer — Fachrunde (Session O)', () => {
  function bootExperts(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['experts'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })
    return s
  }

  it('START_PLAYING startet in setup-experts mit leeren Fächern', () => {
    const s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    expect(s.live.phase).toBe('setup-experts')
    expect(s.live.playerOrder).toHaveLength(4)
    // Alle Fächer sind null.
    expect(Object.values(s.live.expertise).every((v) => v === null)).toBe(true)
    expect(s.live.soloStartedAt).toBeNull()
  })

  it('EXPERTS_SET_EXPERTISE speichert Fach pro Spieler', () => {
    let s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const pid = s.live.playerOrder[0]
    s = reducer(s, {
      type: 'EXPERTS_SET_EXPERTISE',
      playerId: pid,
      topic: 'wissenschaft',
    })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    expect(s.live.expertise[pid]).toBe('wissenschaft')
  })

  it('EXPERTS_START_ROUND: mit ≥1 Fach → primary, Timer läuft, erste Frage im Fach', () => {
    let s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const pid = s.live.playerOrder[0]
    s = reducer(s, {
      type: 'EXPERTS_SET_EXPERTISE',
      playerId: pid,
      topic: 'wissenschaft',
    })
    s = reducer(s, { type: 'EXPERTS_START_ROUND' })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    expect(s.live.phase).toBe('primary')
    expect(s.live.activePlayerId).toBe(pid)
    expect(s.live.activeQuestion?.topic).toBe('wissenschaft')
    expect(s.live.soloStartedAt).not.toBeNull()
    // playerOrder wurde auf die mit Fach reduziert.
    expect(s.live.playerOrder).toEqual([pid])
  })

  it('EXPERTS_START_ROUND ohne jedes Fach → FINISH_MODE', () => {
    let s = bootExperts()
    s = reducer(s, { type: 'EXPERTS_START_ROUND' })
    expect(s.phase).toBe('scoreboard')
  })

  it('EXPERTS_MARK_PRIMARY correct: volle Punkte, phase revealed', () => {
    let s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const pid = s.live.playerOrder.find((id) => {
      const p = s.round!.players.find((pp) => pp.id === id)!
      return p.teamId === 'team-a'
    })!
    s = reducer(s, {
      type: 'EXPERTS_SET_EXPERTISE',
      playerId: pid,
      topic: 'wissenschaft',
    })
    s = reducer(s, { type: 'EXPERTS_START_ROUND' })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const points = s.live.pointsPerCorrect

    s = reducer(s, { type: 'EXPERTS_MARK_PRIMARY', outcome: 'correct' })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.primaryOutcome).toBe('correct')
    expect(s.live.scores['team-a']).toBe(points)
    expect(s.live.soloStartedAt).toBeNull()
  })

  it('EXPERTS_MARK_PRIMARY wrong: geht in steal-answer', () => {
    let s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const pid = s.live.playerOrder[0]
    s = reducer(s, {
      type: 'EXPERTS_SET_EXPERTISE',
      playerId: pid,
      topic: 'wissenschaft',
    })
    s = reducer(s, { type: 'EXPERTS_START_ROUND' })
    s = reducer(s, { type: 'EXPERTS_MARK_PRIMARY', outcome: 'wrong' })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    expect(s.live.phase).toBe('steal-answer')
    expect(s.live.primaryOutcome).toBe('wrong')
  })

  it('EXPERTS_MARK_PRIMARY timeout: geht in steal-answer', () => {
    let s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const pid = s.live.playerOrder[0]
    s = reducer(s, {
      type: 'EXPERTS_SET_EXPERTISE',
      playerId: pid,
      topic: 'wissenschaft',
    })
    s = reducer(s, { type: 'EXPERTS_START_ROUND' })
    s = reducer(s, { type: 'EXPERTS_MARK_PRIMARY', outcome: 'timeout' })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    expect(s.live.phase).toBe('steal-answer')
    expect(s.live.primaryOutcome).toBe('timeout')
  })

  it('EXPERTS_STEAL_ANSWER richtig: Gegenteam bekommt halbe Punkte', () => {
    let s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const teamAPlayer = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'EXPERTS_SET_EXPERTISE',
      playerId: teamAPlayer.id,
      topic: 'wissenschaft',
    })
    s = reducer(s, { type: 'EXPERTS_START_ROUND' })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const halfPoints = Math.floor(s.live.pointsPerCorrect / 2)
    const correctIdx = s.live.correctRenderedIndex

    s = reducer(s, { type: 'EXPERTS_MARK_PRIMARY', outcome: 'wrong' })
    s = reducer(s, { type: 'EXPERTS_STEAL_ANSWER', renderedIndex: correctIdx })
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.stealOutcome).toBe('correct')
    expect(s.live.scores['team-b']).toBe(halfPoints)
    expect(s.live.scores['team-a']).toBe(0)
  })

  it('Nach letztem Spieler: FINISH_MODE → scoreboard mit Match-Punkt', () => {
    let s = bootExperts()
    if (s.live?.kind !== 'experts') throw new Error('unreachable')
    const teamAPlayer = s.round!.players.find((p) => p.teamId === 'team-a')!
    // Nur ein Fach setzen → Order-Länge 1.
    s = reducer(s, {
      type: 'EXPERTS_SET_EXPERTISE',
      playerId: teamAPlayer.id,
      topic: 'wissenschaft',
    })
    s = reducer(s, { type: 'EXPERTS_START_ROUND' })
    s = reducer(s, { type: 'EXPERTS_MARK_PRIMARY', outcome: 'correct' })
    s = reducer(s, { type: 'EXPERTS_NEXT' })
    expect(s.phase).toBe('scoreboard')
    expect(s.matchPoints['team-a']).toBe(1)
  })
})

describe('reducer — Elimination (Session N)', () => {
  function bootElim(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['elimination'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })
    return s
  }

  it('START_PLAYING legt einen Ring aus allen Default-Spielern an', () => {
    const s = bootElim()
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    expect(s.live.playerOrder.length).toBe(4)
    expect(s.live.phase).toBe('answering')
    expect(s.live.currentPlayerIndex).toBe(0)
    expect(s.live.eliminatedIds).toEqual([])
    expect(s.live.activePlayerId).toBe(s.live.playerOrder[0])
    expect(s.live.scores).toEqual({ 'team-a': 0, 'team-b': 0 })
  })

  it('ELIM_ANSWER richtig: Punkte fürs Team, phase revealed', () => {
    let s = bootElim()
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    const activeId = s.live.activePlayerId!
    const active = s.round!.players.find((p) => p.id === activeId)!
    const points = s.live.pointsPerCorrect
    s = reducer(s, {
      type: 'ELIM_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.lastOutcome).toBe('correct')
    expect(s.live.scores[active.teamId]).toBe(points)
  })

  it('ELIM_ANSWER falsch: keine Punkte, Spieler wird beim NEXT eliminiert', () => {
    let s = bootElim()
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    const activeId = s.live.activePlayerId!
    const wrongIdx = (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length
    s = reducer(s, { type: 'ELIM_ANSWER', renderedIndex: wrongIdx })
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    expect(s.live.lastOutcome).toBe('wrong')
    // Vor NEXT: noch nicht in eliminatedIds.
    expect(s.live.eliminatedIds).not.toContain(activeId)
    s = reducer(s, { type: 'ELIM_NEXT' })
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    expect(s.live.eliminatedIds).toContain(activeId)
  })

  it('ELIM_NEXT geht zum nächsten nicht-eliminierten Spieler', () => {
    let s = bootElim()
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    const firstId = s.live.activePlayerId!
    // Erste Antwort richtig, dann NEXT.
    s = reducer(s, {
      type: 'ELIM_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    s = reducer(s, { type: 'ELIM_NEXT' })
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    expect(s.live.phase).toBe('answering')
    expect(s.live.currentPlayerIndex).toBe(1)
    expect(s.live.activePlayerId).not.toBe(firstId)
  })

  it('Nur noch ein Team steht: phase finished, Bonus fürs überlebende Team', () => {
    let s = bootElim()
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    const bonus = s.live.survivorBonus
    const wrongIdx = (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length

    // Die beiden Team-B-Spieler falsch, Team-A-Spieler richtig — alternierend.
    // Order: A1, B1, A2, B2 (Team-alternierend aus buildEliminationOrder).
    // Wir wollen: B1 raus, dann B2 raus → nur Team A übrig.
    // Runde 1: A1 (aktiv) → richtig → NEXT
    s = reducer(s, {
      type: 'ELIM_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    s = reducer(s, { type: 'ELIM_NEXT' })
    // Runde 2: B1 → falsch → NEXT
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    const wrongIdx2 = (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length
    s = reducer(s, { type: 'ELIM_ANSWER', renderedIndex: wrongIdx2 })
    s = reducer(s, { type: 'ELIM_NEXT' })
    // Runde 3: A2 → richtig → NEXT
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    s = reducer(s, {
      type: 'ELIM_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    s = reducer(s, { type: 'ELIM_NEXT' })
    // Runde 4: B2 → falsch → NEXT → nur noch Team A, finished
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    const wrongIdx4 = (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length
    s = reducer(s, { type: 'ELIM_ANSWER', renderedIndex: wrongIdx4 })
    s = reducer(s, { type: 'ELIM_NEXT' })

    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    // Fake unused reference to satisfy compiler (wrongIdx above).
    void wrongIdx
    expect(s.live.phase).toBe('finished')
    expect(s.live.winnerTeamId).toBe('team-a')
    // Bonus ist im Score enthalten.
    expect(s.live.scores['team-a']).toBeGreaterThanOrEqual(bonus)
  })

  it('finished-Phase: ELIM_NEXT schließt Modus → scoreboard mit Match-Punkt', () => {
    let s = bootElim()
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    // Setze künstlich phase=finished mit Team A als Sieger via Test-Ablauf oben.
    // Kürzerer Weg: alle Team-B-Spieler in Folge falsch, alle Team-A richtig.
    // Aus buildEliminationOrder ist die Reihenfolge A1, B1, A2, B2.
    // A1 richtig → NEXT → B1 falsch → NEXT → A2 richtig → NEXT → B2 falsch → NEXT → finished
    for (const outcome of ['correct', 'wrong', 'correct', 'wrong'] as const) {
      if (s.live?.kind !== 'elimination') throw new Error('unreachable')
      const idx =
        outcome === 'correct'
          ? s.live.correctRenderedIndex
          : (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length
      s = reducer(s, { type: 'ELIM_ANSWER', renderedIndex: idx })
      s = reducer(s, { type: 'ELIM_NEXT' })
    }
    if (s.live?.kind !== 'elimination') throw new Error('unreachable')
    expect(s.live.phase).toBe('finished')
    // Ein weiteres NEXT schließt den Modus.
    s = reducer(s, { type: 'ELIM_NEXT' })
    expect(s.phase).toBe('scoreboard')
    expect(s.matchPoints['team-a']).toBe(1)
  })
})

describe('reducer — Duell 1:1 (Session M)', () => {
  function bootDuel(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['duel-1v1'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })
    return s
  }

  it('START_PLAYING startet in setup-duel mit leerer Vertreter-Wahl', () => {
    const s = bootDuel()
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    expect(s.live.phase).toBe('setup-duel')
    expect(s.live.currentIndex).toBe(0)
    expect(s.live.totalDuels).toBe(5)
    expect(s.live.duelPlayers).toEqual({ 'team-a': null, 'team-b': null })
    expect(s.live.scores).toEqual({ 'team-a': 0, 'team-b': 0 })
  })

  it('DUEL_SET_PLAYER validiert Team-Zugehörigkeit', () => {
    let s = bootDuel()
    const teamAPlayer = s.round!.players.find((p) => p.teamId === 'team-a')!
    // Falsches Team → no-op.
    const before = s.live
    s = reducer(s, {
      type: 'DUEL_SET_PLAYER',
      teamId: 'team-b',
      playerId: teamAPlayer.id,
    })
    expect(s.live).toBe(before)
  })

  it('DUEL_SET_PLAYER für beide Teams schaltet automatisch auf awaiting-buzz', () => {
    let s = bootDuel()
    const teamA = s.round!.players.find((p) => p.teamId === 'team-a')!
    const teamB = s.round!.players.find((p) => p.teamId === 'team-b')!

    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-a', playerId: teamA.id })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    expect(s.live.phase).toBe('setup-duel')

    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-b', playerId: teamB.id })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    expect(s.live.phase).toBe('awaiting-buzz')
    expect(s.live.activeQuestion).not.toBeNull()
    expect(s.live.shuffledOptions).toHaveLength(4)
  })

  it('DUEL_BUZZER + DUEL_ANSWER richtig: volle Punkte für Buzzer-Team', () => {
    let s = bootDuel()
    const [pA, pB] = [
      s.round!.players.find((p) => p.teamId === 'team-a')!,
      s.round!.players.find((p) => p.teamId === 'team-b')!,
    ]
    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-a', playerId: pA.id })
    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-b', playerId: pB.id })
    s = reducer(s, { type: 'DUEL_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    const value = s.live.pointsPerCorrect

    s = reducer(s, {
      type: 'DUEL_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.primaryOutcome).toBe('correct')
    expect(s.live.scores['team-a']).toBe(value)
  })

  it('DUEL_ANSWER falsch: geht in steal-answer, dann steal richtig → Gegenteam bekommt volle Punkte', () => {
    let s = bootDuel()
    const [pA, pB] = [
      s.round!.players.find((p) => p.teamId === 'team-a')!,
      s.round!.players.find((p) => p.teamId === 'team-b')!,
    ]
    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-a', playerId: pA.id })
    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-b', playerId: pB.id })
    s = reducer(s, { type: 'DUEL_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    const value = s.live.pointsPerCorrect
    const correctIdx = s.live.correctRenderedIndex
    const wrongIdx = (correctIdx + 1) % s.live.shuffledOptions.length

    s = reducer(s, { type: 'DUEL_ANSWER', renderedIndex: wrongIdx })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    expect(s.live.phase).toBe('steal-answer')
    expect(s.live.primaryOutcome).toBe('wrong')

    s = reducer(s, { type: 'DUEL_ANSWER', renderedIndex: correctIdx })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.stealOutcome).toBe('correct')
    expect(s.live.scores['team-b']).toBe(value)
    expect(s.live.scores['team-a']).toBe(0)
  })

  it('DUEL_NEXT setzt Vertreter-Wahl zurück und zählt hoch', () => {
    let s = bootDuel()
    const [pA, pB] = [
      s.round!.players.find((p) => p.teamId === 'team-a')!,
      s.round!.players.find((p) => p.teamId === 'team-b')!,
    ]
    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-a', playerId: pA.id })
    s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-b', playerId: pB.id })
    s = reducer(s, { type: 'DUEL_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    s = reducer(s, {
      type: 'DUEL_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    s = reducer(s, { type: 'DUEL_NEXT' })
    if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
    expect(s.live.phase).toBe('setup-duel')
    expect(s.live.currentIndex).toBe(1)
    expect(s.live.duelPlayers).toEqual({ 'team-a': null, 'team-b': null })
    expect(s.live.activeQuestion).toBeNull()
  })

  it('Nach 5 Duellen: FINISH_MODE → scoreboard, Sieger bekommt Match-Punkt', () => {
    let s = bootDuel()
    const pA = s.round!.players.find((p) => p.teamId === 'team-a')!
    const pB = s.round!.players.find((p) => p.teamId === 'team-b')!

    for (let i = 0; i < 5; i++) {
      s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-a', playerId: pA.id })
      s = reducer(s, { type: 'DUEL_SET_PLAYER', teamId: 'team-b', playerId: pB.id })
      s = reducer(s, { type: 'DUEL_BUZZER', teamId: 'team-a' })
      if (s.live?.kind !== 'duel-1v1') throw new Error('unreachable')
      s = reducer(s, {
        type: 'DUEL_ANSWER',
        renderedIndex: s.live.correctRenderedIndex,
      })
      s = reducer(s, { type: 'DUEL_NEXT' })
    }
    expect(s.phase).toBe('scoreboard')
    expect(s.matchPoints['team-a']).toBe(1)
    expect(s.matchPoints['team-b'] ?? 0).toBe(0)
  })
})

describe('reducer — Punktejagd (Session L)', () => {
  function bootBoard(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['category-board'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })
    return s
  }

  it('START_PLAYING initialisiert 5×4-Board mit 5 Topics und 4 Werten', () => {
    const s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    expect(s.live.boardTopics).toHaveLength(5)
    expect(s.live.cellValues).toEqual([100, 200, 300, 400])
    expect(s.live.phase).toBe('pick-cell')
    expect(s.live.playedCells).toEqual([])
    expect(s.live.scores).toEqual({ 'team-a': 0, 'team-b': 0 })
    expect(s.live.cellPickerTeamId).toBe('team-a')
  })

  it('BOARD_PICK_CELL wählt Zelle und geht in awaiting-buzz', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const firstTopic = s.live.boardTopics[0]
    s = reducer(s, { type: 'BOARD_PICK_CELL', topic: firstTopic, valueIndex: 0 })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    expect(s.live.phase).toBe('awaiting-buzz')
    expect(s.live.activeCell).toEqual({ topic: firstTopic, valueIndex: 0 })
    expect(s.live.activeQuestion).not.toBeNull()
    expect(s.live.shuffledOptions).toHaveLength(4)
  })

  it('BOARD_PICK_CELL ignoriert bereits gespielte Zelle', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const t0 = s.live.boardTopics[0]
    // Erste Zelle spielen und beenden.
    s = reducer(s, { type: 'BOARD_PICK_CELL', topic: t0, valueIndex: 0 })
    s = reducer(s, { type: 'BOARD_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    s = reducer(s, {
      type: 'BOARD_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    s = reducer(s, { type: 'BOARD_NEXT' })
    // Dieselbe Zelle nochmal wählen → no-op.
    const before = s.live
    s = reducer(s, { type: 'BOARD_PICK_CELL', topic: t0, valueIndex: 0 })
    expect(s.live).toBe(before)
  })

  it('BOARD_BUZZER setzt buzzingTeamId und geht in primary-answer', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    s = reducer(s, {
      type: 'BOARD_PICK_CELL',
      topic: s.live.boardTopics[0],
      valueIndex: 0,
    })
    s = reducer(s, { type: 'BOARD_BUZZER', teamId: 'team-b' })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    expect(s.live.phase).toBe('primary-answer')
    expect(s.live.buzzingTeamId).toBe('team-b')
  })

  it('BOARD_ANSWER richtig in primary: volle Punkte fürs Buzzer-Team', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const t = s.live.boardTopics[0]
    s = reducer(s, { type: 'BOARD_PICK_CELL', topic: t, valueIndex: 1 })
    s = reducer(s, { type: 'BOARD_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const value = s.live.cellValues[1]
    s = reducer(s, {
      type: 'BOARD_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.primaryOutcome).toBe('correct')
    expect(s.live.scores['team-a']).toBe(value)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('BOARD_ANSWER falsch in primary: geht in steal-answer, keine Punkte', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const t = s.live.boardTopics[0]
    s = reducer(s, { type: 'BOARD_PICK_CELL', topic: t, valueIndex: 0 })
    s = reducer(s, { type: 'BOARD_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const wrongIdx =
      (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length
    s = reducer(s, { type: 'BOARD_ANSWER', renderedIndex: wrongIdx })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    expect(s.live.phase).toBe('steal-answer')
    expect(s.live.primaryOutcome).toBe('wrong')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('BOARD_ANSWER richtig in steal-answer: Gegenteam bekommt volle Punkte', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const t = s.live.boardTopics[0]
    s = reducer(s, { type: 'BOARD_PICK_CELL', topic: t, valueIndex: 2 })
    s = reducer(s, { type: 'BOARD_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const value = s.live.cellValues[2]
    const correctIdx = s.live.correctRenderedIndex
    const wrongIdx = (correctIdx + 1) % s.live.shuffledOptions.length
    // Team A falsch.
    s = reducer(s, { type: 'BOARD_ANSWER', renderedIndex: wrongIdx })
    // Team B steal richtig.
    s = reducer(s, { type: 'BOARD_ANSWER', renderedIndex: correctIdx })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.stealOutcome).toBe('correct')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.scores['team-b']).toBe(value)
  })

  it('BOARD_NEXT: playedCells++, Wahlrecht wechselt zum Gegenteam', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const t = s.live.boardTopics[0]
    s = reducer(s, { type: 'BOARD_PICK_CELL', topic: t, valueIndex: 0 })
    s = reducer(s, { type: 'BOARD_BUZZER', teamId: 'team-a' })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    s = reducer(s, {
      type: 'BOARD_ANSWER',
      renderedIndex: s.live.correctRenderedIndex,
    })
    s = reducer(s, { type: 'BOARD_NEXT' })
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    expect(s.live.phase).toBe('pick-cell')
    expect(s.live.playedCells).toHaveLength(1)
    expect(s.live.playedCells[0]).toEqual({ topic: t, valueIndex: 0 })
    // Wahlrecht ist auf team-b gewandert.
    expect(s.live.cellPickerTeamId).toBe('team-b')
    expect(s.live.activeQuestion).toBeNull()
  })

  it('Nach allen Zellen: BOARD_NEXT → FINISH_MODE → scoreboard', () => {
    let s = bootBoard()
    if (s.live?.kind !== 'category-board') throw new Error('unreachable')
    const topics = s.live.boardTopics
    const rowCount = s.live.cellValues.length
    for (const topic of topics) {
      for (let row = 0; row < rowCount; row++) {
        s = reducer(s, { type: 'BOARD_PICK_CELL', topic, valueIndex: row })
        s = reducer(s, { type: 'BOARD_BUZZER', teamId: 'team-a' })
        if (s.live?.kind !== 'category-board') throw new Error('unreachable')
        s = reducer(s, {
          type: 'BOARD_ANSWER',
          renderedIndex: s.live.correctRenderedIndex,
        })
        s = reducer(s, { type: 'BOARD_NEXT' })
      }
    }
    expect(s.phase).toBe('scoreboard')
    // Team A hat alle 15 Zellen richtig → Match-Punkt.
    expect(s.matchPoints['team-a']).toBe(1)
  })
})

describe('reducer — Alles oder Nichts (Session K)', () => {
  function bootLadder(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['points-ladder'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })
    return s
  }

  it('START_PLAYING initialisiert Ladder mit 5 Stufen und erster Frage', () => {
    const s = bootLadder()
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    expect(s.live.phase).toBe('answering')
    expect(s.live.currentIndex).toBe(0)
    expect(s.live.totalQuestions).toBe(5)
    expect(s.live.ladder).toEqual([200, 500, 1000, 2500, 5000])
    expect(s.live.activeQuestion).not.toBeNull()
    expect(s.live.teamAnswers).toEqual({ 'team-a': null, 'team-b': null })
    expect(s.live.scores).toEqual({ 'team-a': 0, 'team-b': 0 })
  })

  it('LADDER_SET_ANSWER speichert die Wahl pro Team', () => {
    let s = bootLadder()
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    s = reducer(s, {
      type: 'LADDER_SET_ANSWER',
      teamId: 'team-a',
      renderedIndex: 2,
    })
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    expect(s.live.teamAnswers['team-a']).toBe(2)
    expect(s.live.teamAnswers['team-b']).toBeNull()
  })

  it('LADDER_REVEAL bleibt no-op solange nicht beide getippt haben', () => {
    let s = bootLadder()
    s = reducer(s, {
      type: 'LADDER_SET_ANSWER',
      teamId: 'team-a',
      renderedIndex: 0,
    })
    const before = s.live
    s = reducer(s, { type: 'LADDER_REVEAL' })
    expect(s.live).toBe(before)
  })

  it('LADDER_REVEAL verteilt den Stufen-Wert pro richtiger Antwort', () => {
    let s = bootLadder()
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    const correctIdx = s.live.correctRenderedIndex
    const value = s.live.ladder[0]

    s = reducer(s, { type: 'LADDER_SET_ANSWER', teamId: 'team-a', renderedIndex: correctIdx })
    s = reducer(s, { type: 'LADDER_SET_ANSWER', teamId: 'team-b', renderedIndex: correctIdx })
    s = reducer(s, { type: 'LADDER_REVEAL' })
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.scores['team-a']).toBe(value)
    expect(s.live.scores['team-b']).toBe(value)
  })

  it('LADDER_NEXT geht zur nächsten Stufe und resettet Team-Antworten', () => {
    let s = bootLadder()
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    const firstQuestionId = s.live.activeQuestion!.id

    s = reducer(s, { type: 'LADDER_SET_ANSWER', teamId: 'team-a', renderedIndex: 0 })
    s = reducer(s, { type: 'LADDER_SET_ANSWER', teamId: 'team-b', renderedIndex: 0 })
    s = reducer(s, { type: 'LADDER_REVEAL' })
    s = reducer(s, { type: 'LADDER_NEXT' })
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    expect(s.live.currentIndex).toBe(1)
    expect(s.live.phase).toBe('answering')
    expect(s.live.teamAnswers).toEqual({ 'team-a': null, 'team-b': null })
    expect(s.live.usedQuestionIds).toContain(firstQuestionId)
    expect(s.live.activeQuestion?.id).not.toBe(firstQuestionId)
  })

  it('LADDER_NEXT vor revealed ist no-op', () => {
    let s = bootLadder()
    const before = s.live
    s = reducer(s, { type: 'LADDER_NEXT' })
    expect(s.live).toBe(before)
  })

  it('Nach 5 Stufen: Team mit mehr Punkten bekommt Match-Punkt', () => {
    let s = bootLadder()
    if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
    const total = s.live.totalQuestions
    for (let i = 0; i < total; i++) {
      if (s.live?.kind !== 'points-ladder') throw new Error('unreachable')
      const correctIdx = s.live.correctRenderedIndex
      const wrongIdx = (correctIdx + 1) % s.live.shuffledOptions.length
      // Team A immer richtig, Team B immer falsch.
      s = reducer(s, { type: 'LADDER_SET_ANSWER', teamId: 'team-a', renderedIndex: correctIdx })
      s = reducer(s, { type: 'LADDER_SET_ANSWER', teamId: 'team-b', renderedIndex: wrongIdx })
      s = reducer(s, { type: 'LADDER_REVEAL' })
      s = reducer(s, { type: 'LADDER_NEXT' })
    }
    expect(s.phase).toBe('scoreboard')
    expect(s.matchPoints['team-a']).toBe(1)
    expect(s.matchPoints['team-b'] ?? 0).toBe(0)
    // Team A hat alle 5 Stufen abgeräumt: 200 + 500 + 1000 + 2500 + 5000 = 9200.
    const finalResult = s.results[0]
    expect(finalResult?.scores['team-a']).toBe(9200)
    expect(finalResult?.scores['team-b']).toBe(0)
  })
})

describe('reducer — Sprinter (Session J)', () => {
  function bootSprinter(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['sprinter'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })
    return s
  }

  it('START_PLAYING setzt Team A auf answering mit erster Frage und laufender Uhr', () => {
    const s = bootSprinter()
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    expect(s.live.phase).toBe('answering')
    expect(s.live.currentTeamIndex).toBe(0)
    expect(s.live.activeTeamId).toBe('team-a')
    expect(s.live.activeQuestion).not.toBeNull()
    expect(s.live.shuffledOptions).toHaveLength(4)
    expect(s.live.sprintStartedAt).not.toBeNull()
    expect(s.live.scores).toEqual({ 'team-a': 0, 'team-b': 0 })
  })

  it('SPRINTER_ANSWER richtig: Punkte + neue Frage, Score-Wechsel nur für aktives Team', () => {
    let s = bootSprinter()
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    const firstQuestionId = s.live.activeQuestion!.id
    const correctIdx = s.live.correctRenderedIndex
    const points = s.live.pointsPerCorrect

    s = reducer(s, { type: 'SPRINTER_ANSWER', renderedIndex: correctIdx })
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    expect(s.live.scores['team-a']).toBe(points)
    expect(s.live.scores['team-b']).toBe(0)
    expect(s.live.activeQuestion?.id).not.toBe(firstQuestionId)
    expect(s.live.usedQuestionIds).toContain(firstQuestionId)
    expect(s.live.phase).toBe('answering')
  })

  it('SPRINTER_ANSWER falsch: kein Punkt, aber Frage wechselt', () => {
    let s = bootSprinter()
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    const firstQuestionId = s.live.activeQuestion!.id
    const wrongIdx =
      (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length

    s = reducer(s, { type: 'SPRINTER_ANSWER', renderedIndex: wrongIdx })
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.activeQuestion?.id).not.toBe(firstQuestionId)
  })

  it('SPRINTER_SKIP: kein Punkt, Frage wechselt', () => {
    let s = bootSprinter()
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    const firstQuestionId = s.live.activeQuestion!.id

    s = reducer(s, { type: 'SPRINTER_SKIP' })
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.activeQuestion?.id).not.toBe(firstQuestionId)
    expect(s.live.usedQuestionIds).toContain(firstQuestionId)
  })

  it('SPRINTER_TIME_UP für Team 1: geht in between-teams-Phase', () => {
    let s = bootSprinter()
    s = reducer(s, { type: 'SPRINTER_TIME_UP' })
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    expect(s.live.phase).toBe('between-teams')
    expect(s.live.sprintStartedAt).toBeNull()
    expect(s.live.activeQuestion).toBeNull()
    // Team-Index bleibt bei 0 — Wechsel passiert erst mit START_NEXT_TEAM.
    expect(s.live.currentTeamIndex).toBe(0)
  })

  it('SPRINTER_START_NEXT_TEAM: wechselt zu Team B mit frischer Frage und laufender Uhr', () => {
    let s = bootSprinter()
    s = reducer(s, { type: 'SPRINTER_TIME_UP' })
    s = reducer(s, { type: 'SPRINTER_START_NEXT_TEAM' })
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    expect(s.live.currentTeamIndex).toBe(1)
    expect(s.live.activeTeamId).toBe('team-b')
    expect(s.live.phase).toBe('answering')
    expect(s.live.sprintStartedAt).not.toBeNull()
    expect(s.live.activeQuestion).not.toBeNull()
  })

  it('SPRINTER_TIME_UP für Team 2 löst FINISH_MODE aus → scoreboard', () => {
    let s = bootSprinter()
    // Team A treffen einmal, dann Zeit rum.
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    const teamACorrect = s.live.correctRenderedIndex
    s = reducer(s, { type: 'SPRINTER_ANSWER', renderedIndex: teamACorrect })
    s = reducer(s, { type: 'SPRINTER_TIME_UP' })
    s = reducer(s, { type: 'SPRINTER_START_NEXT_TEAM' })
    // Team B keine Punkte, sofort Time up.
    s = reducer(s, { type: 'SPRINTER_TIME_UP' })
    expect(s.phase).toBe('scoreboard')
    // Team A hat gewonnen — 1 Match-Punkt.
    expect(s.matchPoints['team-a']).toBe(1)
    expect(s.matchPoints['team-b'] ?? 0).toBe(0)
  })

  it('SPRINTER_START_NEXT_TEAM in answering-phase ist no-op', () => {
    let s = bootSprinter()
    const before = s.live
    s = reducer(s, { type: 'SPRINTER_START_NEXT_TEAM' })
    expect(s.live).toBe(before)
  })

  it('Duplicate-Check zwischen den Teams: Team B bekommt keine Fragen die Team A hatte', () => {
    let s = bootSprinter()
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    // Team A: 3 Antworten dispatchen → 3 IDs in usedQuestionIds.
    for (let i = 0; i < 3; i++) {
      if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
      const idx = s.live.correctRenderedIndex
      s = reducer(s, { type: 'SPRINTER_ANSWER', renderedIndex: idx })
    }
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    const usedByTeamA = new Set(s.live.usedQuestionIds)

    s = reducer(s, { type: 'SPRINTER_TIME_UP' })
    s = reducer(s, { type: 'SPRINTER_START_NEXT_TEAM' })
    if (s.live?.kind !== 'sprinter') throw new Error('unreachable')
    expect(usedByTeamA.has(s.live.activeQuestion!.id)).toBe(false)
  })
})

describe('reducer — Klick! (Session I)', () => {
  function bootAroundCorner(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['around-corner'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    s = reducer(s, { type: 'START_PLAYING' })
    return s
  }

  it('START_PLAYING zieht sofort das erste Rätsel', () => {
    const s = bootAroundCorner()
    expect(s.live?.kind).toBe('around-corner')
    if (s.live?.kind !== 'around-corner') throw new Error('unreachable')
    expect(s.live.phase).toBe('guessing')
    expect(s.live.currentIndex).toBe(0)
    expect(s.live.revealedHints).toBe(0)
    expect(s.live.activeQuestion).not.toBeNull()
    expect(s.live.activeQuestion?.hints.length).toBeGreaterThan(0)
  })

  it('AC_REVEAL_HINT erhöht revealedHints bis zum Maximum', () => {
    let s = bootAroundCorner()
    if (s.live?.kind !== 'around-corner') throw new Error('unreachable')
    const maxHints = s.live.activeQuestion!.hints.length
    for (let i = 0; i < maxHints; i++) {
      s = reducer(s, { type: 'AC_REVEAL_HINT' })
    }
    if (s.live?.kind !== 'around-corner') throw new Error('unreachable')
    expect(s.live.revealedHints).toBe(maxHints)
    // Weiterer Hint über das Maximum hinaus → no-op.
    const before = s.live
    s = reducer(s, { type: 'AC_REVEAL_HINT' })
    expect(s.live).toBe(before)
  })

  it('AC_REVEAL_SOLUTION schaltet in revealed-Phase', () => {
    let s = bootAroundCorner()
    s = reducer(s, { type: 'AC_REVEAL_SOLUTION' })
    if (s.live?.kind !== 'around-corner') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
  })

  it('AC_NEXT vor revealed ist no-op', () => {
    let s = bootAroundCorner()
    const before = s.live
    s = reducer(s, { type: 'AC_NEXT' })
    expect(s.live).toBe(before)
  })

  it('AC_NEXT nach revealed geht zum nächsten Rätsel', () => {
    let s = bootAroundCorner()
    if (s.live?.kind !== 'around-corner') throw new Error('unreachable')
    const firstQuestionId = s.live.activeQuestion!.id

    s = reducer(s, { type: 'AC_REVEAL_SOLUTION' })
    s = reducer(s, { type: 'AC_NEXT' })
    if (s.live?.kind !== 'around-corner') throw new Error('unreachable')
    expect(s.live.currentIndex).toBe(1)
    expect(s.live.phase).toBe('guessing')
    expect(s.live.revealedHints).toBe(0)
    expect(s.live.usedQuestionIds).toContain(firstQuestionId)
    expect(s.live.activeQuestion?.id).not.toBe(firstQuestionId)
  })

  it('Nach totalRiddles Rätseln: FINISH_MODE → scoreboard, kein Match-Punkt', () => {
    let s = bootAroundCorner()
    if (s.live?.kind !== 'around-corner') throw new Error('unreachable')
    const total = s.live.totalRiddles

    for (let i = 0; i < total; i++) {
      s = reducer(s, { type: 'AC_REVEAL_SOLUTION' })
      s = reducer(s, { type: 'AC_NEXT' })
    }
    expect(s.phase).toBe('scoreboard')
    // Klick! trägt keinen Match-Punkt bei (mode.scoresMatchPoint === false).
    expect(s.matchPoints['team-a'] ?? 0).toBe(0)
    expect(s.matchPoints['team-b'] ?? 0).toBe(0)
  })
})

describe('reducer — Difficulty-Match (Session H)', () => {
  it('CD_PICK_TOPIC bevorzugt schwere Fragen wenn Team-Level nerd ist', () => {
    vi.restoreAllMocks()
    let base = reducer(INITIAL_STATE, { type: 'GO_TO_LOBBY' })
    const p1 = base.round!.players[0]
    base = reducer(base, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p1.id,
      interests: [{ topic: 'film' as never, level: 'nerd' }],
    })
    base = reducer(base, { type: 'START_PLAYING' })

    const counts: Record<string, number> = { leicht: 0, mittel: 0, schwer: 0 }
    // film hat je genau 1 Frage pro Difficulty im Bestand → gute Verteilungs-Basis.
    for (let i = 0; i < 200; i++) {
      const s = reducer(base, { type: 'CD_PICK_TOPIC', topic: 'film' })
      if (s.live?.kind !== 'category-duel') continue
      const q = s.live.activeQuestion
      if (q) counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1
    }
    expect(counts.schwer).toBeGreaterThan(counts.leicht)
  })

  it('Spotlight bevorzugt schwere Fragen für nerd-Spieler', () => {
    vi.restoreAllMocks()
    let base = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['player-spotlight'],
    })
    base = reducer(base, { type: 'GO_TO_LOBBY' })
    const p = base.round!.players.find((p) => p.teamId === 'team-a')!
    base = reducer(base, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [{ topic: 'film' as never, level: 'nerd' }],
    })

    const counts: Record<string, number> = { leicht: 0, mittel: 0, schwer: 0 }
    for (let i = 0; i < 200; i++) {
      const s = reducer(base, { type: 'START_PLAYING' })
      if (s.live?.kind !== 'player-spotlight') continue
      const q = s.live.activeQuestion
      if (q) counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1
    }
    expect(counts.schwer).toBeGreaterThan(counts.leicht)
  })

  it('Spotlight bevorzugt leichte Fragen für bisschen-Spieler', () => {
    vi.restoreAllMocks()
    let base = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['player-spotlight'],
    })
    base = reducer(base, { type: 'GO_TO_LOBBY' })
    const p = base.round!.players.find((p) => p.teamId === 'team-a')!
    base = reducer(base, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [{ topic: 'film' as never, level: 'bisschen' }],
    })

    const counts: Record<string, number> = { leicht: 0, mittel: 0, schwer: 0 }
    for (let i = 0; i < 200; i++) {
      const s = reducer(base, { type: 'START_PLAYING' })
      if (s.live?.kind !== 'player-spotlight') continue
      const q = s.live.activeQuestion
      if (q) counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1
    }
    expect(counts.leicht).toBeGreaterThan(counts.schwer)
  })
})

describe('reducer — Heimspiel / Player Spotlight (Session G)', () => {
  function bootSpotlight(): ReturnType<typeof reducer> {
    let s = reducer(INITIAL_STATE, {
      type: 'SET_MODE_SELECTION',
      modeIds: ['player-spotlight'],
    })
    s = reducer(s, { type: 'GO_TO_LOBBY' })
    return s
  }

  it('leere Interessen → Modus startet im empty-State und ist per NEXT übersprungbar', () => {
    let s = bootSpotlight()
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    expect(s.live.phase).toBe('empty')
    expect(s.live.playerOrder).toHaveLength(0)

    // NEXT im empty-State → FINISH_MODE → Single-Modus-Setup → scoreboard.
    s = reducer(s, { type: 'SPOTLIGHT_NEXT' })
    expect(s.phase).toBe('scoreboard')
  })

  it('Spielerreihenfolge alterniert zwischen den Teams', () => {
    let s = bootSpotlight()
    // Alle vier Spieler bekommen ein Interesse.
    const [pA1, pA2, pB1, pB2] = s.round!.players
    for (const p of [pA1, pA2, pB1, pB2]) {
      s = reducer(s, {
        type: 'SET_PLAYER_INTERESTS',
        playerId: p.id,
        interests: [gut('wissenschaft')],
      })
    }
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')

    // Order: A1, B1, A2, B2 (Team-Alternierung).
    expect(s.live.playerOrder).toEqual([pA1.id, pB1.id, pA2.id, pB2.id])
    expect(s.live.activePlayerId).toBe(pA1.id)
  })

  it('MARK_PRIMARY correct: aktives Team bekommt volle Punkte, Reveal-Phase', () => {
    let s = bootSpotlight()
    const p = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    const before = s.live.scores['team-a']
    const points = s.live.pointsPerCorrect

    s = reducer(s, { type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'correct' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.primaryOutcome).toBe('correct')
    expect(s.live.scores['team-a']).toBe(before + points)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('MARK_PRIMARY wrong: geht in steal-Phase, Punkte kommen erst nach STEAL_ANSWER', () => {
    let s = bootSpotlight()
    const p = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    s = reducer(s, { type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'wrong' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    expect(s.live.phase).toBe('steal')
    expect(s.live.primaryOutcome).toBe('wrong')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('STEAL_ANSWER richtig: Gegenteam bekommt halbe Punkte', () => {
    let s = bootSpotlight()
    const p = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    const correctIdx = s.live.correctRenderedIndex
    const halfPoints = Math.floor(s.live.pointsPerCorrect / 2)

    s = reducer(s, { type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'wrong' })
    s = reducer(s, { type: 'SPOTLIGHT_STEAL_ANSWER', renderedIndex: correctIdx })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    expect(s.live.phase).toBe('revealed')
    expect(s.live.stealOutcome).toBe('correct')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.scores['team-b']).toBe(halfPoints)
  })

  it('STEAL_ANSWER falsch: keine Punkte für niemanden', () => {
    let s = bootSpotlight()
    const p = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    const wrongIdx =
      (s.live.correctRenderedIndex + 1) % s.live.shuffledOptions.length

    s = reducer(s, { type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'wrong' })
    s = reducer(s, { type: 'SPOTLIGHT_STEAL_ANSWER', renderedIndex: wrongIdx })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    expect(s.live.stealOutcome).toBe('wrong')
    expect(s.live.scores['team-a']).toBe(0)
    expect(s.live.scores['team-b']).toBe(0)
  })

  it('NEXT ohne revealed-Phase ist no-op', () => {
    let s = bootSpotlight()
    const p = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    const before = s.live
    s = reducer(s, { type: 'SPOTLIGHT_NEXT' })
    expect(s.live).toBe(before)
  })

  it('NEXT geht zum nächsten Spieler mit dessen Topic', () => {
    let s = bootSpotlight()
    const [pA1, , pB1] = s.round!.players
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: pA1.id,
      interests: [gut('wissenschaft')],
    })
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: pB1.id,
      interests: [gut('film')],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    // A1 → wissenschaft → Frage. Richtig markieren, dann NEXT → B1 → film.
    s = reducer(s, { type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'correct' })
    s = reducer(s, { type: 'SPOTLIGHT_NEXT' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    expect(s.live.currentIndex).toBe(1)
    expect(s.live.activePlayerId).toBe(pB1.id)
    expect(s.live.activeTopic).toBe('film')
    expect(s.live.phase).toBe('primary')
  })

  it('Nach letztem Spieler: FINISH_MODE → scoreboard bei Single-Modus', () => {
    let s = bootSpotlight()
    const p = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [gut('wissenschaft')],
    })
    // Nur ein Spieler mit Interesse — Order-Länge = 1.
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    expect(s.live.playerOrder).toHaveLength(1)

    s = reducer(s, { type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'correct' })
    s = reducer(s, { type: 'SPOTLIGHT_NEXT' })
    expect(s.phase).toBe('scoreboard')
    expect(s.matchPoints['team-a']).toBe(1)
  })

  it('pickTopicForPlayer respektiert höchstes Level bei mehreren Interessen', () => {
    let s = bootSpotlight()
    const p = s.round!.players.find((p) => p.teamId === 'team-a')!
    s = reducer(s, {
      type: 'SET_PLAYER_INTERESTS',
      playerId: p.id,
      interests: [
        { topic: 'film' as never, level: 'bisschen' },
        { topic: 'wissenschaft' as never, level: 'nerd' },
        { topic: 'musik' as never, level: 'gut' },
      ],
    })
    s = reducer(s, { type: 'START_PLAYING' })
    if (s.live?.kind !== 'player-spotlight') throw new Error('unreachable')
    // 'wissenschaft' hat 'nerd' und sollte gewählt werden.
    expect(s.live.activeTopic).toBe('wissenschaft')
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
