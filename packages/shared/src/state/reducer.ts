/**
/**
 * Pure Reducer und State-Modell des Quizabends — plattform-neutral.
 *
 * Diese Datei lebt in `@quizapp/shared` und wird sowohl vom React-Frontend
 * (via `useReducer` im Provider) als auch von der AWS-Lambda-Funktion
 * genutzt (server-authoritativer Reducer für Multi-Device-Sessions).
 *
 * Der Reducer selbst ist eine Pure Function. Externe Zustände wie die
 * Cross-Session-Historie gelöster Fragen werden per `ReducerDeps`
 * injiziert (`getAskedQuestionIds`), damit der Reducer keine Side-Effects
 * gegen `localStorage` oder DynamoDB direkt ausführt.
 *
 * Verwendung:
 *   const reducer = createReducer({ getAskedQuestionIds: () => new Set(...) })
 *   const nextState = reducer(state, action)
 */

import type {
  Avatar,
  GameModeId,
  GameResult,
  MultipleChoiceQuestion,
  Player,
  PlayerInterest,
  PlayerProfile,
  RoundConfig,
  Team,
  TeamColor,
  Topic,
  TrueFalseQuestion,
  WarmupRiddleQuestion,
} from '../types'
import { MODES_BY_ID } from '../data/modes'
import {
  pickAnyMultipleChoice,
  pickQuestion,
  pickTrueFalse,
  pickWarmupRiddle,
} from '../lib/questions'
import {
  aggregatePlayerInterests,
  computeInterestProfile,
} from '../lib/interestProfile'
import { generateRoomCode } from '../lib/roomCode'
import { shuffleWithMapping } from '../lib/shuffle'
import { getDefaultAvatar } from '../data/avatars'
import {
  MAX_TEAMS,
  MIN_TEAMS,
  getNextTeamId,
  makeDefaultTeam,
} from '../data/teams'

/**
 * Extern injizierte Abhängigkeiten, damit der Reducer pure bleibt.
 *
 * Frontend baut die deps mit einem `localStorage`-Wrapper, Lambda mit einem
 * DynamoDB-Read. Der Reducer kennt beide Welten nicht.
 */
export interface ReducerDeps {
  /**
   * Liefert alle über bisherige Sessions gestellten Frage-IDs.
   * Wird bei jeder Auswahl aufgerufen — die Historie ist Cross-Round-persistent
   * und wächst zwischen den Aufrufen. Der Reducer selbst schreibt nicht in
   * die Historie; das übernimmt der Aufrufer via `state.live.usedQuestionIds`.
   */
  getAskedQuestionIds: () => Set<string>
}

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

/**
 * Klick! (Warm-Up „Genial daneben"): fünf Rätsel-Fragen mit stufenweisen Hinweisen.
 * Alle beraten gemeinsam, keine Team-Wertung. Fokus liegt auf dem Aha-Moment und der
 * lockeren Einstimmung — kein Match-Punkt (mode.scoresMatchPoint === false).
 */
export interface AroundCornerLive {
  kind: 'around-corner'
  totalRiddles: number
  currentIndex: number
  activeQuestion: WarmupRiddleQuestion | null
  /** Wie viele der `hints` bereits aufgedeckt sind (0 bis hints.length). */
  revealedHints: number
  phase: 'guessing' | 'revealed' | 'empty'
  /** Für Konsistenz mit LiveGame — bleibt in diesem Modus dauerhaft bei 0. */
  scores: Record<string, number>
  usedQuestionIds: string[]
}

/**
 * Sprinter: 90-Sekunden-Sprint pro Team über Multiple-Choice-Fragen aus dem gesamten
 * Pool. Richtig = Punkte, „Weiter"-Skip jederzeit erlaubt. Zwischen den Teams pausiert
 * der Modus mit einem Score-Übersichts-Screen. Timer läuft im UI; der Reducer bekommt
 * nur SPRINTER_TIME_UP wenn die Zeit abgelaufen ist.
 */
export interface SprinterLive {
  kind: 'sprinter'
  teamOrder: string[]
  currentTeamIndex: number
  activeTeamId: string | null
  activeQuestion: MultipleChoiceQuestion | null
  shuffledOptions: string[]
  correctRenderedIndex: number
  phase: 'answering' | 'between-teams'
  /** Zeitstempel des Sprint-Starts. UI berechnet remaining. */
  sprintStartedAt: number | null
  sprintDurationSeconds: number
  pointsPerCorrect: number
  scores: Record<string, number>
  usedQuestionIds: string[]
}

/**
 * Alles oder Nichts (Punkte-Leiter): fünf MC-Fragen mit stark steigenden Punktwerten.
 * Beide Teams tippen unabhängig, Auflösung erfolgt gemeinsam. Die Difficulty steigt
 * über die Stufen — leichter Einstieg, harter Endgewinn.
 */
export interface PointsLadderLive {
  kind: 'points-ladder'
  totalQuestions: number
  /** Punkte pro Stufe, z. B. [200, 500, 1000, 2500, 5000]. */
  ladder: number[]
  currentIndex: number
  activeQuestion: MultipleChoiceQuestion | null
  shuffledOptions: string[]
  correctRenderedIndex: number
  /** Verdeckte Team-Antworten für die aktuelle Frage. */
  teamAnswers: Record<string, number | null>
  phase: 'answering' | 'revealed' | 'empty'
  scores: Record<string, number>
  usedQuestionIds: string[]
}

/**
 * Punktejagd (Kategorienbrett): Grid aus Topic-Spalten × Wert-Zeilen. Teams wählen
 * abwechselnd eine Zelle, die Frage wird verdeckt gezeigt, Master markiert wer
 * gebuzzt hat, dieses Team antwortet zuerst. Fehler → das andere Team darf stealen.
 *
 * Prototyp-Layout: 5×3 (statt 5×4 im Konzept), damit die Difficulty-Ladder in jedem
 * Topic ohne Frage-Wiederholung durchhält. Bei ≥4 MC-Fragen pro Topic kann auf
 * 5×4 erweitert werden.
 */
export interface CategoryBoardLive {
  kind: 'category-board'
  boardTopics: Topic[]
  cellValues: number[]
  playedCells: Array<{ topic: Topic; valueIndex: number }>
  phase: 'pick-cell' | 'awaiting-buzz' | 'primary-answer' | 'steal-answer' | 'revealed'
  activeCell: { topic: Topic; valueIndex: number } | null
  activeQuestion: MultipleChoiceQuestion | null
  shuffledOptions: string[]
  correctRenderedIndex: number
  /** Team, das für die Primary-Antwort dran ist. */
  buzzingTeamId: string | null
  primaryOutcome: 'correct' | 'wrong' | null
  stealOutcome: 'correct' | 'wrong' | null
  scores: Record<string, number>
  usedQuestionIds: string[]
  /** Welches Team das nächste Zell-Wahlrecht hat (alterniert nach Answer). */
  cellPickerTeamId: string | null
}

/**
 * Duell 1:1: pro Duell schickt jedes Team einen Vertreter, direkte Buzzer-Runde
 * zu einer MC-Frage quer durch alle Topics. Fehler → Steal für den anderen
 * Vertreter. Fünf Duelle pro Modus.
 */
export interface DuelLive {
  kind: 'duel-1v1'
  totalDuels: number
  currentIndex: number
  /**
   * Aktuell duellierendes Team-Paar. Bei 2 Teams immer beide. Bei 3+ Teams
   * rotieren wir zwischen (i, i+1) → so kommt jedes Team der Reihe nach dran.
   * Die nicht-antretenden Teams sitzen dieses Duell aus und bekommen keine Punkte.
   */
  duelingTeamIds: [string, string]
  /**
   * Pro Duell: gewählter Vertreter je Team, `null` solange nicht gewählt.
   * Bei 3+ Teams sind nur die zwei duellierenden Team-IDs relevant — die anderen
   * bleiben auf `null` und werden im UI ausgegraut.
   */
  duelPlayers: Record<string, string | null>
  phase: 'setup-duel' | 'awaiting-buzz' | 'primary-answer' | 'steal-answer' | 'revealed'
  activeQuestion: MultipleChoiceQuestion | null
  shuffledOptions: string[]
  correctRenderedIndex: number
  buzzingTeamId: string | null
  primaryOutcome: 'correct' | 'wrong' | null
  stealOutcome: 'correct' | 'wrong' | null
  pointsPerCorrect: number
  scores: Record<string, number>
  usedQuestionIds: string[]
}

/**
 * Elimination: alle Spieler beider Teams stehen im Ring, bekommen reihum eine
 * MC-Frage. Fehler → Ausscheiden. Modus endet, sobald nur noch Spieler eines
 * Teams stehen — deren Team bekommt einen Bonus.
 */
export interface EliminationLive {
  kind: 'elimination'
  playerOrder: string[]
  eliminatedIds: string[]
  currentPlayerIndex: number
  activePlayerId: string | null
  activeQuestion: MultipleChoiceQuestion | null
  shuffledOptions: string[]
  correctRenderedIndex: number
  phase: 'answering' | 'revealed' | 'finished' | 'empty'
  lastOutcome: 'correct' | 'wrong' | null
  winnerTeamId: string | null
  scores: Record<string, number>
  usedQuestionIds: string[]
  pointsPerCorrect: number
  survivorBonus: number
}

/**
 * Fachrunde: pro Spieler ein Fach (Topic), Solo-Antwort mit Timer,
 * bei Fehler/Timeout Steal für das Gegenteam (halbe Punkte).
 * Konzept-Kern: „Setup-Screen für Fachgebiete kein Hardcoding auf Personen".
 */
