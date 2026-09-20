/**
 * Zentraler Spielzustand als React Context + useReducer.
 *
 * Warum ein einziger Reducer und kein Zustand/Redux: der Prototyp braucht genau eine
 * Wahrheitsquelle für „Draft (Setup)", „Runden-Meta (Teams, Modi, Match-Punkte)" und
 * „aktives Modus-Spiel". In der Vorgänger-App lagen diese drei Ebenen in getrennten
 * State-Slots — das führte zu Sync-Bugs zwischen Live-Score und Match-Punkten. Hier ist
 * alles in einer Reducer-Funktion, mit klaren Übergangs-Actions.
 *
 * Ein Modus (Themen-Battle) ist im Prototyp aktiv umgesetzt. Weitere Modi haben in
 * `modes.ts` den Status `planned` und tauchen im Grid als „Bald verfügbar" auf. Deswegen
 * hat der Reducer aktuell nur einen `CategoryDuelLive`-Zweig — er ist so gebaut, dass ein
 * zweiter Modus als eigene `live`-Variante ergänzt werden kann, ohne Bestehendes zu
 * brechen.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type {
  GameModeId,
  GameResult,
  RoundConfig,
  Team,
} from '@/types/round'
import type { MultipleChoiceQuestion, Topic, TrueFalseQuestion } from '@/types/question'
import { MODES_BY_ID } from '@/data/modes'
import { pickQuestion, pickTrueFalse } from '@/lib/questions'
import { markQuestionsAsked, readAskedQuestionIds } from '@/lib/questionHistory'
import { generateRoomCode } from '@/lib/roomCode'
import { shuffleWithMapping } from '@/lib/shuffle'

// ---------- Sub-Types ---------------------------------------------------------

export type Phase = 'setup' | 'lobby' | 'playing' | 'scoreboard'

/** Alle Live-States sind diskriminierte Unions. Genau ein Modus je Zeit-Slot ist aktiv. */
export interface CategoryDuelLive {
  kind: 'category-duel'
  /** Punkte pro Frage — konstant für alle 12 Kacheln des Grids. */
  pointsPerQuestion: number
  usedTopics: Topic[]
  currentTeamIndex: number
  phase: 'pick-topic' | 'answering' | 'revealed'
  activeTopic: Topic | null
  activeQuestion: MultipleChoiceQuestion | null
  /** Optionen in Render-Reihenfolge (nach Shuffle). */
  shuffledOptions: string[]
  /** Index in `shuffledOptions`, der der richtigen Option entspricht. */
  correctRenderedIndex: number
  /** Vom Team ausgewählter Rendered-Index; `null` wenn noch nichts angetippt. */
  selectedRenderedIndex: number | null
  scores: Record<string, number>
  usedQuestionIds: string[]
}

/**
 * Blitzrunde: 10 Wahr/Falsch-Behauptungen. Beide Teams antworten unabhängig, dann
 * Auflösung. Punkte pro Team-Treffer — kein Turn-Based-Muster wie im Themen-Battle.
 */
export interface FlashLive {
  kind: 'flash'
  totalStatements: number
  pointsPerCorrect: number
  currentIndex: number
  activeQuestion: TrueFalseQuestion | null
  phase: 'answering' | 'revealed'
  /** Aktuelle Runden-Antworten pro Team. `null` = noch nicht gewählt. */
  teamAnswers: Record<string, boolean | null>
  scores: Record<string, number>
  usedQuestionIds: string[]
}

export type LiveGame = CategoryDuelLive | FlashLive

// ---------- Draft (Setup-Phase) ----------------------------------------------

export interface DraftTeam {
  id: string
  name: string
  color: 'purple' | 'cyan'
}

export interface Draft {
  teams: [DraftTeam, DraftTeam]  // MVP: exakt zwei Teams
  selectedModes: GameModeId[]
}

// ---------- State-Shape -------------------------------------------------------

export interface GameState {
  phase: Phase
  draft: Draft
  round: RoundConfig | null
  results: GameResult[]
  matchPoints: Record<string, number>
  currentModeIndex: number
  live: LiveGame | null
}

