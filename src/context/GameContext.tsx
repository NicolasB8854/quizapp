/**
 * React-Anbindung des Quizabend-Reducers.
 *
 * Der eigentliche Reducer + State-Shape + Actions leben in `@quizapp/shared`
 * (siehe `packages/shared/src/state/reducer.ts`) — plattform-neutral, damit
 * er ab Phase 3 auch in AWS-Lambda genutzt werden kann.
 *
 * Hier wickeln wir den Reducer in einen React-Context ein und injizieren
 * die Frontend-spezifischen Dependencies:
 *   - `getAskedQuestionIds` liest aus `localStorage` (Cross-Session-Historie
 *     der bereits gestellten Fragen — verhindert Dubletten am nächsten Abend).
 *
 * Zusätzlich hält der Provider zwei Persistenz-Side-Effects, die bewusst
 * **außerhalb** des Reducers laufen, damit dieser pure bleibt:
 *   - `markQuestionsAsked`: schreibt neue Frage-IDs in die localStorage-Historie.
 *   - `saveToPlayerLibrary`: snapshottet Spielerprofile beim Wechsel in
 *     die Playing-Phase.
 *
 * Convenience-Hooks (`useGame`, `useCategoryDuel`, `useFlash`, …) liefern
 * typisiert den passenden `live`-Slot pro Modus zurück.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type {
  AroundCornerLive,
  CategoryBoardLive,
  CategoryDuelLive,
  DuelLive,
  EliminationLive,
  ExpertsLive,
  FlashLive,
  GameAction,
  GameModeId,
  GameState,
  PointsLadderLive,
  SpotlightLive,
  SprinterLive,
  Team,
} from '@quizapp/shared'
import { createReducer, INITIAL_STATE } from '@quizapp/shared'
import { markQuestionsAsked, readAskedQuestionIds } from '@/lib/questionHistory'
import { saveToPlayerLibrary } from '@/lib/playerLibrary'

// ---------- Re-Exports für Frontend-Konsumenten -----------------------------
//
// Historisch importieren viele UI-Files GameState/GameAction/*Live-Typen
// aus `@/context/GameContext`. Wir re-exportieren sie hier weiter, damit
// die bestehenden Import-Pfade stabil bleiben. Neuer Code kann direkt aus
// `@quizapp/shared` importieren.

export type {
  AroundCornerLive,
  CategoryBoardLive,
  CategoryDuelLive,
  Draft,
  DraftTeam,
  DuelLive,
  EliminationLive,
  ExpertsLive,
  FlashLive,
  GameAction,
  GameState,
  LiveGame,
  LobbyStep,
  Phase,
  PointsLadderLive,
  ReducerDeps,
  SpotlightLive,
  SprinterLive,
} from '@quizapp/shared'
export { INITIAL_STATE } from '@quizapp/shared'

// ---------- Context + Provider ----------------------------------------------

interface GameContextValue {
  state: GameState
  dispatch: Dispatch<GameAction>
  currentTeam: Team | null
  currentModeId: GameModeId | null
  matchWinner: Team | null
}

const GameContext = createContext<GameContextValue | null>(null)

/**
 * Reducer-Instanz, in die die localStorage-basierte Historie via Dependency
 * Injection reinfließt. Wird beim Render zeitig instanziiert und lebt für
 * die gesamte Provider-Lebensdauer.
 *
 * `readAskedQuestionIds()` wird bei jedem Reducer-Aufruf **frisch** gelesen —
 * damit die Historie aus einer parallelen Tab/Session direkt greift.
 */
const frontendReducer = createReducer({
  getAskedQuestionIds: () => new Set(readAskedQuestionIds()),
})

/**
 * Für Test-Setups, die direkt gegen den Reducer testen wollen (siehe
 * `GameContext.test.ts`). Exponiert eine Version, die exakt so verdrahtet ist
 * wie die Provider-interne — inklusive localStorage-Zugriff.
 */
export const reducer = frontendReducer

/**
 * Optionaler Remote-Sync-Kanal: wenn gesetzt, kommt der State vom Server
 * (via `useRoomSync`), und Dispatch geht übers WebSocket. Der lokale
 * `useReducer` wird trotzdem gehalten (als Fallback, falls Remote-Modus
 * ausfällt) — aber der aktive `state`/`dispatch` bleiben Remote.
 */
