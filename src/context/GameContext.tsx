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
  Player,
  PlayerInterest,
  RoundConfig,
  Team,
} from '@/types/round'
import type { MultipleChoiceQuestion, Topic, TrueFalseQuestion } from '@/types/question'
import { MODES_BY_ID } from '@/data/modes'
import { pickQuestion, pickTrueFalse } from '@/lib/questions'
import { markQuestionsAsked, readAskedQuestionIds } from '@/lib/questionHistory'
import {
  aggregatePlayerInterests,
  computeInterestProfile,
} from '@/lib/interestProfile'
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

/**
 * „Heimspiel" (Player Spotlight): jeder Spieler mit Interessen bekommt reihum eine
 * Multiple-Choice-Frage aus einem seiner Topics. Optionen sind zunächst verdeckt — der
 * Spieler antwortet frei. Der Master markiert richtig oder falsch. Bei falsch kommt das
 * Gegenteam mit sichtbarem Multiple-Choice zum Zug (halbe Punkte).
 */
export interface SpotlightLive {
  kind: 'player-spotlight'
  /** playerIds in Spielreihenfolge; nur Spieler mit mindestens einem Interesse. */
  playerOrder: string[]
  currentIndex: number
  activePlayerId: string | null
  activeTopic: Topic | null
  activeQuestion: MultipleChoiceQuestion | null
  shuffledOptions: string[]
  correctRenderedIndex: number
  phase: 'primary' | 'steal' | 'revealed' | 'empty'
  /** Vom Gegenteam gewählter Rendered-Index in der Steal-Phase; null, wenn Steal nicht ausgelöst. */
  stealRenderedIndex: number | null
  primaryOutcome: 'correct' | 'wrong' | null
  stealOutcome: 'correct' | 'wrong' | null
  scores: Record<string, number>
  usedQuestionIds: string[]
  pointsPerCorrect: number
}

export type LiveGame = CategoryDuelLive | FlashLive | SpotlightLive

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
  | { type: 'SPOTLIGHT_MARK_PRIMARY'; outcome: 'correct' | 'wrong' }
  | { type: 'SPOTLIGHT_STEAL_ANSWER'; renderedIndex: number }
  | { type: 'SPOTLIGHT_NEXT' }
  | { type: 'ADD_PLAYER'; teamId: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_PLAYER_NAME'; playerId: string; name: string }
  | { type: 'SET_PLAYER_INTERESTS'; playerId: string; interests: PlayerInterest[] }
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

// ---------- Helper: Player-Handling ------------------------------------------

/** Grenzen pro Team, siehe konzept-v2.md „2–4 Personen pro Team". */
const MIN_PLAYERS_PER_TEAM = 1
const MAX_PLAYERS_PER_TEAM = 4
const DEFAULT_PLAYERS_PER_TEAM = 2

function newPlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `player-${crypto.randomUUID()}`
  }
  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function makeDefaultPlayers(teams: Team[]): Player[] {
  const players: Player[] = []
  for (const team of teams) {
    for (let i = 0; i < DEFAULT_PLAYERS_PER_TEAM; i++) {
      players.push({ id: newPlayerId(), name: '', teamId: team.id, interests: [] })
    }
  }
  return players
}