// ---------- Actions -----------------------------------------------------------

export type GameAction =
  | { type: 'SET_TEAM_NAME'; teamId: string; name: string }
  | { type: 'TOGGLE_MODE'; modeId: GameModeId }
  | { type: 'SET_MODE_SELECTION'; modeIds: GameModeId[] }
  | { type: 'GO_TO_LOBBY' }
  | { type: 'START_PLAYING' }
  | { type: 'CD_PICK_TOPIC'; topic: Topic }
  | { type: 'CD_SELECT_ANSWER'; renderedIndex: number }
  | { type: 'CD_NEXT_TURN' }
  | { type: 'FLASH_SET_ANSWER'; teamId: string; answer: boolean }
  | { type: 'FLASH_REVEAL' }
  | { type: 'FLASH_NEXT' }
  | { type: 'FINISH_MODE' }
  | { type: 'BACK_TO_SETUP' }
  | { type: 'RESET_ALL' }

// ---------- Initial State -----------------------------------------------------

const DEFAULT_DRAFT: Draft = {
  teams: [
    { id: 'team-a', name: 'Team Nova',   color: 'purple' },
    { id: 'team-b', name: 'Team Pulsar', color: 'cyan' },
  ],
  selectedModes: ['category-duel'],
}

export const INITIAL_STATE: GameState = {
  phase: 'setup',
  draft: DEFAULT_DRAFT,
  round: null,
  results: [],
  matchPoints: {},
  currentModeIndex: 0,
  live: null,
}

// ---------- Reducer -----------------------------------------------------------

function initCategoryDuel(teams: Team[]): CategoryDuelLive {
  return {
    kind: 'category-duel',
    pointsPerQuestion: 500,
    usedTopics: [],
    currentTeamIndex: 0,
    phase: 'pick-topic',
    activeTopic: null,
    activeQuestion: null,
    shuffledOptions: [],
    correctRenderedIndex: 0,
    selectedRenderedIndex: null,
    scores: Object.fromEntries(teams.map((t) => [t.id, 0])),
    usedQuestionIds: [],
  }
}

function initFlash(teams: Team[]): FlashLive | null {
  // Erste Behauptung direkt ziehen — Blitzrunde ist linear, keine Vorauswahl.
  const excluded = new Set<string>()
  for (const id of readAskedQuestionIds()) excluded.add(id)
  const first = pickTrueFalse(excluded)
  if (!first) return null

  return {
    kind: 'flash',
    totalStatements: 10,
    pointsPerCorrect: 100,
    currentIndex: 0,
    activeQuestion: first,
    phase: 'answering',
    teamAnswers: Object.fromEntries(teams.map((t) => [t.id, null])),
    scores: Object.fromEntries(teams.map((t) => [t.id, 0])),
    usedQuestionIds: [],
  }
}