export interface ExpertsLive {
  kind: 'experts'
  playerOrder: string[]
  currentIndex: number
  activePlayerId: string | null
  activeQuestion: MultipleChoiceQuestion | null
  shuffledOptions: string[]
  correctRenderedIndex: number
  phase: 'setup-experts' | 'primary' | 'steal-answer' | 'revealed' | 'empty'
  /** Fach pro Spieler; `null` solange nicht gewählt. Persistiert im Setup. */
  expertise: Record<string, Topic | null>
  /** Timer-Anker für die Solo-Phase (ms since epoch). UI zeigt den Countdown. */
  soloStartedAt: number | null
  soloDurationSeconds: number
  primaryOutcome: 'correct' | 'wrong' | 'timeout' | null
  stealOutcome: 'correct' | 'wrong' | null
  scores: Record<string, number>
  usedQuestionIds: string[]
  pointsPerCorrect: number
}

export type LiveGame =
  | CategoryDuelLive
  | FlashLive
  | SpotlightLive
  | AroundCornerLive
  | SprinterLive
  | PointsLadderLive
  | CategoryBoardLive
  | DuelLive
  | EliminationLive
  | ExpertsLive

// ---------- Draft (Setup-Phase) ----------------------------------------------

export interface DraftTeam {
  id: string
  name: string
  color: TeamColor
}

export interface Draft {
  /** 2 bis 4 Teams (siehe MIN_TEAMS / MAX_TEAMS in `@/data/teams`). */
  teams: DraftTeam[]
  selectedModes: GameModeId[]
}

// ---------- State-Shape -------------------------------------------------------

/**
 * Sub-Phasen innerhalb von `phase: 'lobby'` (Session S).
 *
 * Der Lobby-Flow ist jetzt sequenziell:
 *  1. `roster`  — Spieler erfassen (Name/Avatar/Interessen), noch ohne Team.
 *  2. `assign`  — Spieler auf Teams verteilen (Shuffle oder Drag-and-Drop).
 *  3. `ready`   — Team-Ready-Karten + Start-CTA (das alte Lobby-UI).
 *
 * Außerhalb von `phase: 'lobby'` ist der Wert bedeutungslos, wir setzen ihn
 * beim Übergang. Der Master kann per LOBBY_BACK zurückspringen.
 */
export type LobbyStep = 'roster' | 'assign' | 'ready'

export interface GameState {
  phase: Phase
  draft: Draft
  round: RoundConfig | null
  results: GameResult[]
  matchPoints: Record<string, number>
  currentModeIndex: number
  live: LiveGame | null
  lobbyStep: LobbyStep
}

// ---------- Actions -----------------------------------------------------------

export type GameAction =
  | { type: 'SET_TEAM_NAME'; teamId: string; name: string }
  | { type: 'ADD_TEAM' }
  | { type: 'REMOVE_TEAM'; teamId: string }
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
  | { type: 'AC_REVEAL_HINT' }
  | { type: 'AC_REVEAL_SOLUTION' }
  | { type: 'AC_NEXT' }
  | { type: 'SPRINTER_ANSWER'; renderedIndex: number }
  | { type: 'SPRINTER_SKIP' }
  | { type: 'SPRINTER_TIME_UP' }
  | { type: 'SPRINTER_START_NEXT_TEAM' }
  | { type: 'LADDER_SET_ANSWER'; teamId: string; renderedIndex: number }
  | { type: 'LADDER_REVEAL' }
  | { type: 'LADDER_NEXT' }
  | { type: 'BOARD_PICK_CELL'; topic: Topic; valueIndex: number }
  | { type: 'BOARD_BUZZER'; teamId: string }
  | { type: 'BOARD_ANSWER'; renderedIndex: number }
  | { type: 'BOARD_NEXT' }
  | { type: 'DUEL_SET_PLAYER'; teamId: string; playerId: string }
  | { type: 'DUEL_BUZZER'; teamId: string }
  | { type: 'DUEL_ANSWER'; renderedIndex: number }
  | { type: 'DUEL_NEXT' }
  | { type: 'ELIM_ANSWER'; renderedIndex: number }
  | { type: 'ELIM_NEXT' }
  | { type: 'EXPERTS_SET_EXPERTISE'; playerId: string; topic: Topic }
  | { type: 'EXPERTS_START_ROUND' }
  | { type: 'EXPERTS_MARK_PRIMARY'; outcome: 'correct' | 'wrong' | 'timeout' }
  | { type: 'EXPERTS_STEAL_ANSWER'; renderedIndex: number }
  | { type: 'EXPERTS_NEXT' }
  | { type: 'ADD_PLAYER'; teamId: string | null; playerId?: string; playerName?: string }
  | { type: 'INIT_MULTIPLAYER_ROUND' }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_PLAYER_NAME'; playerId: string; name: string }
  | { type: 'SET_PLAYER_INTERESTS'; playerId: string; interests: PlayerInterest[] }
  | { type: 'SET_PLAYER_INTEREST_TAGS'; playerId: string; topic: Topic; tags: string[] }
  | { type: 'SET_PLAYER_AVATAR'; playerId: string; avatar: Avatar }
  | { type: 'ADD_PLAYER_FROM_LIBRARY'; teamId: string | null; profile: PlayerProfile }
  | { type: 'REPLACE_PLAYER_FROM_LIBRARY'; playerId: string; profile: PlayerProfile }
  // Session S — Team-Zuweisungs-Flow:
  | { type: 'LOBBY_ADVANCE' }
  | { type: 'LOBBY_BACK' }
  | { type: 'SHUFFLE_PLAYERS' }
  | { type: 'MOVE_PLAYER_TO_TEAM'; playerId: string; teamId: string | null }
  | { type: 'FINISH_MODE' }
  | { type: 'BACK_TO_SETUP' }
  /**
   * "Nochmal mit denselben Teams": Match neu starten, aber Roster + gewählte
   * Modi behalten. Setzt matchPoints/results/currentModeIndex/live zurück
   * und springt zurück in die Lobby (Step: ready). Keine Player fliegen raus.
   */
  | { type: 'RESTART_MATCH' }
  | { type: 'RESET_ALL' }

// ---------- Initial State -----------------------------------------------------