function countPlayersInTeam(players: readonly Player[], teamId: string): number {
  let n = 0
  for (const p of players) if (p.teamId === teamId) n += 1
  return n
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

function initFlash(teams: Team[], players: readonly Player[]): FlashLive | null {
  // Erste Behauptung direkt ziehen — Blitzrunde ist linear, keine Vorauswahl.
  const excluded = new Set<string>()
  for (const id of readAskedQuestionIds()) excluded.add(id)
  const first = pickTrueFalse(excluded, computeInterestProfile(players))
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

/** Ordnung der Skill-Level für Aggregation und Präferenz-Sortierung. */
const SPOTLIGHT_LEVEL_ORDER = ['bisschen', 'gut', 'nerd'] as const

/**
 * Wählt das Topic für die Spotlight-Frage: höchstes Skill-Level, bei Gleichstand die
 * erste Nennung. Gibt `null` zurück, wenn der Spieler keine Interessen hat.
 */
function pickTopicForPlayer(player: Player): Topic | null {
  if (player.interests.length === 0) return null
  let best = player.interests[0]
  for (let i = 1; i < player.interests.length; i++) {
    const candidate = player.interests[i]
    if (
      SPOTLIGHT_LEVEL_ORDER.indexOf(candidate.level) >
      SPOTLIGHT_LEVEL_ORDER.indexOf(best.level)
    ) {
      best = candidate
    }
  }
  return best.topic
}

/**
 * Baut die Spotlight-Runde: Team-alternierende Reihenfolge über alle Spieler mit
 * Interessen. Team A p0, Team B p0, Team A p1, Team B p1, ... Damit wechselt der
 * Bühnenscheinwerfer regelmäßig die Seite.
 */
function buildSpotlightOrder(
  teams: readonly Team[],
  players: readonly Player[],
): string[] {
  const eligiblePerTeam = teams.map((team) =>
    players.filter((p) => p.teamId === team.id && p.interests.length > 0),
  )
  const maxLen = Math.max(0, ...eligiblePerTeam.map((list) => list.length))
  const order: string[] = []
  for (let i = 0; i < maxLen; i++) {
    for (const list of eligiblePerTeam) {
      if (i < list.length) order.push(list[i].id)
    }
  }
  return order
}

function initSpotlight(teams: Team[], players: readonly Player[]): SpotlightLive {
  const order = buildSpotlightOrder(teams, players)
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))

  if (order.length === 0) {
    // Kein Spieler mit Interessen — Modus wird als „empty" angezeigt und übersprungen.
    return {
      kind: 'player-spotlight',
      playerOrder: [],
      currentIndex: 0,
      activePlayerId: null,
      activeTopic: null,
      activeQuestion: null,
      shuffledOptions: [],
      correctRenderedIndex: 0,
      phase: 'empty',
      stealRenderedIndex: null,
      primaryOutcome: null,
      stealOutcome: null,
      scores,
      usedQuestionIds: [],
      pointsPerCorrect: 500,
    }
  }

  const firstPlayerId = order[0]
  const firstPlayer = players.find((p) => p.id === firstPlayerId)!
  const topic = pickTopicForPlayer(firstPlayer)!
  const excluded = new Set<string>()
  for (const id of readAskedQuestionIds()) excluded.add(id)
  const question = pickQuestion(topic, excluded)

  if (!question) {
    // Topic hat keine MC-Fragen im Katalog — Modus trotzdem starten, empty-Style.
    return {
      kind: 'player-spotlight',
      playerOrder: [],
      currentIndex: 0,
      activePlayerId: null,
      activeTopic: null,
      activeQuestion: null,
      shuffledOptions: [],
      correctRenderedIndex: 0,
      phase: 'empty',
      stealRenderedIndex: null,
      primaryOutcome: null,
      stealOutcome: null,
      scores,
      usedQuestionIds: [],
      pointsPerCorrect: 500,
    }
  }

  const shuffle = shuffleWithMapping(
    question.options,
    `spotlight:${firstPlayerId}:${question.id}`,
  )
  return {
    kind: 'player-spotlight',
    playerOrder: order,
    currentIndex: 0,
    activePlayerId: firstPlayerId,
    activeTopic: topic,
    activeQuestion: question,
    shuffledOptions: shuffle.shuffled,
    correctRenderedIndex: shuffle.renderedIndexOf(question.correctIndex),
    phase: 'primary',
    stealRenderedIndex: null,
    primaryOutcome: null,
    stealOutcome: null,
    scores,
    usedQuestionIds: [],
    pointsPerCorrect: 500,
  }
}

function initLiveFor(
  modeId: GameModeId,
  teams: Team[],
  players: readonly Player[] = [],
): LiveGame | null {
  switch (modeId) {
    case 'category-duel':
      return initCategoryDuel(teams)
    case 'flash':
      return initFlash(teams, players)
    case 'player-spotlight':
      return initSpotlight(teams, players)
    default:
      // Alle anderen Modi sind in v0.1 als `planned` markiert und lassen sich im Setup
      // gar nicht auswählen. Falls doch: null → Reducer springt in FINISH_MODE.
      return null
  }
}