function initLiveFor(modeId: GameModeId, teams: Team[]): LiveGame | null {
  switch (modeId) {
    case 'category-duel':
      return initCategoryDuel(teams)
    case 'flash':
      return initFlash(teams)
    default:
      // Alle anderen Modi sind in v0.1 als `planned` markiert und lassen sich im Setup
      // gar nicht auswählen. Falls doch: null → Reducer springt in FINISH_MODE.
      return null
  }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_TEAM_NAME': {
      const teams = state.draft.teams.map((t) =>
        t.id === action.teamId ? { ...t, name: action.name } : t,
      ) as Draft['teams']
      return { ...state, draft: { ...state.draft, teams } }
    }

    case 'TOGGLE_MODE': {
      const mode = MODES_BY_ID[action.modeId]
      // Nur ready-Modi sind auswählbar. Planned-Modi lehnt der Reducer ab, damit die UI
      // sie zwar zeigen, aber nicht selektieren kann.
      if (!mode || mode.status !== 'ready') return state
      const has = state.draft.selectedModes.includes(action.modeId)
      const selectedModes = has
        ? state.draft.selectedModes.filter((m) => m !== action.modeId)
        : [...state.draft.selectedModes, action.modeId]
      return { ...state, draft: { ...state.draft, selectedModes } }
    }

    case 'SET_MODE_SELECTION': {
      // Ersetzt die komplette Auswahl. Wird vom Free-Flow genutzt, um Single-Select
      // umzusetzen (SetupPage schickt genau eine Mode-ID).
      const validated = action.modeIds.filter((id) => {
        const mode = MODES_BY_ID[id]
        return mode?.status === 'ready'
      })
      return { ...state, draft: { ...state.draft, selectedModes: validated } }
    }

    case 'GO_TO_LOBBY': {
      if (state.draft.selectedModes.length === 0) return state
      const teams: Team[] = state.draft.teams.map((t) => ({
        id: t.id,
        name: t.name.trim() || (t.color === 'purple' ? 'Team Nova' : 'Team Pulsar'),
        color: t.color,
      }))
      const round: RoundConfig = {
        id: `round-${Date.now()}`,
        name: `Game Night vom ${new Date().toLocaleDateString('de-DE')}`,
        createdAt: new Date().toISOString(),
        roomCode: generateRoomCode(4),
        teams,
        bestOf: Math.max(1, state.draft.selectedModes.length),
        gameModes: [...state.draft.selectedModes],
      }
      return {
        ...state,
        phase: 'lobby',
        round,
        results: [],
        matchPoints: Object.fromEntries(teams.map((t) => [t.id, 0])),
        currentModeIndex: 0,
        live: null,
      }
    }

    case 'START_PLAYING': {
      if (!state.round) return state
      const firstModeId = state.round.gameModes[0]
      const live = initLiveFor(firstModeId, state.round.teams)
      return { ...state, phase: 'playing', currentModeIndex: 0, live }
    }

    case 'CD_PICK_TOPIC': {
      if (!state.round || !state.live || state.live.kind !== 'category-duel') return state
      if (state.live.phase !== 'pick-topic') return state
      if (state.live.usedTopics.includes(action.topic)) return state

      // Kombinierter Ausschluss: bereits in dieser Runde gespielt + Historie aus
      // vorherigen Runden (localStorage). `pickQuestion` fällt automatisch auf den
      // vollen Pool zurück, wenn nach dem Filter nichts mehr übrig ist.
      const excluded = new Set(state.live.usedQuestionIds)
      for (const id of readAskedQuestionIds()) excluded.add(id)
      const question = pickQuestion(action.topic, excluded)
      if (!question) return state

      // Seed = Round-ID + Question-ID: reproduzierbar, aber neu pro Runde.
      const shuffleSeed = `${state.round.id}:${question.id}`
      const shuffle = shuffleWithMapping(question.options, shuffleSeed)
      return {
        ...state,
        live: {
          ...state.live,
          phase: 'answering',
          activeTopic: action.topic,
          activeQuestion: question,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(question.correctIndex),
          selectedRenderedIndex: null,
        },
      }
    }

    case 'CD_SELECT_ANSWER': {
      if (!state.live || state.live.kind !== 'category-duel') return state
      if (state.live.phase !== 'answering') return state
      const teamId = state.round?.teams[state.live.currentTeamIndex].id
      if (!teamId) return state

      const wasCorrect = action.renderedIndex === state.live.correctRenderedIndex
      const scores = wasCorrect
        ? { ...state.live.scores, [teamId]: state.live.scores[teamId] + state.live.pointsPerQuestion }
        : state.live.scores

      return {
        ...state,
        live: {
          ...state.live,
          phase: 'revealed',
          selectedRenderedIndex: action.renderedIndex,
          scores,
        },
      }
    }

    case 'FLASH_SET_ANSWER': {
      if (!state.live || state.live.kind !== 'flash') return state
      if (state.live.phase !== 'answering') return state
      if (!(action.teamId in state.live.teamAnswers)) return state
      return {
        ...state,
        live: {
          ...state.live,
          teamAnswers: {
            ...state.live.teamAnswers,
            [action.teamId]: action.answer,
          },
        },
      }
    }

    case 'FLASH_REVEAL': {
      if (!state.live || state.live.kind !== 'flash') return state
      if (state.live.phase !== 'answering') return state
      if (!state.live.activeQuestion) return state
      // Nur auflösen, wenn beide Teams eine Antwort gewählt haben.
      const allAnswered = Object.values(state.live.teamAnswers).every((a) => a !== null)
      if (!allAnswered) return state

      const correct = state.live.activeQuestion.correctAnswer
      const nextScores = { ...state.live.scores }
      for (const [teamId, answer] of Object.entries(state.live.teamAnswers)) {
        if (answer === correct) {
          nextScores[teamId] = (nextScores[teamId] ?? 0) + state.live.pointsPerCorrect
        }
      }
      return {
        ...state,
        live: { ...state.live, phase: 'revealed', scores: nextScores },
      }
    }

    case 'FLASH_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'flash') return state
      if (state.live.phase !== 'revealed') return state

      const usedQuestionIds = state.live.activeQuestion
        ? [...state.live.usedQuestionIds, state.live.activeQuestion.id]
        : state.live.usedQuestionIds
      const nextIndex = state.live.currentIndex + 1
      const isModeDone = nextIndex >= state.live.totalStatements

      const advancedLive: FlashLive = {
        ...state.live,
        usedQuestionIds,
        currentIndex: nextIndex,
        activeQuestion: null,
        phase: 'answering',
        teamAnswers: Object.fromEntries(
          state.round.teams.map((t) => [t.id, null]),
        ),
      }

      if (isModeDone) {
        return reducer({ ...state, live: advancedLive }, { type: 'FINISH_MODE' })
      }

      // Nächste Behauptung ziehen (Duplicate-Check: Runde + Historie).
      const excluded = new Set(usedQuestionIds)
      for (const id of readAskedQuestionIds()) excluded.add(id)
      const nextQuestion = pickTrueFalse(excluded)
      if (!nextQuestion) {
        // Pool leer — Modus vorzeitig beenden.
        return reducer({ ...state, live: advancedLive }, { type: 'FINISH_MODE' })
      }

      return {
        ...state,
        live: { ...advancedLive, activeQuestion: nextQuestion },
      }
    }

    case 'CD_NEXT_TURN': {
      if (!state.round || !state.live || state.live.kind !== 'category-duel') return state
      if (state.live.phase !== 'revealed') return state

      const activeTopic = state.live.activeTopic
      const usedTopics = activeTopic ? [...state.live.usedTopics, activeTopic] : state.live.usedTopics
      const usedQuestionIds = state.live.activeQuestion
        ? [...state.live.usedQuestionIds, state.live.activeQuestion.id]
        : state.live.usedQuestionIds

      // Alle 12 Kacheln durch → Modus zu Ende, weiter im FINISH_MODE-Handler.
      const isModeDone = usedTopics.length >= 12

      const nextLive: CategoryDuelLive = {
        ...state.live,
        usedTopics,
        usedQuestionIds,
        currentTeamIndex: 1 - state.live.currentTeamIndex,
        phase: 'pick-topic',
        activeTopic: null,
        activeQuestion: null,
        shuffledOptions: [],
        correctRenderedIndex: 0,
        selectedRenderedIndex: null,
      }

      if (!isModeDone) return { ...state, live: nextLive }

      return reducer(
        { ...state, live: nextLive },
        { type: 'FINISH_MODE' },
      )
    }

    case 'FINISH_MODE': {
      if (!state.round || !state.live) return state
      const modeId = state.round.gameModes[state.currentModeIndex]
      // Alle Live-Varianten haben `scores` und `usedQuestionIds` in der gleichen Form.
      const scores = state.live.scores
      const questionsUsed = state.live.usedQuestionIds

      // Modus-Sieger: das Team mit den meisten Punkten dieses Modus. Bei Gleichstand kein
      // Matchpunkt — beide behalten ihre Gesamt-Matchpunkte.
      const [teamA, teamB] = state.round.teams
      const scoreA = scores[teamA.id] ?? 0
      const scoreB = scores[teamB.id] ?? 0
      let winnerTeamId: string | undefined
      if (scoreA > scoreB) winnerTeamId = teamA.id
      else if (scoreB > scoreA) winnerTeamId = teamB.id

      const mode = MODES_BY_ID[modeId]
      const nextMatchPoints = { ...state.matchPoints }
      if (winnerTeamId && mode?.scoresMatchPoint) {
        nextMatchPoints[winnerTeamId] = (nextMatchPoints[winnerTeamId] ?? 0) + 1
      }

      const result: GameResult = {
        gameModeId: modeId,
        scores,
        winnerTeamId,
        questionsUsed,
      }
      const results = [...state.results, result]
      const nextIndex = state.currentModeIndex + 1
      const isMatchDone = nextIndex >= state.round.gameModes.length

      if (isMatchDone) {
        return {
          ...state,
          phase: 'scoreboard',
          results,
          matchPoints: nextMatchPoints,
          live: null,
        }
      }

      const nextModeId = state.round.gameModes[nextIndex]
      const nextLive = initLiveFor(nextModeId, state.round.teams)
      return {
        ...state,
        results,
        matchPoints: nextMatchPoints,
        currentModeIndex: nextIndex,
        live: nextLive,
      }
    }

    case 'BACK_TO_SETUP':
      return { ...INITIAL_STATE, draft: state.draft }

    case 'RESET_ALL':
      return INITIAL_STATE

    default:
      return state
  }
}

