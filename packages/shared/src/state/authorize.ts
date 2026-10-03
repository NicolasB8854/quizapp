/**
 * Server-seitige Rechteprüfung für Multi-Device-Actions.
 *
 * Der Reducer selbst kennt keinen Absender. Im Raum-Modus schickt jedes Gerät
 * Actions — ohne diese Prüfung konnte jedes Gerät für jedes Team buzzern oder
 * antworten. Regel: Wer als Spieler im Roster steht, darf team-gebundene
 * Actions nur für **sein eigenes Team** auslösen. Ein reines Bühnen-/Master-
 * Gerät ohne Spieler im Roster bleibt frei (Single-Device-Fallback).
 */
import type { GameAction, GameState } from './reducer'
import { getNextTeamId } from '../data/teams'

export interface ActionActor {
  playerId: string | null
  /** Rolle der Session. Fehlt sie (ältere Aufrufer/Tests), gilt nur die Team-Bindung. */
  role?: 'host' | 'player'
}

/**
 * Show-Runner-Aktionen: Setup, Weiter/Auflösen, Modus beenden, Neustart.
 * Nur der Host (mitspielend oder Bühne) darf sie auslösen — Spieler hätten
 * sonst z. B. einfach die Frage weiterklicken können.
 */
export const HOST_ONLY_ACTIONS: ReadonlySet<GameAction['type']> = new Set<GameAction['type']>([
  'SET_TEAM_NAME', 'ADD_TEAM', 'REMOVE_TEAM', 'TOGGLE_MODE', 'SET_MODE_SELECTION', 'SET_ROUND_MODES',
  'GO_TO_LOBBY', 'START_PLAYING', 'LOBBY_ADVANCE', 'LOBBY_BACK', 'SHUFFLE_PLAYERS',
  'ADD_PLAYER', 'ADD_PLAYER_FROM_LIBRARY', 'REPLACE_PLAYER_FROM_LIBRARY',
  'FINISH_MODE', 'BACK_TO_SETUP', 'RESTART_MATCH',
  'CD_NEXT_TURN', 'FLASH_REVEAL', 'FLASH_NEXT', 'SPOTLIGHT_NEXT', 'AC_REVEAL_SOLUTION', 'AC_NEXT',
  'SPRINTER_START_NEXT_TEAM', 'LADDER_REVEAL', 'LADDER_NEXT', 'BOARD_NEXT', 'DUEL_NEXT', 'ELIM_NEXT', 'EXPERTS_NEXT',
])

export type AuthorizeResult = { ok: true } | { ok: false; reason: string }

const OK: AuthorizeResult = { ok: true }

/** Team, das in einer Buzzer-Antwortphase gerade antworten darf. */
export function answeringTeamId(state: GameState): string | null {
  const live = state.live
  if (!live) return null
  if (live.kind === 'category-board' || live.kind === 'duel-1v1') {
    if (!live.buzzingTeamId) return null
    if (live.phase === 'primary-answer') return live.buzzingTeamId
    if (live.phase === 'steal-answer') {
      return live.kind === 'duel-1v1'
        ? live.duelingTeamIds.find((id) => id !== live.buzzingTeamId) ?? null
        : getNextTeamId(state.round?.teams ?? [], live.buzzingTeamId)
    }
  }
  return null
}

/** Team, das beim Spotlight-/Fachrunden-Steal antworten darf (Rotation wie im Reducer). */
export function stealTeamId(state: GameState): string | null {
  const live = state.live
  if (!live || (live.kind !== 'player-spotlight' && live.kind !== 'experts')) return null
  const active = state.round?.players.find((p) => p.id === live.activePlayerId)
  if (!active?.teamId) return null
  return getNextTeamId(state.round?.teams ?? [], active.teamId)
}

export function authorizeAction(
  state: GameState,
  action: GameAction,
  actor: ActionActor,
): AuthorizeResult {
  const isHost = actor.role === 'host'
  if (actor.role === 'player') {
    if (HOST_ONLY_ACTIONS.has(action.type)) return { ok: false, reason: 'Nur der Host darf das' }
    if (action.type === 'REMOVE_PLAYER' && action.playerId !== actor.playerId) {
      return { ok: false, reason: 'Nur der Host darf Spieler entfernen' }
    }
    if (action.type === 'MOVE_PLAYER_TO_TEAM' && action.playerId !== actor.playerId) {
      return { ok: false, reason: 'Nur der Host darf andere Spieler verschieben' }
    }
  }
  const me = actor.playerId
    ? state.round?.players.find((p) => p.id === actor.playerId) ?? null
    : null
  // Reines Bühnen-/Master-Gerät: keine Team-Bindung.
  if (!me) return OK
  // Host darf Show-Aktionen auch dann, wenn er mitspielt.
  if (isHost && HOST_ONLY_ACTIONS.has(action.type)) return OK
  const myTeam = me.teamId ?? null

  switch (action.type) {
    case 'BOARD_BUZZER':
    case 'DUEL_BUZZER':
    case 'SPRINTER_REBOUND_BUZZ':
    case 'FLASH_SET_ANSWER':
    case 'LADDER_SET_ANSWER':
      return action.teamId === myTeam
        ? OK
        : { ok: false, reason: 'Nur für das eigene Team erlaubt' }
    case 'BOARD_ANSWER':
    case 'DUEL_ANSWER': {
      const team = answeringTeamId(state)
      return team !== null && team === myTeam
        ? OK
        : { ok: false, reason: 'Dein Team ist gerade nicht dran' }
    }
    case 'SET_PLAYER_AVATAR':
    case 'SET_PLAYER_NAME':
    case 'SET_PLAYER_INTERESTS':
    case 'SET_PLAYER_INTEREST_TAGS':
      // Profilangaben pflegt jede:r nur für sich selbst.
      return action.playerId === me.id ? OK : { ok: false, reason: 'Nur das eigene Profil ist änderbar' }
    case 'SPRINTER_ANSWER':
    case 'SPRINTER_SKIP':
    case 'SPRINTER_REBOUND_ANSWER': {
      const live = state.live
      if (!live || live.kind !== 'sprinter') return OK
      const team = action.type === 'SPRINTER_REBOUND_ANSWER' ? live.reboundTeamId : live.activeTeamId
      return team && team === myTeam ? OK : { ok: false, reason: 'Dein Team ist gerade nicht dran' }
    }
    case 'SPOTLIGHT_PRIMARY_ANSWER':
    case 'EXPERTS_PRIMARY_ANSWER': {
      const live = state.live
      const active =
        live && (live.kind === 'player-spotlight' || live.kind === 'experts') ? live.activePlayerId : null
      return active === me.id ? OK : { ok: false, reason: 'Nur der aktive Spieler antwortet' }
    }
    case 'SPOTLIGHT_STEAL_ANSWER':
    case 'EXPERTS_STEAL_ANSWER': {
      const team = stealTeamId(state)
      return team !== null && team === myTeam
        ? OK
        : { ok: false, reason: 'Dein Team ist gerade nicht dran' }
    }
    default:
      return OK
  }
}