export function reducer(state: GameState, action: GameAction): GameState {
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
      const players = makeDefaultPlayers(teams)
      const round: RoundConfig = {
        id: `round-${Date.now()}`,
        name: `Game Night vom ${new Date().toLocaleDateString('de-DE')}`,
        createdAt: new Date().toISOString(),
        roomCode: generateRoomCode(4),
        teams,
        bestOf: Math.max(1, state.draft.selectedModes.length),
        gameModes: [...state.draft.selectedModes],
        players,
        interests: aggregatePlayerInterests(players),
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
      const live = initLiveFor(firstModeId, state.round.teams, state.round.players)
      return { ...state, phase: 'playing', currentModeIndex: 0, live }
    }

    case 'ADD_PLAYER': {
      if (!state.round || state.phase !== 'lobby') return state
      if (countPlayersInTeam(state.round.players, action.teamId) >= MAX_PLAYERS_PER_TEAM) {
        return state
      }
      const newPlayer: Player = {
        id: newPlayerId(),
        name: '',
        teamId: action.teamId,
        interests: [],
      }
      const players = [...state.round.players, newPlayer]
      return {
        ...state,
        round: {
          ...state.round,
          players,
          interests: aggregatePlayerInterests(players),
        },
      }
    }

    case 'REMOVE_PLAYER': {
      if (!state.round || state.phase !== 'lobby') return state
      const target = state.round.players.find((p) => p.id === action.playerId)
      if (!target) return state
      if (
        countPlayersInTeam(state.round.players, target.teamId) <= MIN_PLAYERS_PER_TEAM
      ) {
        return state
      }
      const players = state.round.players.filter((p) => p.id !== action.playerId)
      return {
        ...state,
        round: {
          ...state.round,
          players,
          interests: aggregatePlayerInterests(players),
        },
      }
    }

    case 'SET_PLAYER_NAME': {
      if (!state.round || state.phase !== 'lobby') return state
      const players = state.round.players.map((p) =>
        p.id === action.playerId ? { ...p, name: action.name } : p,
      )
      // Namen fließen nicht in interests → keine Aggregat-Neurechnung nötig.
      return { ...state, round: { ...state.round, players } }
    }

    case 'SET_PLAYER_INTERESTS': {
      if (!state.round || state.phase !== 'lobby') return state
      // Dedupliziert pro Topic — bei mehreren Einträgen zum selben Topic zählt der letzte.
      const byTopic = new Map<Topic, PlayerInterest>()
      for (const entry of action.interests) byTopic.set(entry.topic, entry)
      const interests = Array.from(byTopic.values())
      const players = state.round.players.map((p) =>
        p.id === action.playerId ? { ...p, interests } : p,
      )
      return {
        ...state,
        round: {
          ...state.round,
          players,
          interests: aggregatePlayerInterests(players),
        },
      }
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
      const nextQuestion = pickTrueFalse(
        excluded,
        computeInterestProfile(state.round.players),
      )
      if (!nextQuestion) {
        // Pool leer — Modus vorzeitig beenden.
        return reducer({ ...state, live: advancedLive }, { type: 'FINISH_MODE' })
      }

      return {
        ...state,
        live: { ...advancedLive, activeQuestion: nextQuestion },
      }
    }

    case 'SPOTLIGHT_MARK_PRIMARY': {
      if (!state.round || !state.live || state.live.kind !== 'player-spotlight') return state
      const live = state.live
      if (live.phase !== 'primary') return state
      const player = state.round.players.find((p) => p.id === live.activePlayerId)
      if (!player) return state

      if (action.outcome === 'correct') {
        const scores = {
          ...live.scores,
          [player.teamId]: live.scores[player.teamId] + live.pointsPerCorrect,
        }
        return {
          ...state,
          live: {
            ...live,
            phase: 'revealed',
            primaryOutcome: 'correct',
            scores,
          },
        }
      }

      // Fehler → Steal-Phase für das Gegenteam. Punktevergabe erst in STEAL_ANSWER.
      return {
        ...state,
        live: {
          ...live,
          phase: 'steal',
          primaryOutcome: 'wrong',
        },
      }
    }

    case 'SPOTLIGHT_STEAL_ANSWER': {
      if (!state.round || !state.live || state.live.kind !== 'player-spotlight') return state
      const live = state.live
      if (live.phase !== 'steal') return state
      const player = state.round.players.find((p) => p.id === live.activePlayerId)
      if (!player) return state
      const opponent = state.round.teams.find((t) => t.id !== player.teamId)
      if (!opponent) return state

      const wasCorrect = action.renderedIndex === live.correctRenderedIndex
      const stealPoints = Math.floor(live.pointsPerCorrect / 2)
      const scores = wasCorrect
        ? {
            ...live.scores,
            [opponent.id]: live.scores[opponent.id] + stealPoints,
          }
        : live.scores

      return {
        ...state,
        live: {
          ...live,
          phase: 'revealed',
          stealRenderedIndex: action.renderedIndex,
          stealOutcome: wasCorrect ? 'correct' : 'wrong',
          scores,
        },
      }
    }

    case 'SPOTLIGHT_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'player-spotlight') return state
      // Empty-Fall: sofort in FINISH_MODE springen.
      if (state.live.phase === 'empty') {
        return reducer(state, { type: 'FINISH_MODE' })
      }
      if (state.live.phase !== 'revealed') return state

      const usedQuestionIds = state.live.activeQuestion
        ? [...state.live.usedQuestionIds, state.live.activeQuestion.id]
        : state.live.usedQuestionIds
      const nextIndex = state.live.currentIndex + 1
      const isModeDone = nextIndex >= state.live.playerOrder.length

      const advancedBase: SpotlightLive = {
        ...state.live,
        usedQuestionIds,
        currentIndex: nextIndex,
        activePlayerId: null,
        activeTopic: null,
        activeQuestion: null,
        shuffledOptions: [],
        correctRenderedIndex: 0,
        phase: 'primary',
        stealRenderedIndex: null,
        primaryOutcome: null,
        stealOutcome: null,
      }

      if (isModeDone) {
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      const nextPlayerId = state.live.playerOrder[nextIndex]
      const nextPlayer = state.round.players.find((p) => p.id === nextPlayerId)
      // Wenn der nächste Spieler zwischenzeitlich keine Interessen mehr hat, überspringen.
      // Sollte in phase='lobby' nicht mehr auftreten, aber wir sichern uns ab.
      if (!nextPlayer) {
        return reducer({ ...state, live: advancedBase }, { type: 'SPOTLIGHT_NEXT' })
      }
      const topic = pickTopicForPlayer(nextPlayer)
      if (!topic) {
        return reducer({ ...state, live: advancedBase }, { type: 'SPOTLIGHT_NEXT' })
      }

      const excluded = new Set(usedQuestionIds)
      for (const id of readAskedQuestionIds()) excluded.add(id)
      const nextQuestion = pickQuestion(topic, excluded)
      if (!nextQuestion) {
        return reducer({ ...state, live: advancedBase }, { type: 'SPOTLIGHT_NEXT' })
      }

      const shuffle = shuffleWithMapping(
        nextQuestion.options,
        `spotlight:${nextPlayerId}:${nextQuestion.id}`,
      )
      return {
        ...state,
        live: {
          ...advancedBase,
          activePlayerId: nextPlayerId,
          activeTopic: topic,
          activeQuestion: nextQuestion,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(nextQuestion.correctIndex),
        },
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
      const nextLive = initLiveFor(nextModeId, state.round.teams, state.round.players)
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

export function useSpotlight(): SpotlightLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'player-spotlight' ? state.live : null
}

// Convenience für Dispatch ohne Boilerplate.
export function useGameDispatch(): (action: GameAction) => void {
  const { dispatch } = useGame()
  return useCallback((action: GameAction) => dispatch(action), [dispatch])
}