const DEFAULT_DRAFT: Draft = {
  teams: [makeDefaultTeam(0), makeDefaultTeam(1)],
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
  lobbyStep: 'roster',
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

/**
 * Erzeugt Default-Player im Pool (teamId = null). Ab Session S werden Spieler
 * erst im Roster-Schritt erfasst und im Assign-Schritt auf Teams verteilt —
 * beim GO_TO_LOBBY existiert also noch keine Team-Zuordnung.
 *
 * Wir starten mit `teams.length * DEFAULT_PLAYERS_PER_TEAM` Slots. Das ist die
 * gleiche Gesamtzahl wie im alten Flow (bei 2 Teams: 4 Slots), nur eben ohne
 * feste Zuweisung. Der Master kann Slots im Roster-Schritt hinzufügen oder
 * entfernen.
 */
function makeDefaultPlayers(teams: Team[]): Player[] {
  const totalSlots = teams.length * DEFAULT_PLAYERS_PER_TEAM
  const players: Player[] = []
  for (let i = 0; i < totalSlots; i++) {
    players.push({
      id: newPlayerId(),
      name: '',
      teamId: null,
      interests: [],
      avatar: getDefaultAvatar(i),
    })
  }
  return players
}

function countPlayersInTeam(players: readonly Player[], teamId: string | null): number {
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

function initFlash(teams: Team[], players: readonly Player[], deps: ReducerDeps): FlashLive | null {
  // Erste Behauptung direkt ziehen — Blitzrunde ist linear, keine Vorauswahl.
  const excluded = new Set<string>()
  for (const id of deps.getAskedQuestionIds()) excluded.add(id)
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

/**
 * Ordnung der Skill-Level für Aggregation und Präferenz-Sortierung.
 * Session X: numerisch — Höherer Wert = höheres Skill. `Math.max` reicht.
 */

/**
 * Wählt das Topic für die Spotlight-Frage: höchstes Skill-Level, bei Gleichstand die
 * erste Nennung. Gibt `null` zurück, wenn der Spieler keine Interessen hat.
 */
function pickTopicForPlayer(player: Player): Topic | null {
  if (player.interests.length === 0) return null
  let best = player.interests[0]
  for (let i = 1; i < player.interests.length; i++) {
    const candidate = player.interests[i]
    if (candidate.level > best.level) {
      best = candidate
    }
  }
  return best.topic
}

/** Level, das ein konkreter Spieler zu einem Topic angegeben hat. */
function getPlayerLevelForTopic(
  player: Player,
  topic: Topic,
): PlayerInterest['level'] | undefined {
  return player.interests.find((i) => i.topic === topic)?.level
}

/**
 * Sub-Interessen-Tags eines Spielers für ein Topic (Session AB).
 * Wird an `pickQuestion` weitergegeben, damit Fragen mit matchenden Tags
 * bevorzugt gezogen werden. Leeres Array = kein Match-Signal.
 */
function getPlayerTagsForTopic(player: Player, topic: Topic): readonly string[] {
  return player.interests.find((i) => i.topic === topic)?.tags ?? []
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

function initSpotlight(teams: Team[], players: readonly Player[], deps: ReducerDeps): SpotlightLive {
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
  for (const id of deps.getAskedQuestionIds()) excluded.add(id)
  // Session H: Difficulty-Match anhand des Spieler-Levels für sein Topic.
  // Session AB: Zusätzlich Tag-Match auf Sub-Interessen des Spielers.
  const level = getPlayerLevelForTopic(firstPlayer, topic)
  const preferredTags = getPlayerTagsForTopic(firstPlayer, topic)
  const question = pickQuestion(topic, excluded, level, preferredTags)

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

/**
 * Fachrunde: Punkte, Timer, halbe Punkte beim Steal.
 */
const EXPERTS_POINTS = 500
const EXPERTS_TIMER_SECONDS = 20

function initExperts(teams: Team[], players: readonly Player[]): ExpertsLive {
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))
  const playerOrder = buildEliminationOrder(teams, players)
  // Wenn keine Spieler vorhanden → sofort Empty. Interessen spielen hier keine Rolle,
  // aber der buildEliminationOrder liefert eine faire Team-Alternation.
  if (playerOrder.length === 0) {
    return {
      kind: 'experts',
      playerOrder: [],
      currentIndex: 0,
      activePlayerId: null,
      activeQuestion: null,
      shuffledOptions: [],
      correctRenderedIndex: 0,
      phase: 'empty',
      expertise: {},
      soloStartedAt: null,
      soloDurationSeconds: EXPERTS_TIMER_SECONDS,
      primaryOutcome: null,
      stealOutcome: null,
      scores,
      usedQuestionIds: [],
      pointsPerCorrect: EXPERTS_POINTS,
    }
  }
  // Setup-Phase: alle Spieler bekommen expertise:null als Startwert.
  return {
    kind: 'experts',
    playerOrder,
    currentIndex: 0,
    activePlayerId: null,
    activeQuestion: null,
    shuffledOptions: [],
    correctRenderedIndex: 0,
    phase: 'setup-experts',
    expertise: Object.fromEntries(playerOrder.map((id) => [id, null])),
    soloStartedAt: null,
    soloDurationSeconds: EXPERTS_TIMER_SECONDS,
    primaryOutcome: null,
    stealOutcome: null,
    scores,
    usedQuestionIds: [],
    pointsPerCorrect: EXPERTS_POINTS,
  }
}

/**
 * Elimination: Punkte pro Richtig und Bonus für letzten Stehenden.
 */
const ELIM_POINTS = 100
const ELIM_SURVIVOR_BONUS = 500

/**
 * Team-alternierende Reihenfolge über alle Spieler — analog Spotlight, aber
 * ohne Interessen-Filter. Team A p0, Team B p0, Team A p1, Team B p1, ...
 */
function buildEliminationOrder(
  teams: readonly Team[],
  players: readonly Player[],
): string[] {
  const perTeam = teams.map((team) =>
    players.filter((p) => p.teamId === team.id),
  )
  const maxLen = Math.max(0, ...perTeam.map((list) => list.length))
  const order: string[] = []
  for (let i = 0; i < maxLen; i++) {
    for (const list of perTeam) {
      if (i < list.length) order.push(list[i].id)
    }
  }
  return order
}

function initElimination(teams: Team[], players: readonly Player[], deps: ReducerDeps): EliminationLive {
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))
  const playerOrder = buildEliminationOrder(teams, players)
  if (playerOrder.length === 0) {
    return {
      kind: 'elimination',
      playerOrder: [],
      eliminatedIds: [],
      currentPlayerIndex: 0,
      activePlayerId: null,
      activeQuestion: null,
      shuffledOptions: [],
      correctRenderedIndex: 0,
      phase: 'empty',
      lastOutcome: null,
      winnerTeamId: null,
      scores,
      usedQuestionIds: [],
      pointsPerCorrect: ELIM_POINTS,
      survivorBonus: ELIM_SURVIVOR_BONUS,
    }
  }

  const firstPlayerId = playerOrder[0]
  const excluded = new Set<string>()
  for (const id of deps.getAskedQuestionIds()) excluded.add(id)
  const question = pickAnyMultipleChoice(excluded)
  if (!question) {
    return {
      kind: 'elimination',
      playerOrder,
      eliminatedIds: [],
      currentPlayerIndex: 0,
      activePlayerId: firstPlayerId,
      activeQuestion: null,
      shuffledOptions: [],
      correctRenderedIndex: 0,
      phase: 'empty',
      lastOutcome: null,
      winnerTeamId: null,
      scores,
      usedQuestionIds: [],
      pointsPerCorrect: ELIM_POINTS,
      survivorBonus: ELIM_SURVIVOR_BONUS,
    }
  }

  const shuffle = shuffleWithMapping(
    question.options,
    `elim:0:${firstPlayerId}:${question.id}`,
  )
  return {
    kind: 'elimination',
    playerOrder,
    eliminatedIds: [],
    currentPlayerIndex: 0,
    activePlayerId: firstPlayerId,
    activeQuestion: question,
    shuffledOptions: shuffle.shuffled,
    correctRenderedIndex: shuffle.renderedIndexOf(question.correctIndex),
    phase: 'answering',
    lastOutcome: null,
    winnerTeamId: null,
    scores,
    usedQuestionIds: [],
    pointsPerCorrect: ELIM_POINTS,
    survivorBonus: ELIM_SURVIVOR_BONUS,
  }
}

/**
 * Duell 1:1: Anzahl Duelle und Punktwert pro richtige Antwort.
 */
const DUEL_TOTAL = 5
const DUEL_POINTS = 300

/**
 * Wählt das duellierende Team-Paar für ein Duell mit Index `duelIndex`.
 * Deterministische Round-Robin-Rotation: (0,1), (1,2), (2,3), (3,0), (0,1), …
 * Bei 2 Teams treten immer beide an; bei 3-4 Teams läuft die Rotation modulo N.
 */
function pickDuelingPair(teams: readonly Team[], duelIndex: number): [string, string] {
  const n = teams.length
  if (n < 2) {
    // Defensive: sollte nie passieren (MIN_TEAMS = 2), aber TS will beide Slots.
    const only = teams[0]?.id ?? 'team-a'
    return [only, only]
  }
  const first = teams[duelIndex % n].id
  const second = teams[(duelIndex + 1) % n].id
  return [first, second]
}

function initDuel(teams: Team[]): DuelLive {
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))
  return {
    kind: 'duel-1v1',
    totalDuels: DUEL_TOTAL,
    currentIndex: 0,
    duelingTeamIds: pickDuelingPair(teams, 0),
    duelPlayers: Object.fromEntries(teams.map((t) => [t.id, null])),
    phase: 'setup-duel',
    activeQuestion: null,
    shuffledOptions: [],
    correctRenderedIndex: 0,
    buzzingTeamId: null,
    primaryOutcome: null,
    stealOutcome: null,
    pointsPerCorrect: DUEL_POINTS,
    scores,
    usedQuestionIds: [],
  }
}

/**
 * Punktejagd: 5×4-Board. Nach Session P ist der Katalog groß genug, um alle vier
 * Difficulty-Stufen mit Wiederholung zu vermeiden.
 */
const BOARD_COLUMNS = 5
const BOARD_VALUES = [100, 200, 300, 400] as const
/** Level je Board-Reihe: Reihe 0 = leicht (bisschen=2), Reihe 3 = experten (nerd=5). */
const BOARD_LEVELS: PlayerInterest['level'][] = [2, 3, 3, 5]

/** Wählt die Topics für das Board — bevorzugt Interessen, füllt sonst nach Katalog auf. */
function pickBoardTopics(profile: ReturnType<typeof computeInterestProfile>): Topic[] {
  const interestOrdered: Topic[] = [
    ...Array.from(profile.shared),
    ...Array.from(profile.individual),
  ]
  const fallbackOrder: Topic[] = [
    'film', 'serien', 'musik', 'games', 'geografie',
    'geschichte', 'wissenschaft', 'sport', 'essen', 'technik',
    'sprache', 'kurioses',
  ]
  const chosen: Topic[] = []
  const seen = new Set<Topic>()
  for (const t of [...interestOrdered, ...fallbackOrder]) {
    if (chosen.length >= BOARD_COLUMNS) break
    if (seen.has(t)) continue
    seen.add(t)
    chosen.push(t)
  }
  return chosen
}

function initCategoryBoard(teams: Team[], players: readonly Player[]): CategoryBoardLive {
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))
  const profile = computeInterestProfile(players)
  const boardTopics = pickBoardTopics(profile)
  return {
    kind: 'category-board',
    boardTopics,
    cellValues: [...BOARD_VALUES],
    playedCells: [],
    phase: 'pick-cell',
    activeCell: null,
    activeQuestion: null,
    shuffledOptions: [],
    correctRenderedIndex: 0,
    buzzingTeamId: null,
    primaryOutcome: null,
    stealOutcome: null,
    scores,
    usedQuestionIds: [],
    cellPickerTeamId: teams[0]?.id ?? null,
  }
}

/**
 * Punkte-Leiter: Werte pro Stufe. Klassischer Millionär-Aufstieg, Prototyp-Höchstwert 5.000.
 */
const LADDER_VALUES = [200, 500, 1000, 2500, 5000] as const

/**
 * Difficulty-Präferenz pro Ladder-Stufe. Frühe Fragen leicht, spätere schwer.
 * Nutzt DIFFICULTY_WEIGHTS aus Session H über `pickAnyMultipleChoice(_, level)`.
 */
/** Level pro Ladder-Stufe (Session X: numerisch, 2=bisschen, 3=gut, 5=nerd). */
const LADDER_LEVELS: PlayerInterest['level'][] = [2, 3, 3, 5, 5]

function pickLadderQuestion(
  usedIds: Set<string>,
  index: number,
): MultipleChoiceQuestion | null {
  const level = LADDER_LEVELS[index] ?? 3
  return pickAnyMultipleChoice(usedIds, level)
}