// ---------- Context + Provider -----------------------------------------------

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  // Convenience-Selectors, damit Consumer nicht selbst rechnen müssen.
  currentTeam: Team | null
  currentModeId: GameModeId | null
  matchWinner: Team | null
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  // Duplicate-Check-Historie: sobald eine Frage tatsächlich gespielt wurde,
  // merken wir sie in `localStorage`. Der Reducer schreibt selbst nicht, damit er
  // pure bleibt; hier reagieren wir nur auf State-Änderungen.
  const liveUsedQuestionIds = state.live?.usedQuestionIds
  useEffect(() => {
    if (liveUsedQuestionIds && liveUsedQuestionIds.length > 0) {
      markQuestionsAsked(liveUsedQuestionIds)
    }
  }, [liveUsedQuestionIds])

  const currentTeam = useMemo<Team | null>(() => {
    if (!state.round || !state.live || state.live.kind !== 'category-duel') return null
    return state.round.teams[state.live.currentTeamIndex] ?? null
  }, [state.round, state.live])

  const currentModeId = useMemo<GameModeId | null>(() => {
    if (!state.round) return null
    return state.round.gameModes[state.currentModeIndex] ?? null
  }, [state.round, state.currentModeIndex])

  const matchWinner = useMemo<Team | null>(() => {
    if (!state.round || state.phase !== 'scoreboard') return null
    const [teamA, teamB] = state.round.teams
    const a = state.matchPoints[teamA.id] ?? 0
    const b = state.matchPoints[teamB.id] ?? 0
    if (a === b) return null
    return a > b ? teamA : teamB
  }, [state.round, state.matchPoints, state.phase])

  const value = useMemo<GameContextValue>(
    () => ({ state, dispatch, currentTeam, currentModeId, matchWinner }),
    [state, currentTeam, currentModeId, matchWinner],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

// ---------- Hook --------------------------------------------------------------

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

// Convenience-Hooks, die je nach Modus den `live`-Slot typisiert zurückgeben.
export function useCategoryDuel(): CategoryDuelLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'category-duel' ? state.live : null
}

export function useFlash(): FlashLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'flash' ? state.live : null
}

// Convenience für Dispatch ohne Boilerplate.
export function useGameDispatch(): (action: GameAction) => void {
  const { dispatch } = useGame()
  return useCallback((action: GameAction) => dispatch(action), [dispatch])
}