export interface RemoteSyncBinding {
  state: import('@quizapp/shared').GameState | null
  dispatch: (action: import('@quizapp/shared').GameAction) => void
}

export function GameProvider({
  children,
  remoteSync,
}: {
  children: ReactNode
  remoteSync?: RemoteSyncBinding
}) {
  const [localState, localDispatch] = useReducer(frontendReducer, INITIAL_STATE)
  // Wenn Remote-Sync aktiv und einen State geliefert hat, gewinnt der Server.
  // Sonst bleibt der Provider im klassischen Offline-Modus.
  const useRemote = remoteSync !== undefined && remoteSync.state !== null
  const state = useRemote ? (remoteSync!.state as GameState) : localState
  const dispatch = useRemote
    ? (remoteSync!.dispatch as typeof localDispatch)
    : localDispatch

  // Duplicate-Check-Historie: sobald eine Frage tatsächlich gespielt wurde,
  // merken wir sie in `localStorage`. Der Reducer schreibt selbst nicht, damit
  // er pure bleibt — der Effect hier ist der Sync-Kanal zu Storage.
  //
  // Zwei Quellen kombiniert:
  //   1. `state.live.usedQuestionIds` — der laufende Modus.
  //   2. `state.results[*].questionsUsed` — abgeschlossene Modi. Ohne diese
  //      Quelle würde pro Modus die letzte Frage verloren gehen, weil der
  //      Reducer sie in `advancedBase.usedQuestionIds` pushed und direkt
  //      danach `FINISH_MODE` das Live-Object durch den nächsten Modus
  //      ersetzt (mit leerem `usedQuestionIds`).
  const usedIdsForHistory = useMemo(() => {
    const ids = new Set<string>()
    for (const r of state.results ?? []) {
      for (const id of r.questionsUsed ?? []) ids.add(id)
    }
    if (state.live?.usedQuestionIds) {
      for (const id of state.live.usedQuestionIds) ids.add(id)
    }
    return Array.from(ids)
  }, [state.results, state.live?.usedQuestionIds])

  useEffect(() => {
    if (usedIdsForHistory.length > 0) {
      markQuestionsAsked(usedIdsForHistory)
    }
  }, [usedIdsForHistory])

  // Player-Bibliothek: beim Wechsel in die Spielphase snapshoten wir alle
  // Spieler mit echtem Namen — für Wiederverwendung an späteren Abenden.
  useEffect(() => {
    if (state.phase === 'playing' && state.round) {
      saveToPlayerLibrary(state.round.players)
    }
  }, [state.phase, state.round])

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
    // Sieger = Team mit strictem Maximum an Match-Punkten. Gleichstand → null.
    let winner: Team | null = null
    let max = -Infinity
    let ties = 0
    for (const team of state.round.teams) {
      const pts = state.matchPoints[team.id] ?? 0
      if (pts > max) {
        max = pts
        winner = team
        ties = 1
      } else if (pts === max) {
        ties++
      }
    }
    return ties === 1 ? winner : null
  }, [state.round, state.matchPoints, state.phase])

  const value = useMemo<GameContextValue>(
    () => ({ state, dispatch, currentTeam, currentModeId, matchWinner }),
    [state, currentTeam, currentModeId, matchWinner],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

// ---------- Hooks -----------------------------------------------------------

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

// Convenience-Hooks pro Modus. Der Cast in den Rückgabetyp erfolgt über die
// `kind`-Diskriminante des Live-States.
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

export function useAroundCorner(): AroundCornerLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'around-corner' ? state.live : null
}

export function useSprinter(): SprinterLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'sprinter' ? state.live : null
}

export function usePointsLadder(): PointsLadderLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'points-ladder' ? state.live : null
}

export function useCategoryBoard(): CategoryBoardLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'category-board' ? state.live : null
}

export function useDuel(): DuelLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'duel-1v1' ? state.live : null
}

export function useElimination(): EliminationLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'elimination' ? state.live : null
}

export function useExperts(): ExpertsLive | null {
  const { state } = useGame()
  return state.live && state.live.kind === 'experts' ? state.live : null
}

// Convenience für Dispatch ohne Boilerplate.
export function useGameDispatch(): (action: GameAction) => void {
  const { dispatch } = useGame()
  return useCallback((action: GameAction) => dispatch(action), [dispatch])
}