function initPointsLadder(teams: Team[], deps: ReducerDeps): PointsLadderLive {
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))
  const excluded = new Set<string>()
  for (const id of deps.getAskedQuestionIds()) excluded.add(id)
  const first = pickLadderQuestion(excluded, 0)

  if (!first) {
    return {
      kind: 'points-ladder',
      totalQuestions: LADDER_VALUES.length,
      ladder: [...LADDER_VALUES],
      currentIndex: 0,
      activeQuestion: null,
      shuffledOptions: [],
      correctRenderedIndex: 0,
      teamAnswers: Object.fromEntries(teams.map((t) => [t.id, null])),
      phase: 'empty',
      scores,
      usedQuestionIds: [],
    }
  }

  const shuffle = shuffleWithMapping(
    first.options,
    `ladder:0:${first.id}`,
  )
  return {
    kind: 'points-ladder',
    totalQuestions: LADDER_VALUES.length,
    ladder: [...LADDER_VALUES],
    currentIndex: 0,
    activeQuestion: first,
    shuffledOptions: shuffle.shuffled,
    correctRenderedIndex: shuffle.renderedIndexOf(first.correctIndex),
    teamAnswers: Object.fromEntries(teams.map((t) => [t.id, null])),
    phase: 'answering',
    scores,
    usedQuestionIds: [],
  }
}

function initSprinter(teams: Team[], deps: ReducerDeps): SprinterLive {
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))
  const excluded = new Set<string>()
  for (const id of deps.getAskedQuestionIds()) excluded.add(id)
  const firstTeam = teams[0]
  const first = pickAnyMultipleChoice(excluded)

  if (!first) {
    // Kein MC-Content im Katalog — zwischen-Teams-Phase, wird beim ersten
    // START_NEXT_TEAM in FINISH_MODE laufen.
    return {
      kind: 'sprinter',
      teamOrder: teams.map((t) => t.id),
      currentTeamIndex: 0,
      activeTeamId: null,
      activeQuestion: null,
      shuffledOptions: [],
      correctRenderedIndex: 0,
      phase: 'between-teams',
      sprintStartedAt: null,
      sprintDurationSeconds: 90,
      pointsPerCorrect: 100,
      scores,
      usedQuestionIds: [],
    }
  }

  const shuffle = shuffleWithMapping(
    first.options,
    `sprinter:${firstTeam.id}:0:${first.id}`,
  )
  return {
    kind: 'sprinter',
    teamOrder: teams.map((t) => t.id),
    currentTeamIndex: 0,
    activeTeamId: firstTeam.id,
    activeQuestion: first,
    shuffledOptions: shuffle.shuffled,
    correctRenderedIndex: shuffle.renderedIndexOf(first.correctIndex),
    phase: 'answering',
    sprintStartedAt: Date.now(),
    sprintDurationSeconds: 90,
    pointsPerCorrect: 100,
    scores,
    usedQuestionIds: [],
  }
}

function initAroundCorner(teams: Team[], deps: ReducerDeps): AroundCornerLive {
  const scores = Object.fromEntries(teams.map((t) => [t.id, 0]))
  const excluded = new Set<string>()
  for (const id of deps.getAskedQuestionIds()) excluded.add(id)
  const first = pickWarmupRiddle(excluded)

  if (!first) {
    // Kein Rätsel im Katalog verfügbar — Modus signalisiert Empty und wird beim
    // ersten NEXT übersprungen.
    return {
      kind: 'around-corner',
      totalRiddles: 5,
      currentIndex: 0,
      activeQuestion: null,
      revealedHints: 0,
      phase: 'empty',
      scores,
      usedQuestionIds: [],
    }
  }

  return {
    kind: 'around-corner',
    totalRiddles: 5,
    currentIndex: 0,
    activeQuestion: first,
    revealedHints: 0,
    phase: 'guessing',
    scores,
    usedQuestionIds: [],
  }
}

function initLiveFor(
  modeId: GameModeId,
  teams: Team[],
  players: readonly Player[],
  deps: ReducerDeps,
): LiveGame | null {
  switch (modeId) {
    case 'category-duel':
      return initCategoryDuel(teams)
    case 'flash':
      return initFlash(teams, players, deps)
    case 'player-spotlight':
      return initSpotlight(teams, players, deps)
    case 'around-corner':
      return initAroundCorner(teams, deps)
    case 'sprinter':
      return initSprinter(teams, deps)
    case 'points-ladder':
      return initPointsLadder(teams, deps)
    case 'category-board':
      return initCategoryBoard(teams, players)
    case 'duel-1v1':
      return initDuel(teams)
    case 'elimination':
      return initElimination(teams, players, deps)
    case 'experts':
      return initExperts(teams, players)
    default:
      // Alle anderen Modi sind in v0.1 als `planned` markiert und lassen sich im Setup
      // gar nicht auswählen. Falls doch: null → Reducer springt in FINISH_MODE.
      return null
  }
}

/**
 * Factory-Funktion: bindet die Reducer-Deps (z. B. `getAskedQuestionIds`)
 * und liefert einen React-kompatiblen Reducer zurück. Frontend baut die
 * Deps mit `localStorage`-Wrapper, Lambda mit DynamoDB.
 */
export function createReducer(deps: ReducerDeps) {
  return function reducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
    case 'SET_TEAM_NAME': {
      const teams = state.draft.teams.map((t) =>
        t.id === action.teamId ? { ...t, name: action.name } : t,
      )
      return { ...state, draft: { ...state.draft, teams } }
    }

    case 'ADD_TEAM': {
      // Nur in Setup-Phase; darüber hinaus sind Teams bereits in `round.teams`
      // eingefroren und Player den Teams zugeordnet.
      if (state.phase !== 'setup') return state
      if (state.draft.teams.length >= MAX_TEAMS) return state
      // Nächsten freien Slot aus TEAM_COLOR_ORDER wählen — deterministisch nach
      // Anzahl, weil `makeDefaultTeam(i)` genau die i-te Farbe liefert.
      const nextIndex = state.draft.teams.length
      const teams = [...state.draft.teams, makeDefaultTeam(nextIndex)]
      return { ...state, draft: { ...state.draft, teams } }
    }

    case 'REMOVE_TEAM': {
      if (state.phase !== 'setup') return state
      if (state.draft.teams.length <= MIN_TEAMS) return state
      const teams = state.draft.teams.filter((t) => t.id !== action.teamId)
      if (teams.length === state.draft.teams.length) return state
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
      if (state.draft.teams.length < MIN_TEAMS) return state
      const teams: Team[] = state.draft.teams.map((t, i) => ({
        id: t.id,
        // Leere Namen bekommen den Default-Namen für ihren Slot-Index (Nova/Pulsar/Solaris/Nebula).
        name: t.name.trim() || makeDefaultTeam(i).name,
        color: t.color,
      }))
      // Session S: Default-Player landen im Pool (teamId = null). Der Assign-Schritt
      // verteilt sie später via Shuffle oder Drag-and-Drop.
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
        lobbyStep: 'roster',
        round,
        results: [],
        matchPoints: Object.fromEntries(teams.map((t) => [t.id, 0])),
        currentModeIndex: 0,
        live: null,
      }
    }

    case 'START_PLAYING': {
      if (!state.round) return state
      // Session S: Player müssen alle einem Team zugeordnet sein. Sonst schweigt der
      // Reducer — das UI ist dafür verantwortlich, den Start-CTA zu sperren.
      const anyUnassigned = state.round.players.some((p) => p.teamId === null)
      if (anyUnassigned) return state
      const firstModeId = state.round.gameModes[0]
      const live = initLiveFor(firstModeId, state.round.teams, state.round.players, deps)
      return { ...state, phase: 'playing', currentModeIndex: 0, live }
    }

    case 'LOBBY_ADVANCE': {
      if (state.phase !== 'lobby' || !state.round) return state
      if (state.lobbyStep === 'roster') {
        // Weiter in den Assign-Schritt.
        return { ...state, lobbyStep: 'assign' }
      }
      if (state.lobbyStep === 'assign') {
        // Nur weiter, wenn alle Player einem Team zugeordnet sind.
        const allAssigned = state.round.players.every((p) => p.teamId !== null)
        if (!allAssigned) return state
        return { ...state, lobbyStep: 'ready' }
      }
      return state
    }

    case 'LOBBY_BACK': {
      if (state.phase !== 'lobby') return state
      if (state.lobbyStep === 'assign')  return { ...state, lobbyStep: 'roster' }
      if (state.lobbyStep === 'ready')   return { ...state, lobbyStep: 'assign' }
      return state
    }

    case 'SHUFFLE_PLAYERS': {
      if (!state.round || state.phase !== 'lobby') return state
      // Alle Player werden gemischt und der Reihe nach auf Teams verteilt
      // (Round-Robin). Damit sind Team-Größen möglichst gleich (±1 Spieler).
      const players = [...state.round.players]
      // Fisher-Yates-Shuffle. Math.random ist in Tests fixiert → deterministisch.
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[players[i], players[j]] = [players[j], players[i]]
      }
      const teams = state.round.teams
      if (teams.length === 0) return state
      const shuffledPlayers = players.map((p, idx) => ({
        ...p,
        teamId: teams[idx % teams.length].id,
      }))
      return {
        ...state,
        round: {
          ...state.round,
          players: shuffledPlayers,
          interests: aggregatePlayerInterests(shuffledPlayers),
        },
      }
    }

    case 'MOVE_PLAYER_TO_TEAM': {
      if (!state.round || state.phase !== 'lobby') return state
      const target = state.round.players.find((p) => p.id === action.playerId)
      if (!target) return state
      // Kein No-op-Aufruf (spart eine State-Kopie beim Drag zurück aufs eigene Team).
      if (target.teamId === action.teamId) return state
      // Ziel-Team validieren (null = Pool ist immer erlaubt).
      if (
        action.teamId !== null &&
        !state.round.teams.some((t) => t.id === action.teamId)
      ) {
        return state
      }
      // Ziel-Team hat Kapazitäts-Limit — Pool nicht.
      if (
        action.teamId !== null &&
        countPlayersInTeam(state.round.players, action.teamId) >= MAX_PLAYERS_PER_TEAM
      ) {
        return state
      }
      const players = state.round.players.map((p) =>
        p.id === action.playerId ? { ...p, teamId: action.teamId } : p,
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

    case 'ADD_PLAYER': {
      if (!state.round || state.phase !== 'lobby') return state
      // Team-Slots haben ein Cap; der Pool (teamId=null) hat effektiv ein Cap
      // von MAX_TEAMS × MAX_PLAYERS_PER_TEAM (16), das reicht immer.
      if (
        action.teamId !== null &&
        countPlayersInTeam(state.round.players, action.teamId) >= MAX_PLAYERS_PER_TEAM
      ) {
        return state
      }
      // Idempotent: wenn bereits ein Player mit dieser ID existiert (typisch
      // beim Reconnect eines Multi-Device-Handys), keinen zweiten anlegen.
      if (action.playerId && state.round.players.some((p) => p.id === action.playerId)) {
        return state
      }
      const newPlayer: Player = {
        id: action.playerId ?? newPlayerId(),
        name: action.playerName ?? '',
        teamId: action.teamId,
        interests: [],
        avatar: getDefaultAvatar(state.round.players.length),
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

    case 'INIT_MULTIPLAYER_ROUND': {
      // Multi-Device-Einstieg: Server ruft das beim ersten Player-Join auf,
      // wenn der Room noch in `setup` steht und keine Runde existiert.
      // Unterschied zu GO_TO_LOBBY: legt eine LEERE Spielerliste an, damit
      // die Player-Handys sich selbst per ADD_PLAYER hinzufügen. Offline-
      // Setups mit vorgefüllten Slot-Playern nutzen weiter GO_TO_LOBBY.
      if (state.phase !== 'setup') return state
      if (state.draft.selectedModes.length === 0) return state
      if (state.draft.teams.length < MIN_TEAMS) return state
      const teams: Team[] = state.draft.teams.map((t, i) => ({
        id: t.id,
        name: t.name.trim() || makeDefaultTeam(i).name,
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
        players: [],
        interests: [],
      }
      return {
        ...state,
        phase: 'lobby',
        lobbyStep: 'roster',
        round,
        results: [],
        matchPoints: Object.fromEntries(teams.map((t) => [t.id, 0])),
        currentModeIndex: 0,
        live: null,
      }
    }

    case 'REMOVE_PLAYER': {
      if (!state.round || state.phase !== 'lobby') return state
      const target = state.round.players.find((p) => p.id === action.playerId)
      if (!target) return state
      // Pool-Player können immer entfernt werden. Team-Player nur, wenn das Team
      // danach noch MIN_PLAYERS_PER_TEAM erfüllt (nur relevant im Ready-Schritt).
      if (
        target.teamId !== null &&
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

    case 'SET_PLAYER_INTEREST_TAGS': {
      if (!state.round || state.phase !== 'lobby') return state
      // Trim + Dedup + leere Strings raus. Groß-/Kleinschreibung beibehalten
      // wie eingetippt (Anzeige-Freundlich), aber Duplikate case-insensitive filtern.
      const seenLower = new Set<string>()
      const cleanTags: string[] = []
      for (const raw of action.tags) {
        const t = raw.trim()
        if (!t) continue
        const key = t.toLowerCase()
        if (seenLower.has(key)) continue
        seenLower.add(key)
        cleanTags.push(t)
      }
      const players = state.round.players.map((p) => {
        if (p.id !== action.playerId) return p
        // Nur ändern, wenn der Player das Topic auch aktiviert hat.
        // Sonst wäre ein „Sub-Interest ohne Grob-Interest" möglich, was
        // die Aggregation stört.
        const has = p.interests.some((i) => i.topic === action.topic)
        if (!has) return p
        const interests = p.interests.map((i) =>
          i.topic === action.topic ? { ...i, tags: cleanTags } : i,
        )
        return { ...p, interests }
      })
      return {
        ...state,
        round: { ...state.round, players },
      }
    }

    case 'SET_PLAYER_AVATAR': {
      if (!state.round || state.phase !== 'lobby') return state
      const players = state.round.players.map((p) =>
        p.id === action.playerId ? { ...p, avatar: action.avatar } : p,
      )
      return { ...state, round: { ...state.round, players } }
    }

    case 'ADD_PLAYER_FROM_LIBRARY': {
      if (!state.round || state.phase !== 'lobby') return state
      // Team-Cap gilt nur bei tatsächlicher Team-Zuordnung; Pool-Adds sind frei.
      if (
        action.teamId !== null &&
        countPlayersInTeam(state.round.players, action.teamId) >= MAX_PLAYERS_PER_TEAM
      ) {
        return state
      }
      // Verhindern, dass das gleiche Profil doppelt zur Runde hinzugefügt wird.
      if (state.round.players.some((p) => p.id === action.profile.id)) return state
      const newPlayer: Player = {
        id: action.profile.id,
        name: action.profile.name,
        teamId: action.teamId,
        interests: action.profile.interests,
        avatar: action.profile.avatar,
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

    case 'REPLACE_PLAYER_FROM_LIBRARY': {
      if (!state.round || state.phase !== 'lobby') return state
      const target = state.round.players.find((p) => p.id === action.playerId)
      if (!target) return state
      // Wenn das Profil bereits in einem anderen Slot dieser Runde steht: ablehnen.
      if (
        state.round.players.some((p) => p.id === action.profile.id && p.id !== target.id)
      ) {
        return state
      }
      const players = state.round.players.map((p) =>
        p.id === action.playerId
          ? {
              ...p,
              id: action.profile.id,
              name: action.profile.name,
              interests: action.profile.interests,
              avatar: action.profile.avatar,
            }
          : p,
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
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      // Session H: Level aus der Player-Aggregation (Max-Level pro Topic) fließt in
      // die Difficulty-Wahl der Frage ein.
      const cdProfile = computeInterestProfile(state.round.players)
      const preferredLevel = cdProfile.levelPerTopic.get(action.topic)
      // Session AB: Aggregierte Sub-Interessen aller Spieler für dieses Topic
      // fließen als Tag-Bonus in die Fragenwahl ein.
      const cdTopicTags = cdProfile.tagsPerTopic?.get(action.topic)
      const cdPreferredTags = cdTopicTags ? Array.from(cdTopicTags) : undefined
      const question = pickQuestion(action.topic, excluded, preferredLevel, cdPreferredTags)
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
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
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
      if (!player || player.teamId === null) return state
      const primaryTeamId = player.teamId

      if (action.outcome === 'correct') {
        const scores = {
          ...live.scores,
          [primaryTeamId]: live.scores[primaryTeamId] + live.pointsPerCorrect,
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
      if (!player || player.teamId === null) return state
      // Bei 2 Teams: automatisch das eine Gegenteam. Bei 3+ Teams: deterministisch
      // das nächste Team in der Rotation (fair über die Runden).
      const opponentId = getNextTeamId(state.round.teams, player.teamId)
      const opponent = opponentId ? state.round.teams.find((t) => t.id === opponentId) : null
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
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const nextLevel = getPlayerLevelForTopic(nextPlayer, topic)
      const nextTags = getPlayerTagsForTopic(nextPlayer, topic)
      const nextQuestion = pickQuestion(topic, excluded, nextLevel, nextTags)
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

    case 'AC_REVEAL_HINT': {
      if (!state.live || state.live.kind !== 'around-corner') return state
      if (state.live.phase !== 'guessing' || !state.live.activeQuestion) return state
      const maxHints = state.live.activeQuestion.hints.length
      if (state.live.revealedHints >= maxHints) return state
      return {
        ...state,
        live: { ...state.live, revealedHints: state.live.revealedHints + 1 },
      }
    }

    case 'AC_REVEAL_SOLUTION': {
      if (!state.live || state.live.kind !== 'around-corner') return state
      if (state.live.phase !== 'guessing') return state
      return { ...state, live: { ...state.live, phase: 'revealed' } }
    }

    case 'AC_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'around-corner') return state
      // Empty-Fall: direkt zu FINISH_MODE.
      if (state.live.phase === 'empty') {
        return reducer(state, { type: 'FINISH_MODE' })
      }
      if (state.live.phase !== 'revealed') return state

      const usedQuestionIds = state.live.activeQuestion
        ? [...state.live.usedQuestionIds, state.live.activeQuestion.id]
        : state.live.usedQuestionIds
      const nextIndex = state.live.currentIndex + 1
      const isModeDone = nextIndex >= state.live.totalRiddles

      const advancedBase: AroundCornerLive = {
        ...state.live,
        usedQuestionIds,
        currentIndex: nextIndex,
        activeQuestion: null,
        revealedHints: 0,
        phase: 'guessing',
      }

      if (isModeDone) {
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      const excluded = new Set(usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const nextQuestion = pickWarmupRiddle(excluded)
      if (!nextQuestion) {
        // Pool leer — vorzeitig beenden.
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      return {
        ...state,
        live: { ...advancedBase, activeQuestion: nextQuestion },
      }
    }

    case 'EXPERTS_SET_EXPERTISE': {
      if (!state.round || !state.live || state.live.kind !== 'experts') return state
      const live = state.live
      if (live.phase !== 'setup-experts') return state
      if (!(action.playerId in live.expertise)) return state
      return {
        ...state,
        live: {
          ...live,
          expertise: { ...live.expertise, [action.playerId]: action.topic },
        },
      }
    }

    case 'EXPERTS_START_ROUND': {
      if (!state.round || !state.live || state.live.kind !== 'experts') return state
      const live = state.live
      if (live.phase !== 'setup-experts') return state

      const activeOrder = live.playerOrder.filter((id) => live.expertise[id] !== null)
      if (activeOrder.length === 0) {
        // Kein Spieler hat ein Fach → Modus überspringen.
        return reducer(
          {
            ...state,
            live: { ...live, phase: 'empty', playerOrder: [] },
          },
          { type: 'FINISH_MODE' },
        )
      }

      const firstPlayerId = activeOrder[0]
      const topic = live.expertise[firstPlayerId]!
      const excluded = new Set<string>()
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const player = state.round.players.find((p) => p.id === firstPlayerId)
      const level = player ? getPlayerLevelForTopic(player, topic) : undefined
      const tags = player ? getPlayerTagsForTopic(player, topic) : undefined
      const question = pickQuestion(topic, excluded, level, tags)

      if (!question) {
        // Kein Content für dieses Fach → weiterspringen.
        return reducer(
          { ...state, live: { ...live, phase: 'empty', playerOrder: activeOrder } },
          { type: 'FINISH_MODE' },
        )
      }

      const shuffle = shuffleWithMapping(
        question.options,
        `experts:${firstPlayerId}:${question.id}`,
      )
      return {
        ...state,
        live: {
          ...live,
          playerOrder: activeOrder,
          currentIndex: 0,
          activePlayerId: firstPlayerId,
          activeQuestion: question,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(question.correctIndex),
          phase: 'primary',
          soloStartedAt: Date.now(),
          primaryOutcome: null,
          stealOutcome: null,
        },
      }
    }

    case 'EXPERTS_MARK_PRIMARY': {
      if (!state.round || !state.live || state.live.kind !== 'experts') return state
      const live = state.live
      if (live.phase !== 'primary' || !live.activePlayerId) return state
      const player = state.round.players.find((p) => p.id === live.activePlayerId)
      if (!player || player.teamId === null) return state
      const primaryTeamId = player.teamId

      if (action.outcome === 'correct') {
        const scores = {
          ...live.scores,
          [primaryTeamId]: (live.scores[primaryTeamId] ?? 0) + live.pointsPerCorrect,
        }
        return {
          ...state,
          live: {
            ...live,
            phase: 'revealed',
            primaryOutcome: 'correct',
            soloStartedAt: null,
            scores,
          },
        }
      }
      // wrong oder timeout → Steal.
      return {
        ...state,
        live: {
          ...live,
          phase: 'steal-answer',
          primaryOutcome: action.outcome,
          soloStartedAt: null,
        },
      }
    }

    case 'EXPERTS_STEAL_ANSWER': {
      if (!state.round || !state.live || state.live.kind !== 'experts') return state
      const live = state.live
      if (live.phase !== 'steal-answer' || !live.activePlayerId) return state
      const player = state.round.players.find((p) => p.id === live.activePlayerId)
      if (!player || player.teamId === null) return state
      // Steal-Rotation: bei 2 Teams das eine Gegenteam, bei 3+ das nächste in der Reihenfolge.
      const opponentId = getNextTeamId(state.round.teams, player.teamId)
      const opponent = opponentId ? state.round.teams.find((t) => t.id === opponentId) : null
      if (!opponent) return state
      const wasCorrect = action.renderedIndex === live.correctRenderedIndex
      const stealPoints = Math.floor(live.pointsPerCorrect / 2)
      const scores = wasCorrect
        ? {
            ...live.scores,
            [opponent.id]: (live.scores[opponent.id] ?? 0) + stealPoints,
          }
        : live.scores
      return {
        ...state,
        live: {
          ...live,
          phase: 'revealed',
          stealOutcome: wasCorrect ? 'correct' : 'wrong',
          scores,
        },
      }
    }

    case 'EXPERTS_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'experts') return state
      const live = state.live
      if (live.phase === 'empty') return reducer(state, { type: 'FINISH_MODE' })
      if (live.phase !== 'revealed') return state

      const usedQuestionIds = live.activeQuestion
        ? [...live.usedQuestionIds, live.activeQuestion.id]
        : live.usedQuestionIds
      const nextIndex = live.currentIndex + 1
      const isModeDone = nextIndex >= live.playerOrder.length

      const advancedBase: ExpertsLive = {
        ...live,
        usedQuestionIds,
        currentIndex: nextIndex,
        activePlayerId: null,
        activeQuestion: null,
        shuffledOptions: [],
        correctRenderedIndex: 0,
        phase: 'primary',
        soloStartedAt: null,
        primaryOutcome: null,
        stealOutcome: null,
      }

      if (isModeDone) {
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      const nextPlayerId = live.playerOrder[nextIndex]
      const topic = live.expertise[nextPlayerId]
      const nextPlayer = state.round.players.find((p) => p.id === nextPlayerId)
      if (!topic || !nextPlayer) {
        return reducer({ ...state, live: advancedBase }, { type: 'EXPERTS_NEXT' })
      }

      const excluded = new Set(usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const level = getPlayerLevelForTopic(nextPlayer, topic)
      const tags = getPlayerTagsForTopic(nextPlayer, topic)
      const nextQuestion = pickQuestion(topic, excluded, level, tags)
      if (!nextQuestion) {
        return reducer({ ...state, live: advancedBase }, { type: 'EXPERTS_NEXT' })
      }

      const shuffle = shuffleWithMapping(
        nextQuestion.options,
        `experts:${nextPlayerId}:${nextQuestion.id}`,
      )
      return {
        ...state,
        live: {
          ...advancedBase,
          activePlayerId: nextPlayerId,
          activeQuestion: nextQuestion,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(nextQuestion.correctIndex),
          soloStartedAt: Date.now(),
        },
      }
    }

    case 'ELIM_ANSWER': {
      if (!state.round || !state.live || state.live.kind !== 'elimination') return state
      const live = state.live
      if (live.phase !== 'answering' || !live.activePlayerId || !live.activeQuestion) return state
      const activePlayer = state.round.players.find((p) => p.id === live.activePlayerId)
      if (!activePlayer || activePlayer.teamId === null) return state
      const activeTeamId = activePlayer.teamId
      const wasCorrect = action.renderedIndex === live.correctRenderedIndex
      const nextScores = wasCorrect
        ? {
            ...live.scores,
            [activeTeamId]: (live.scores[activeTeamId] ?? 0) + live.pointsPerCorrect,
          }
        : live.scores
      return {
        ...state,
        live: {
          ...live,
          phase: 'revealed',
          lastOutcome: wasCorrect ? 'correct' : 'wrong',
          scores: nextScores,
        },
      }
    }

    case 'ELIM_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'elimination') return state
      const live = state.live
      // Empty-Fall: direkt in FINISH_MODE.
      if (live.phase === 'empty') return reducer(state, { type: 'FINISH_MODE' })
      // Finished-Fall: schließt den Modus.
      if (live.phase === 'finished') return reducer(state, { type: 'FINISH_MODE' })
      if (live.phase !== 'revealed') return state
      if (!live.activePlayerId || !live.activeQuestion) return state

      const usedQuestionIds = [...live.usedQuestionIds, live.activeQuestion.id]
      const activePlayerId = live.activePlayerId
      const activePlayer = state.round.players.find((p) => p.id === activePlayerId)
      if (!activePlayer) return state

      // Bei falscher Antwort: Spieler eliminieren.
      const eliminatedIds =
        live.lastOutcome === 'wrong'
          ? [...live.eliminatedIds, activePlayerId]
          : live.eliminatedIds

      // Verbleibende Spieler ermitteln.
      const remainingIds = live.playerOrder.filter((id) => !eliminatedIds.includes(id))
      const remainingTeams = new Set(
        remainingIds
          .map((id) => state.round!.players.find((p) => p.id === id)?.teamId)
          .filter((v): v is string => !!v),
      )

      // End-Kriterium: nur noch ein Team übrig (oder gar keiner).
      if (remainingTeams.size <= 1) {
        const winnerTeamId = remainingTeams.size === 1 ? [...remainingTeams][0] : null
        const scoresWithBonus = winnerTeamId
          ? {
              ...live.scores,
              [winnerTeamId]: (live.scores[winnerTeamId] ?? 0) + live.survivorBonus,
            }
          : live.scores
        return {
          ...state,
          live: {
            ...live,
            usedQuestionIds,
            eliminatedIds,
            phase: 'finished',
            winnerTeamId,
            scores: scoresWithBonus,
            activeQuestion: null,
            shuffledOptions: [],
            correctRenderedIndex: 0,
            lastOutcome: null,
          },
        }
      }

      // Nächster nicht-eliminierter Spieler in rotierender Reihenfolge.
      let nextIndex = (live.currentPlayerIndex + 1) % live.playerOrder.length
      let nextPlayerId = live.playerOrder[nextIndex]
      // Skip eliminated (garantiert findet — remainingIds ist non-empty).
      let safety = 0
      while (eliminatedIds.includes(nextPlayerId) && safety < live.playerOrder.length) {
        nextIndex = (nextIndex + 1) % live.playerOrder.length
        nextPlayerId = live.playerOrder[nextIndex]
        safety++
      }

      // Nächste Frage ziehen.
      const excluded = new Set(usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const nextQuestion = pickAnyMultipleChoice(excluded)
      if (!nextQuestion) {
        // Kein MC mehr → Modus mit aktuellem Stand beenden.
        const winnerTeamId = remainingTeams.size === 1 ? [...remainingTeams][0] : null
        const scoresWithBonus = winnerTeamId
          ? {
              ...live.scores,
              [winnerTeamId]: (live.scores[winnerTeamId] ?? 0) + live.survivorBonus,
            }
          : live.scores
        return {
          ...state,
          live: {
            ...live,
            usedQuestionIds,
            eliminatedIds,
            phase: 'finished',
            winnerTeamId,
            scores: scoresWithBonus,
            activeQuestion: null,
            shuffledOptions: [],
            correctRenderedIndex: 0,
            lastOutcome: null,
          },
        }
      }

      const shuffle = shuffleWithMapping(
        nextQuestion.options,
        `elim:${nextIndex}:${nextPlayerId}:${nextQuestion.id}`,
      )
      return {
        ...state,
        live: {
          ...live,
          usedQuestionIds,
          eliminatedIds,
          currentPlayerIndex: nextIndex,
          activePlayerId: nextPlayerId,
          activeQuestion: nextQuestion,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(nextQuestion.correctIndex),
          phase: 'answering',
          lastOutcome: null,
        },
      }
    }

    case 'DUEL_SET_PLAYER': {
      if (!state.round || !state.live || state.live.kind !== 'duel-1v1') return state
      const live = state.live
      if (live.phase !== 'setup-duel') return state
      if (!(action.teamId in live.duelPlayers)) return state
      // Nur die duellierenden Teams dürfen ihren Vertreter setzen. Bei 2 Teams
      // sind das immer beide; bei 3+ Teams sitzen die anderen aus.
      if (!live.duelingTeamIds.includes(action.teamId)) return state
      // Prüfen, ob der Spieler zum richtigen Team gehört.
      const player = state.round.players.find((p) => p.id === action.playerId)
      if (!player || player.teamId !== action.teamId) return state

      const nextDuelPlayers = { ...live.duelPlayers, [action.teamId]: action.playerId }
      // allSelected zählt NUR die duellierenden Teams (nicht die aussitzenden).
      const allSelected = live.duelingTeamIds.every((id) => nextDuelPlayers[id] !== null)
      if (!allSelected) {
        return { ...state, live: { ...live, duelPlayers: nextDuelPlayers } }
      }

      // Beide Vertreter stehen — Frage laden und in awaiting-buzz übergehen.
      const excluded = new Set(live.usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const question = pickAnyMultipleChoice(excluded)
      if (!question) {
        // Keine MC-Frage verfügbar — Duell überspringen (direkt in FINISH_MODE).
        return reducer(
          { ...state, live: { ...live, duelPlayers: nextDuelPlayers } },
          { type: 'FINISH_MODE' },
        )
      }

      const shuffle = shuffleWithMapping(
        question.options,
        `duel:${live.currentIndex}:${question.id}`,
      )
      return {
        ...state,
        live: {
          ...live,
          duelPlayers: nextDuelPlayers,
          phase: 'awaiting-buzz',
          activeQuestion: question,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(question.correctIndex),
        },
      }
    }

    case 'DUEL_BUZZER': {
      if (!state.round || !state.live || state.live.kind !== 'duel-1v1') return state
      const live = state.live
      if (live.phase !== 'awaiting-buzz') return state
      if (!(action.teamId in live.duelPlayers)) return state
      // Nur duellierende Teams dürfen buzzern (bei 3+ Teams).
      if (!live.duelingTeamIds.includes(action.teamId)) return state
      return {
        ...state,
        live: { ...live, phase: 'primary-answer', buzzingTeamId: action.teamId },
      }
    }

    case 'DUEL_ANSWER': {
      if (!state.round || !state.live || state.live.kind !== 'duel-1v1') return state
      const live = state.live
      if (!live.activeQuestion) return state
      const value = live.pointsPerCorrect
      const wasCorrect = action.renderedIndex === live.correctRenderedIndex

      if (live.phase === 'primary-answer') {
        if (!live.buzzingTeamId) return state
        if (wasCorrect) {
          const scores = {
            ...live.scores,
            [live.buzzingTeamId]: (live.scores[live.buzzingTeamId] ?? 0) + value,
          }
          return {
            ...state,
            live: { ...live, phase: 'revealed', primaryOutcome: 'correct', scores },
          }
        }
        return {
          ...state,
          live: { ...live, phase: 'steal-answer', primaryOutcome: 'wrong' },
        }
      }

      if (live.phase === 'steal-answer') {
        // Duell: Steal geht an das zweite duellierende Team (bei 2 Teams: das andere,
        // bei 3+ Teams: das nicht-buzzende der beiden aktuellen Duell-Teams).
        if (!live.buzzingTeamId) return state
        const opponentId = live.duelingTeamIds.find((id) => id !== live.buzzingTeamId)
        const opponent = opponentId ? state.round.teams.find((t) => t.id === opponentId) : null
        if (!opponent) return state
        if (wasCorrect) {
          const scores = {
            ...live.scores,
            [opponent.id]: (live.scores[opponent.id] ?? 0) + value,
          }
          return {
            ...state,
            live: { ...live, phase: 'revealed', stealOutcome: 'correct', scores },
          }
        }
        return {
          ...state,
          live: { ...live, phase: 'revealed', stealOutcome: 'wrong' },
        }
      }

      return state
    }

    case 'DUEL_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'duel-1v1') return state
      const live = state.live
      if (live.phase !== 'revealed') return state

      const usedQuestionIds = live.activeQuestion
        ? [...live.usedQuestionIds, live.activeQuestion.id]
        : live.usedQuestionIds
      const nextIndex = live.currentIndex + 1
      const isModeDone = nextIndex >= live.totalDuels

      const advancedBase: DuelLive = {
        ...live,
        usedQuestionIds,
        currentIndex: nextIndex,
        // Nächstes Duell-Paar via Round-Robin-Rotation (bei 2 Teams immer die gleichen zwei).
        duelingTeamIds: pickDuelingPair(state.round.teams, nextIndex),
        // Vertreter für das nächste Duell wieder frei wählbar.
        duelPlayers: Object.fromEntries(
          state.round.teams.map((t) => [t.id, null]),
        ),
        phase: 'setup-duel',
        activeQuestion: null,
        shuffledOptions: [],
        correctRenderedIndex: 0,
        buzzingTeamId: null,
        primaryOutcome: null,
        stealOutcome: null,
      }

      if (isModeDone) {
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      return { ...state, live: advancedBase }
    }

    case 'BOARD_PICK_CELL': {
      if (!state.round || !state.live || state.live.kind !== 'category-board') return state
      const live = state.live
      if (live.phase !== 'pick-cell') return state
      if (!live.boardTopics.includes(action.topic)) return state
      if (action.valueIndex < 0 || action.valueIndex >= live.cellValues.length) return state
      const alreadyPlayed = live.playedCells.some(
        (c) => c.topic === action.topic && c.valueIndex === action.valueIndex,
      )
      if (alreadyPlayed) return state

      const excluded = new Set(live.usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const preferredLevel = BOARD_LEVELS[action.valueIndex] ?? 3
      // Session AB: Board-Fragen greifen auf die aggregierten Sub-Interessen
      // aller Spieler für dieses Topic zurück (Team-Modus, kein Solo-Kontext).
      const boardProfile = computeInterestProfile(state.round.players)
      const boardTopicTags = boardProfile.tagsPerTopic?.get(action.topic)
      const boardPreferredTags = boardTopicTags ? Array.from(boardTopicTags) : undefined
      const question = pickQuestion(action.topic, excluded, preferredLevel, boardPreferredTags)
      if (!question) return state

      const shuffle = shuffleWithMapping(
        question.options,
        `board:${action.topic}:${action.valueIndex}:${question.id}`,
      )
      return {
        ...state,
        live: {
          ...live,
          phase: 'awaiting-buzz',
          activeCell: { topic: action.topic, valueIndex: action.valueIndex },
          activeQuestion: question,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(question.correctIndex),
          buzzingTeamId: null,
          primaryOutcome: null,
          stealOutcome: null,
        },
      }
    }

    case 'BOARD_BUZZER': {
      if (!state.round || !state.live || state.live.kind !== 'category-board') return state
      const live = state.live
      if (live.phase !== 'awaiting-buzz') return state
      if (!state.round.teams.some((t) => t.id === action.teamId)) return state
      return {
        ...state,
        live: {
          ...live,
          phase: 'primary-answer',
          buzzingTeamId: action.teamId,
        },
      }
    }

    case 'BOARD_ANSWER': {
      if (!state.round || !state.live || state.live.kind !== 'category-board') return state
      const live = state.live
      if (!live.activeCell || !live.activeQuestion) return state
      const value = live.cellValues[live.activeCell.valueIndex] ?? 0
      const wasCorrect = action.renderedIndex === live.correctRenderedIndex

      if (live.phase === 'primary-answer') {
        if (!live.buzzingTeamId) return state
        if (wasCorrect) {
          const scores = {
            ...live.scores,
            [live.buzzingTeamId]: (live.scores[live.buzzingTeamId] ?? 0) + value,
          }
          return {
            ...state,
            live: { ...live, phase: 'revealed', primaryOutcome: 'correct', scores },
          }
        }
        // Fehler → Steal-Phase für das Gegenteam.
        return {
          ...state,
          live: { ...live, phase: 'steal-answer', primaryOutcome: 'wrong' },
        }
      }

      if (live.phase === 'steal-answer') {
        // Steal-Rotation: bei 2 Teams automatisch das eine Gegenteam, bei 3+ Teams
        // das nächste in der Team-Reihenfolge (deterministisch, fair).
        if (!live.buzzingTeamId) return state
        const opponentId = getNextTeamId(state.round.teams, live.buzzingTeamId)
        const opponent = opponentId ? state.round.teams.find((t) => t.id === opponentId) : null
        if (!opponent) return state
        if (wasCorrect) {
          const scores = {
            ...live.scores,
            [opponent.id]: (live.scores[opponent.id] ?? 0) + value,
          }
          return {
            ...state,
            live: { ...live, phase: 'revealed', stealOutcome: 'correct', scores },
          }
        }
        return {
          ...state,
          live: { ...live, phase: 'revealed', stealOutcome: 'wrong' },
        }
      }

      return state
    }

    case 'BOARD_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'category-board') return state
      const live = state.live
      if (live.phase !== 'revealed' || !live.activeCell) return state

      const playedCells = [...live.playedCells, live.activeCell]
      const usedQuestionIds = live.activeQuestion
        ? [...live.usedQuestionIds, live.activeQuestion.id]
        : live.usedQuestionIds
      const totalCells = live.boardTopics.length * live.cellValues.length
      const isBoardDone = playedCells.length >= totalCells

      // Zell-Wahlrecht rotiert durch alle Teams. Bei 2 Teams = Alternation,
      // bei 3+ Teams läuft der Picker reihum.
      const nextPickerId = live.cellPickerTeamId
        ? getNextTeamId(state.round.teams, live.cellPickerTeamId) ?? live.cellPickerTeamId
        : (state.round.teams[0]?.id ?? null)

      const advancedBase: CategoryBoardLive = {
        ...live,
        playedCells,
        usedQuestionIds,
        phase: 'pick-cell',
        activeCell: null,
        activeQuestion: null,
        shuffledOptions: [],
        correctRenderedIndex: 0,
        buzzingTeamId: null,
        primaryOutcome: null,
        stealOutcome: null,
        cellPickerTeamId: nextPickerId,
      }

      if (isBoardDone) {
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      return { ...state, live: advancedBase }
    }

    case 'LADDER_SET_ANSWER': {
      if (!state.live || state.live.kind !== 'points-ladder') return state
      if (state.live.phase !== 'answering') return state
      if (!(action.teamId in state.live.teamAnswers)) return state
      return {
        ...state,
        live: {
          ...state.live,
          teamAnswers: {
            ...state.live.teamAnswers,
            [action.teamId]: action.renderedIndex,
          },
        },
      }
    }

    case 'LADDER_REVEAL': {
      if (!state.live || state.live.kind !== 'points-ladder') return state
      if (state.live.phase !== 'answering' || !state.live.activeQuestion) return state
      // Nur auflösen, wenn beide Teams gewählt haben.
      const allAnswered = Object.values(state.live.teamAnswers).every((a) => a !== null)
      if (!allAnswered) return state

      const value = state.live.ladder[state.live.currentIndex] ?? 0
      const nextScores = { ...state.live.scores }
      for (const [teamId, answer] of Object.entries(state.live.teamAnswers)) {
        if (answer === state.live.correctRenderedIndex) {
          nextScores[teamId] = (nextScores[teamId] ?? 0) + value
        }
      }
      return {
        ...state,
        live: { ...state.live, phase: 'revealed', scores: nextScores },
      }
    }

    case 'LADDER_NEXT': {
      if (!state.round || !state.live || state.live.kind !== 'points-ladder') return state
      // Empty-Fall: direkt in FINISH_MODE.
      if (state.live.phase === 'empty') {
        return reducer(state, { type: 'FINISH_MODE' })
      }
      if (state.live.phase !== 'revealed') return state

      const usedQuestionIds = state.live.activeQuestion
        ? [...state.live.usedQuestionIds, state.live.activeQuestion.id]
        : state.live.usedQuestionIds
      const nextIndex = state.live.currentIndex + 1
      const isModeDone = nextIndex >= state.live.totalQuestions

      const advancedBase: PointsLadderLive = {
        ...state.live,
        usedQuestionIds,
        currentIndex: nextIndex,
        activeQuestion: null,
        shuffledOptions: [],
        correctRenderedIndex: 0,
        teamAnswers: Object.fromEntries(
          state.round.teams.map((t) => [t.id, null]),
        ),
        phase: 'answering',
      }

      if (isModeDone) {
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      const excluded = new Set(usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const nextQuestion = pickLadderQuestion(excluded, nextIndex)
      if (!nextQuestion) {
        return reducer({ ...state, live: advancedBase }, { type: 'FINISH_MODE' })
      }

      const shuffle = shuffleWithMapping(
        nextQuestion.options,
        `ladder:${nextIndex}:${nextQuestion.id}`,
      )
      return {
        ...state,
        live: {
          ...advancedBase,
          activeQuestion: nextQuestion,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(nextQuestion.correctIndex),
        },
      }
    }

    case 'SPRINTER_ANSWER':
    case 'SPRINTER_SKIP': {
      if (!state.live || state.live.kind !== 'sprinter') return state
      const live = state.live
      if (live.phase !== 'answering' || !live.activeQuestion) return state

      const wasCorrect =
        action.type === 'SPRINTER_ANSWER' &&
        action.renderedIndex === live.correctRenderedIndex
      const teamId = live.activeTeamId
      const nextScores = wasCorrect && teamId
        ? { ...live.scores, [teamId]: (live.scores[teamId] ?? 0) + live.pointsPerCorrect }
        : live.scores

      const usedQuestionIds = [...live.usedQuestionIds, live.activeQuestion.id]
      const excluded = new Set(usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const nextQuestion = pickAnyMultipleChoice(excluded)

      if (!nextQuestion) {
        // Pool leer — Sprint für dieses Team beenden.
        return reducer(
          {
            ...state,
            live: { ...live, scores: nextScores, usedQuestionIds },
          },
          { type: 'SPRINTER_TIME_UP' },
        )
      }

      const shuffle = shuffleWithMapping(
        nextQuestion.options,
        `sprinter:${live.activeTeamId}:${usedQuestionIds.length}:${nextQuestion.id}`,
      )
      return {
        ...state,
        live: {
          ...live,
          scores: nextScores,
          usedQuestionIds,
          activeQuestion: nextQuestion,
          shuffledOptions: shuffle.shuffled,
          correctRenderedIndex: shuffle.renderedIndexOf(nextQuestion.correctIndex),
        },
      }
    }

    case 'SPRINTER_TIME_UP': {
      if (!state.round || !state.live || state.live.kind !== 'sprinter') return state
      const live = state.live
      if (live.phase !== 'answering') return state

      const isLastTeam = live.currentTeamIndex >= live.teamOrder.length - 1
      const stopped: SprinterLive = {
        ...live,
        phase: 'between-teams',
        sprintStartedAt: null,
        activeQuestion: null,
        shuffledOptions: [],
        correctRenderedIndex: 0,
      }

      if (isLastTeam) {
        return reducer({ ...state, live: stopped }, { type: 'FINISH_MODE' })
      }

      return { ...state, live: stopped }
    }

    case 'SPRINTER_START_NEXT_TEAM': {
      if (!state.round || !state.live || state.live.kind !== 'sprinter') return state
      const live = state.live
      if (live.phase !== 'between-teams') return state
      const nextIndex = live.currentTeamIndex + 1
      if (nextIndex >= live.teamOrder.length) return state

      const nextTeamId = live.teamOrder[nextIndex]
      const excluded = new Set(live.usedQuestionIds)
      for (const id of deps.getAskedQuestionIds()) excluded.add(id)
      const nextQuestion = pickAnyMultipleChoice(excluded)

      if (!nextQuestion) {
        // Katalog ist leergefahren — direkt in FINISH_MODE.
        return reducer(
          {
            ...state,
            live: {
              ...live,
              currentTeamIndex: nextIndex,
              activeTeamId: nextTeamId,
            },
          },
          { type: 'FINISH_MODE' },
        )
      }

      const shuffle = shuffleWithMapping(
        nextQuestion.options,
        `sprinter:${nextTeamId}:0:${nextQuestion.id}`,
      )
      return {
        ...state,
        live: {
          ...live,
          currentTeamIndex: nextIndex,
          activeTeamId: nextTeamId,
          phase: 'answering',
          sprintStartedAt: Date.now(),
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

      const teamCount = state.round.teams.length
      const nextLive: CategoryDuelLive = {
        ...state.live,
        usedTopics,
        usedQuestionIds,
        // Rotation über alle Teams — bei 2 gleich Alternation, bei 3-4 zirkulär.
        currentTeamIndex: teamCount > 0 ? (state.live.currentTeamIndex + 1) % teamCount : 0,
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

      // Modus-Sieger: das Team mit dem strikten Maximum an Modus-Punkten.
      // Gleichstand (2+ Teams gleichauf) → kein Matchpunkt, alle behalten ihre Gesamt-Matchpunkte.
      // Funktioniert für 2, 3 oder 4 Teams (siehe konzept-v2.md, Kapitel 4).
      let winnerTeamId: string | undefined
      let maxScore = -Infinity
      let winnerCount = 0
      for (const team of state.round.teams) {
        const s = scores[team.id] ?? 0
        if (s > maxScore) {
          maxScore = s
          winnerTeamId = team.id
          winnerCount = 1
        } else if (s === maxScore) {
          winnerCount++
        }
      }
      if (winnerCount !== 1) winnerTeamId = undefined

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
      const nextLive = initLiveFor(nextModeId, state.round.teams, state.round.players, deps)
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

    case 'RESTART_MATCH': {
      // "Nochmal mit denselben Teams": Match neu, aber Runden-Kontext bleibt.
      // Nur Match-Scores, Results, Modus-Fortschritt und Live-State werden
      // zurückgesetzt. Die geladene Runde (Teams, Player, gewählte Modi,
      // Interessen) bleibt intakt — kein Player muss neu joinen.
      if (!state.round) return state
      return {
        ...state,
        phase: 'lobby',
        lobbyStep: 'ready',
        currentModeIndex: 0,
        matchPoints: Object.fromEntries(
          state.round.teams.map((t) => [t.id, 0]),
        ),
        results: [],
        live: null,
      }
    }

    case 'RESET_ALL':
      return INITIAL_STATE

    default:
      return state
  }
}

}
