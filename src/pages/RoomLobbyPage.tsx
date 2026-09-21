/**
 * `/room/:code` — die aktive Room-Ansicht.
 *
 * Verantwortlich für:
 *  - Verbindungsaufbau via `useRoomSync`
 *  - Persistieren der `playerId` in `localStorage`, damit Reconnect denselben
 *    Player wiedererkennt.
 *  - Phase-abhängiges Rendering des Room-States (setup/lobby/playing/scoreboard).
 *
 * Bewusst als eigenständige Seite ohne Wiederverwendung der Offline-Pages
 * (SetupPage, LobbyPage, GamePage, ScoreboardPage). Die nutzen absolute
 * Route-Navigation, was hier stören würde. Die volle UI-Angleichung kommt
 * in einer späteren Phase — für den ersten Party-Abend reicht dieser
 * Server-authoritative Basis-View.
 */

import { useEffect, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  ListOrdered,
  Loader2,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import type {
  AroundCornerLive,
  CategoryDuelLive,
  FlashLive,
  GameAction,
  GameState,
  SpotlightLive,
} from '@quizapp/shared'
import type { Player, SkillLevel, Topic } from '@quizapp/shared'
import {
  MODES,
  MODES_BY_ID,
  TOPICS,
  TOPICS_BY_ID,
  getTeamColorHex,
} from '@quizapp/shared'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { PlayerInterestsPanel } from '@/components/PlayerInterestsPanel'
import { useRoomSync } from '@/hooks/useRoomSync'
import { readRoomIdentity, saveRoomIdentity } from '@/lib/roomIdentity'
import { cn } from '@/lib/classnames'

export default function RoomLobbyPage() {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const roomCode = (code ?? '').trim().toUpperCase()
  const wsUrl = import.meta.env.VITE_WS_URL

  // Query-Params haben Vorrang, sonst Fallback auf gespeicherte Identity.
  const identity = useMemo(() => readRoomIdentity(), [])
  const playerName = searchParams.get('name') ?? identity.playerName ?? ''
  const role = (searchParams.get('role') as 'player' | 'master') ?? 'player'

  const room = useRoomSync({
    wsUrl,
    roomCode,
    playerName,
    role,
    playerId: identity.playerId ?? undefined,
    enabled: !!wsUrl && !!roomCode && !!playerName,
  })

  // Bei erstem JOINED die Server-bestätigte playerId in localStorage merken.
  useEffect(() => {
    if (room.status === 'joined' && room.playerId) {
      saveRoomIdentity({ playerId: room.playerId, playerName })
    }
  }, [room.status, room.playerId, playerName])

  // Kein Name → zurück auf Entry.
  useEffect(() => {
    if (!playerName || !roomCode) {
      navigate('/room', { replace: true })
    }
  }, [playerName, roomCode, navigate])

  // Master + Player dürfen dispatchen — Master ist der Show-Runner
  // (Modi wählen, Reveals auslösen), Player interagieren via ihrem Handy.
  const canDispatch = room.status === 'joined'

  const send = (action: GameAction) => {
    if (!canDispatch) return
    room.dispatch(action)
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
    } catch {
      /* silent */
    }
  }

  return (
    <ScreenLayout variant="dim">
      <div
        className={cn(
          'mx-auto space-y-4 p-4 md:p-6',
          role === 'master' ? 'max-w-6xl' : 'max-w-3xl',
        )}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="md"
            leading={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/room')}
          >
            Verlassen
          </Button>
          <div className="flex-1" />
          <StatusBadge status={room.status} />
        </div>

        {/* Header-Variante nach Rolle + Phase:
             - Master + setup/lobby → Hero mit QR (Onboarding-Phase)
             - Master + playing/scoreboard → kompakter Header (Content dominiert)
             - Player → immer compact-Streifen */}
        {role === 'master' &&
        (room.state?.phase === 'setup' || room.state?.phase === 'lobby') ? (
          <MasterHero
            roomCode={roomCode}
            playerCount={room.state?.round?.players.length ?? 0}
            onCopyCode={copyCode}
          />
        ) : role === 'master' ? (
          <MasterCompactHeader
            roomCode={roomCode}
            onCopyCode={copyCode}
          />
        ) : (
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.32em] text-ink-muted">
                  Room-Code
                </div>
                <button
                  onClick={copyCode}
                  className="mt-1 inline-flex items-center gap-2 font-mono text-3xl font-bold tracking-[0.32em] text-white hover:text-brand-purple-soft"
                >
                  {roomCode}
                  <Copy className="h-4 w-4 text-white/40" />
                </button>
              </div>
              <div className="flex-1" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.32em] text-ink-muted">
                  Player
                </div>
                <div className="mt-1 font-semibold text-white">
                  {playerName}
                </div>
              </div>
            </div>
          </Card>
        )}

        {!wsUrl && (
          <Card className="border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>VITE_WS_URL fehlt — Multi-Device deaktiviert.</span>
            </div>
          </Card>
        )}

        {room.lastError && (
          <Card className="border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {room.lastError}
          </Card>
        )}

        {/* Content nach Status */}
        {room.status === 'connecting' || room.status === 'joining' ? (
          <LoadingCard label="Verbinde …" />
        ) : room.status === 'reconnecting' ? (
          <LoadingCard label="Verbindung wird wiederhergestellt …" />
        ) : room.status === 'joined' && room.state ? (
          <PhaseView
            state={room.state}
            role={role}
            playerId={room.playerId}
            canDispatch={canDispatch}
            send={send}
          />
        ) : (
          <LoadingCard label="Warte auf Server …" />
        )}
      </div>
    </ScreenLayout>
  )
}

// ---------- Sub-Komponenten -------------------------------------------------

/**
 * Presentation-Hero für die Master-Rolle: großer Room-Code, QR-Code für
 * Handy-Scan, kompakte Join-URL + Player-Zähler.
 *
 * Wird auf dem großen Bildschirm (TV/Beamer) angezeigt, damit die Gäste
 * mit ihrem Handy einfach den QR scannen können — er zeigt auf
 * `<origin>/room?code=<CODE>`, wo die Entry-Page den Code bereits
 * vorbelegt und nur nach dem Namen fragt.
 */
function MasterHero({
  roomCode,
  playerCount,
  onCopyCode,
}: {
  roomCode: string
  playerCount: number
  onCopyCode: () => void
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const joinUrl = `${origin}/room?code=${roomCode}`
  return (
    <Card className="border-brand-purple/40 bg-brand-purple/[0.06] p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
        <div className="min-w-0 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.32em] text-brand-purple-soft">
            Master-Screen · Handy scannen zum Beitreten
          </div>
          <button
            onClick={onCopyCode}
            title="Kopieren"
            className="group flex items-center gap-3 text-left"
          >
            <span className="font-mono text-6xl font-bold tracking-[0.16em] text-white md:text-7xl">
              {roomCode}
            </span>
            <Copy className="h-5 w-5 text-white/30 transition-colors group-hover:text-brand-purple-soft" />
          </button>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {playerCount} {playerCount === 1 ? 'Player' : 'Player'} im Raum
            </span>
            <span className="font-mono text-white/50">{joinUrl}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG
              value={joinUrl}
              size={140}
              level="M"
              marginSize={0}
            />
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            scan me
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * Kompakter Master-Header während Playing/Scoreboard: nur der Room-Code,
 * damit spät-joinende Gäste ihn noch abtippen könnten. Der QR fliegt raus —
 * die Show soll dominieren.
 */
function MasterCompactHeader({
  roomCode,
  onCopyCode,
}: {
  roomCode: string
  onCopyCode: () => void
}) {
  return (
    <Card className="border-brand-purple/30 bg-brand-purple/[0.04] p-3">
      <div className="flex items-center gap-3">
        <div className="text-[10px] uppercase tracking-[0.32em] text-brand-purple-soft">
          Room
        </div>
        <button
          type="button"
          onClick={onCopyCode}
          className="inline-flex items-center gap-2 font-mono text-2xl font-bold tracking-[0.24em] text-white hover:text-brand-purple-soft"
        >
          {roomCode}
          <Copy className="h-3.5 w-3.5 text-white/30" />
        </button>
      </div>
    </Card>
  )
}

function StatusBadge({ status }: { status: ReturnType<typeof useRoomSync>['status'] }) {
  const map = {
    idle: { label: 'Warte', tone: 'bg-white/10 text-white/60' },
    connecting: { label: 'Verbindung', tone: 'bg-blue-500/20 text-blue-200' },
    joining: { label: 'Betrete Raum', tone: 'bg-blue-500/20 text-blue-200' },
    joined: { label: 'Verbunden', tone: 'bg-emerald-500/20 text-emerald-200' },
    reconnecting: {
      label: 'Reconnect',
      tone: 'bg-amber-500/20 text-amber-200',
    },
    error: { label: 'Fehler', tone: 'bg-red-500/20 text-red-200' },
  }[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
        map.tone,
      )}
    >
      {(status === 'connecting' || status === 'joining' || status === 'reconnecting') && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {map.label}
    </span>
  )
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="flex items-center gap-3 p-6 text-white/80">
      <Loader2 className="h-5 w-5 animate-spin text-brand-purple-soft" />
      <span>{label}</span>
    </Card>
  )
}

function PhaseView({
  state,
  role,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  role: 'player' | 'master'
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  switch (state.phase) {
    case 'setup':
      return (
        <SetupPhaseView
          state={state}
          canDispatch={canDispatch}
          send={send}
        />
      )
    case 'lobby':
      return (
        <LobbyPhaseView
          state={state}
          role={role}
          playerId={playerId}
          canDispatch={canDispatch}
          send={send}
        />
      )
    case 'playing': {
      // Pro live.kind ein optimierter View. Fallback: generischer State-Dump.
      const live = state.live
      if (live?.kind === 'flash') {
        return (
          <FlashRoomView
            state={state}
            live={live}
            playerId={playerId}
            canDispatch={canDispatch}
            send={send}
          />
        )
      }
      if (live?.kind === 'category-duel') {
        return (
          <CategoryDuelRoomView
            state={state}
            live={live}
            playerId={playerId}
            canDispatch={canDispatch}
            send={send}
          />
        )
      }
      if (live?.kind === 'player-spotlight') {
        return (
          <SpotlightRoomView
            state={state}
            live={live}
            playerId={playerId}
            canDispatch={canDispatch}
            send={send}
          />
        )
      }
      if (live?.kind === 'around-corner') {
        return (
          <AroundCornerRoomView
            live={live}
            playerId={playerId}
            state={state}
            canDispatch={canDispatch}
            send={send}
          />
        )
      }
      return <PlayingPhaseView state={state} canDispatch={canDispatch} send={send} />
    }
    case 'scoreboard':
      return <ScoreboardPhaseView state={state} canDispatch={canDispatch} send={send} />
  }
}

function SetupPhaseView({
  state,
  canDispatch,
  send,
}: {
  state: GameState
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const readyModes = MODES.filter((m) => m.status === 'ready')
  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          Spielmodi
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {readyModes.map((mode) => {
            const selected = state.draft.selectedModes.includes(mode.id)
            return (
              <button
                key={mode.id}
                onClick={() => send({ type: 'TOGGLE_MODE', modeId: mode.id })}
                disabled={!canDispatch}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all disabled:opacity-40',
                  selected
                    ? 'border-brand-purple/60 bg-brand-purple/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                )}
              >
                <div className="text-sm font-semibold text-white">
                  {mode.name}
                </div>
                <div className="text-[11px] text-ink-muted">
                  {mode.tagline}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
            Teams
          </div>
          <div className="flex gap-2">
            <Button
              size="md"
              variant="secondary"
              onClick={() => send({ type: 'ADD_TEAM' })}
              disabled={!canDispatch}
            >
              + Team
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {state.draft.teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2"
            >
              <span className="h-3 w-3 rounded-full" style={{ background: getTeamColorHex(team.color) }} />
              <span className="flex-1 text-sm text-white">{team.name}</span>
              <Button
                size="md"
                variant="ghost"
                onClick={() =>
                  send({ type: 'REMOVE_TEAM', teamId: team.id })
                }
                disabled={!canDispatch || state.draft.teams.length <= 2}
              >
                –
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Button
        size="lg"
        variant="primary"
        onClick={() => send({ type: 'GO_TO_LOBBY' })}
        disabled={!canDispatch || state.draft.selectedModes.length === 0}
        className="w-full"
      >
        Weiter zur Lobby
      </Button>

      {!canDispatch && (
        <p className="text-center text-xs text-ink-muted">
          Verbindung wird aufgebaut …
        </p>
      )}
    </div>
  )
}

function LobbyPhaseView({
  state,
  role,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  role: 'player' | 'master'
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const readyToStart =
    state.round.players.length > 0 &&
    state.round.players.every((p) => p.teamId !== null)

  // Eigener Player im State (falls Player-Rolle).
  const myPlayer =
    role === 'player' && playerId
      ? state.round.players.find((p) => p.id === playerId) ?? null
      : null

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          Runde
        </div>
        <div className="mt-1 text-lg font-semibold text-white">
          {state.round.name}
        </div>
        <div className="mt-1 text-xs text-ink-muted">
          Best-of-{state.round.bestOf} · {state.round.players.length}{' '}
          {state.round.players.length === 1 ? 'Spieler' : 'Spieler'} im Raum
        </div>
      </Card>

      {/* Eigene Player-Karte: nur wenn Player + im State registriert. */}
      {myPlayer && (
        <PlayerSelfCard
          state={state}
          me={myPlayer}
          canDispatch={canDispatch}
          send={send}
        />
      )}

      {/* Team-Roster für alle sichtbar. */}
      <Card className="space-y-2 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          Teams
        </div>
        {state.round.teams.map((team) => {
          const members = state.round!.players.filter((p) => p.teamId === team.id)
          return (
            <div key={team.id} className="rounded-lg bg-white/[0.03] p-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: getTeamColorHex(team.color) }}
                />
                <span className="text-sm font-semibold text-white">
                  {team.name}
                </span>
                <span className="ml-auto text-xs text-ink-muted">
                  {members.length} {members.length === 1 ? 'Spieler' : 'Spieler'}
                </span>
              </div>
              {members.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {members.map((p) => (
                    <RosterPlayerRow
                      key={p.id}
                      player={p}
                      isMe={p.id === playerId}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {(() => {
          const pool = state.round!.players.filter((p) => p.teamId === null)
          if (pool.length === 0) return null
          return (
            <div className="mt-2 rounded-lg border border-dashed border-white/10 p-2">
              <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                Noch ohne Team ({pool.length})
              </div>
              <div className="mt-2 space-y-1.5">
                {pool.map((p) => (
                  <RosterPlayerRow
                    key={p.id}
                    player={p}
                    isMe={p.id === playerId}
                  />
                ))}
              </div>
            </div>
          )
        })()}
      </Card>

      <Button
        size="lg"
        variant="primary"
        onClick={() => send({ type: 'START_PLAYING' })}
        disabled={!canDispatch || !readyToStart}
        className="w-full"
      >
        {readyToStart ? 'Runde starten' : 'Wartet auf Team-Auswahl'}
      </Button>

      {role === 'master' && (
        <p className="text-center text-xs text-ink-muted">
          Master-Screen — Player tragen sich selbst ein, du kannst die Runde
          starten wenn alle bereit sind.
        </p>
      )}
    </div>
  )
}

/**
 * Kompakte Zeile pro Player im Team-Roster: Name + kleine Interest-Emojis
 * mit Level-Farbe. Für alle Sessions sichtbar, damit man live sieht wer
 * schon welche Interessen gepflegt hat.
 */
function RosterPlayerRow({ player, isMe }: { player: Player; isMe: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md px-2 py-1',
        isMe ? 'bg-brand-purple/10 ring-1 ring-brand-purple/30' : 'bg-white/[0.02]',
      )}
    >
      <span
        className={cn(
          'text-sm',
          isMe ? 'font-semibold text-white' : 'text-white/85',
        )}
      >
        {player.name || 'Namenlos'}
      </span>
      {isMe && (
        <span className="text-[9px] uppercase tracking-[0.22em] text-brand-purple-soft">
          Du
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {player.interests.map((interest) => {
          const topicDef = TOPICS_BY_ID[interest.topic]
          if (!topicDef) return null
          return (
            <InterestPill
              key={interest.topic}
              emoji={topicDef.emoji}
              level={interest.level}
              subCount={interest.tags?.length ?? 0}
            />
          )
        })}
      </div>
    </div>
  )
}

function InterestPill({
  emoji,
  level,
  subCount,
}: {
  emoji: string
  level: SkillLevel
  subCount: number
}) {
  const tone =
    level === 5
      ? 'bg-mode-ladder/15 text-mode-ladder border-mode-ladder/40'
      : level === 3
        ? 'bg-brand-purple/15 text-brand-purple-soft border-brand-purple/40'
        : 'bg-brand-cyan/15 text-brand-cyan-soft border-brand-cyan/40'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px]',
        tone,
      )}
      title={`Level ${level}${subCount > 0 ? ` · ${subCount} Sub-Tags` : ''}`}
    >
      <span>{emoji}</span>
      {subCount > 0 && (
        <span className="text-[8px] font-bold">{subCount}</span>
      )}
    </span>
  )
}

/**
 * Karte für den eigenen Player: Name-Input + Team-Auswahl + Interessen.
 * Alle Änderungen werden über SET_PLAYER_NAME / MOVE_PLAYER_TO_TEAM /
 * SET_PLAYER_INTERESTS / SET_PLAYER_INTEREST_TAGS an den Server dispatched.
 */
function PlayerSelfCard({
  state,
  me,
  canDispatch,
  send,
}: {
  state: GameState
  me: Player
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return null

  return (
    <Card className="space-y-3 border-brand-purple/40 bg-brand-purple/[0.06] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.32em] text-brand-purple-soft">
          Das bist du
        </div>
        {me.teamId ? (
          <Badge tone="purple">
            {state.round.teams.find((t) => t.id === me.teamId)?.name}
          </Badge>
        ) : (
          <Badge tone="muted">kein Team</Badge>
        )}
      </div>

      {/* Name */}
      <label className="block">
        <span className="text-xs text-white/70">Anzeige-Name</span>
        <input
          value={me.name}
          onChange={(e) =>
            send({ type: 'SET_PLAYER_NAME', playerId: me.id, name: e.target.value })
          }
          disabled={!canDispatch}
          className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-lg font-semibold text-white placeholder-white/30 disabled:opacity-50"
          placeholder="z. B. Sara"
          maxLength={40}
        />
      </label>

      {/* Team-Auswahl */}
      <div>
        <span className="text-xs text-white/70">Team wählen</span>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {state.round.teams.map((team) => {
            const active = me.teamId === team.id
            return (
              <button
                key={team.id}
                onClick={() =>
                  send({
                    type: 'MOVE_PLAYER_TO_TEAM',
                    playerId: me.id,
                    teamId: team.id,
                  })
                }
                disabled={!canDispatch}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all disabled:opacity-40',
                  active
                    ? 'border-brand-purple/70 bg-brand-purple/15'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: getTeamColorHex(team.color) }}
                />
                <span className="text-sm text-white">{team.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Interessen-Panel: eigene Auswahl mit Level-Zyklus + Sub-Tags */}
      <div className="border-t border-white/10 pt-3">
        <PlayerInterestsPanel me={me} send={send} disabled={!canDispatch} />
      </div>
    </Card>
  )
}

/**
 * Themen-Battle: 12-Kategorien-Grid × Multiple Choice.
 *
 * Ablauf pro Zug:
 *   1. Team-am-Zug wählt eine noch nicht gespielte Kategorie aus dem 12er-Grid
 *   2. Frage erscheint auf allen Screens (Options gemischt)
 *   3. Team-am-Zug klickt eine Option → State geht zu 'revealed'
 *   4. Alle sehen richtige + gewählte Antwort. Master (oder jeder) klickt „Weiter"
 *   5. Nächstes Team ist dran. Nach 12 Kategorien: FINISH_MODE
 *
 * Player-am-Zug = Player, deren `teamId === teams[currentTeamIndex].id`.
 * Master + andere Team-Spieler sehen den Status, dürfen aber nicht dispatchen
 * (server-seitig kein Block, aber UI-mäßig gesperrt).
 */
function CategoryDuelRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: CategoryDuelLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />

  const teams = state.round.teams
  const currentTeam = teams[live.currentTeamIndex] ?? null
  const myPlayer = playerId
    ? state.round.players.find((p) => p.id === playerId)
    : null
  // Zug-Berechtigung: eigener Player im Team-am-Zug (Player-Rolle) ODER Master.
  const isMyTurn = !!myPlayer && myPlayer.teamId === currentTeam?.id
  const isMaster = !myPlayer // Master ist nicht als Player im State
  const canPlayThisTurn = canDispatch && (isMyTurn || isMaster)

  return (
    <div className="space-y-3">
      {/* Header: Team-am-Zug + Scores */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-brand-purple-soft">
              Themen-Battle
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              {currentTeam && (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: getTeamColorHex(currentTeam.color) }}
                />
              )}
              <span className="text-sm font-semibold text-white">
                {currentTeam?.name} am Zug
              </span>
              <span className="font-mono text-xs text-ink-muted">
                · {live.usedTopics.length} / 12
              </span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: getTeamColorHex(team.color) }}
                />
                <span className="text-xs text-white/80">{team.name}</span>
                <span className="font-mono text-sm font-bold text-white">
                  {live.scores[team.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Phase-abhängige Sub-View */}
      {live.phase === 'pick-topic' && (
        <CDPickTopicView
          live={live}
          canPlay={canPlayThisTurn}
          isMyTurn={isMyTurn}
          isMaster={isMaster}
          currentTeamName={currentTeam?.name ?? ''}
          send={send}
        />
      )}
      {live.phase === 'answering' && (
        <CDAnsweringView
          live={live}
          canPlay={canPlayThisTurn}
          isMyTurn={isMyTurn}
          isMaster={isMaster}
          currentTeamName={currentTeam?.name ?? ''}
          send={send}
        />
      )}
      {live.phase === 'revealed' && (
        <CDRevealedView
          live={live}
          isMaster={isMaster}
          canDispatch={canDispatch}
          send={send}
        />
      )}
    </div>
  )
}

function CDPickTopicView({
  live,
  canPlay,
  isMyTurn,
  isMaster,
  currentTeamName,
  send,
}: {
  live: CategoryDuelLive
  canPlay: boolean
  isMyTurn: boolean
  isMaster: boolean
  currentTeamName: string
  send: (a: GameAction) => void
}) {
  const used = new Set<Topic>(live.usedTopics)
  return (
    <div className="space-y-3">
      <Card className={cn(isMaster ? 'p-6' : 'p-4')}>
        <div
          className={cn(
            'text-center text-white/80',
            isMaster ? 'text-xl md:text-2xl' : 'text-sm',
          )}
        >
          {isMyTurn ? (
            <>Wähle eine Kategorie für dein Team.</>
          ) : isMaster ? (
            <>
              <strong className="text-white">{currentTeamName}</strong> ist am Zug
            </>
          ) : (
            <>{currentTeamName} wählt eine Kategorie …</>
          )}
        </div>
      </Card>
      <div
        className={cn(
          'grid gap-2',
          isMaster
            ? 'grid-cols-3 md:grid-cols-4 md:gap-4'
            : 'grid-cols-3 sm:grid-cols-4',
        )}
      >
        {TOPICS.map((topic) => {
          const isUsed = used.has(topic.id)
          const disabled = isUsed || !canPlay
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => send({ type: 'CD_PICK_TOPIC', topic: topic.id })}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center rounded-lg border text-center transition-all',
                isMaster ? 'gap-2 px-3 py-6' : 'gap-1 px-2 py-3',
                isUsed
                  ? 'border-white/5 bg-white/[0.02] opacity-30'
                  : canPlay
                    ? 'border-brand-purple/40 bg-brand-purple/[0.08] text-white hover:border-brand-purple/70 hover:bg-brand-purple/15'
                    : 'border-white/10 bg-white/[0.03] text-white/60',
              )}
            >
              <span
                className={isMaster ? 'text-5xl md:text-6xl' : 'text-2xl'}
                aria-hidden
              >
                {topic.emoji}
              </span>
              <span
                className={cn(
                  'font-medium',
                  isMaster ? 'text-base md:text-lg' : 'text-[11px]',
                )}
              >
                {topic.label}
              </span>
              {isUsed && (
                <span
                  className={cn(
                    'uppercase tracking-wider text-white/40',
                    isMaster ? 'text-xs' : 'text-[9px]',
                  )}
                >
                  gespielt
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CDAnsweringView({
  live,
  canPlay,
  isMyTurn,
  isMaster,
  currentTeamName,
  send,
}: {
  live: CategoryDuelLive
  canPlay: boolean
  isMyTurn: boolean
  isMaster: boolean
  currentTeamName: string
  send: (a: GameAction) => void
}) {
  const question = live.activeQuestion
  const topicDef = live.activeTopic ? TOPICS_BY_ID[live.activeTopic] : null
  if (!question) return <LoadingCard label="Lade Frage …" />

  return (
    <>
      <Card
        className={cn(
          'space-y-3',
          isMaster ? 'p-8 md:p-10' : 'p-4',
        )}
      >
        {topicDef && (
          <div
            className={cn(
              'flex items-center gap-2 uppercase tracking-[0.22em] text-brand-cyan-soft',
              isMaster ? 'text-sm md:text-base' : 'text-xs',
            )}
          >
            <span
              aria-hidden
              className={isMaster ? 'text-2xl md:text-3xl' : ''}
            >
              {topicDef.emoji}
            </span>
            {topicDef.label}
          </div>
        )}
        <div
          className={cn(
            'font-semibold text-white',
            isMaster
              ? 'text-3xl leading-tight md:text-5xl md:leading-tight'
              : 'text-lg md:text-xl',
          )}
        >
          {question.question}
        </div>
      </Card>

      <div className={cn('space-y-2', isMaster && 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0')}>
        {live.shuffledOptions.map((option, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() =>
              send({ type: 'CD_SELECT_ANSWER', renderedIndex: idx })
            }
            disabled={!canPlay}
            className={cn(
              'flex w-full items-center rounded-xl border text-left transition-all disabled:opacity-40',
              isMaster ? 'gap-4 px-5 py-4' : 'gap-3 px-4 py-3',
              canPlay
                ? 'border-brand-purple/40 bg-white/[0.04] text-white hover:border-brand-purple/70 hover:bg-brand-purple/10'
                : 'border-white/10 bg-white/[0.03] text-white/70',
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full bg-white/10 font-mono font-bold',
                isMaster ? 'h-11 w-11 text-lg' : 'h-8 w-8 text-sm',
              )}
            >
              {String.fromCharCode(65 + idx)}
            </span>
            <span
              className={cn(
                'flex-1',
                isMaster ? 'text-lg md:text-xl' : 'text-sm md:text-base',
              )}
            >
              {option}
            </span>
          </button>
        ))}
      </div>

      {!canPlay && (
        <p className="text-center text-xs text-ink-muted">
          {isMyTurn ? (
            <>Verbindung nicht bereit …</>
          ) : isMaster ? (
            <>{currentTeamName} beantwortet die Frage.</>
          ) : (
            <>{currentTeamName} beantwortet die Frage. Warten …</>
          )}
        </p>
      )}
    </>
  )
}

function CDRevealedView({
  live,
  isMaster,
  canDispatch,
  send,
}: {
  live: CategoryDuelLive
  isMaster: boolean
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const question = live.activeQuestion
  const topicDef = live.activeTopic ? TOPICS_BY_ID[live.activeTopic] : null
  if (!question) return <LoadingCard label="Reveal …" />

  const selectedIdx = live.selectedRenderedIndex
  const correctIdx = live.correctRenderedIndex
  const wasCorrect = selectedIdx === correctIdx

  return (
    <>
      <Card
        className={cn(
          'space-y-3',
          isMaster ? 'p-8 md:p-10' : 'p-4',
          wasCorrect
            ? 'border-correct/40 bg-correct/[0.06]'
            : 'border-wrong/40 bg-wrong/[0.06]',
        )}
      >
        {topicDef && (
          <div
            className={cn(
              'flex items-center gap-2 uppercase tracking-[0.22em] text-white/70',
              isMaster ? 'text-sm md:text-base' : 'text-xs',
            )}
          >
            <span
              aria-hidden
              className={isMaster ? 'text-2xl md:text-3xl' : ''}
            >
              {topicDef.emoji}
            </span>
            {topicDef.label}
          </div>
        )}
        <div
          className={cn(
            'font-semibold text-white',
            isMaster
              ? 'text-3xl leading-tight md:text-5xl md:leading-tight'
              : 'text-lg md:text-xl',
          )}
        >
          {question.question}
        </div>
      </Card>

      <div className={cn('space-y-2', isMaster && 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0')}>
        {live.shuffledOptions.map((option, idx) => {
          const isCorrect = idx === correctIdx
          const isSelected = idx === selectedIdx
          return (
            <div
              key={idx}
              className={cn(
                'flex items-center rounded-xl border',
                isMaster ? 'gap-4 px-5 py-4' : 'gap-3 px-4 py-3',
                isCorrect
                  ? 'border-correct/60 bg-correct/15 text-correct'
                  : isSelected
                    ? 'border-wrong/60 bg-wrong/15 text-wrong'
                    : 'border-white/10 bg-white/[0.02] text-white/60',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full font-mono font-bold',
                  isMaster ? 'h-11 w-11 text-lg' : 'h-8 w-8 text-sm',
                  isCorrect
                    ? 'bg-correct/25'
                    : isSelected
                      ? 'bg-wrong/25'
                      : 'bg-white/10',
                )}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span
                className={cn(
                  'flex-1',
                  isMaster ? 'text-lg md:text-xl' : 'text-sm md:text-base',
                )}
              >
                {option}
              </span>
              {isCorrect && (
                <span
                  className={cn(
                    'uppercase tracking-wider',
                    isMaster ? 'text-sm font-bold' : 'text-[10px]',
                  )}
                >
                  richtig
                </span>
              )}
              {isSelected && !isCorrect && (
                <span
                  className={cn(
                    'uppercase tracking-wider',
                    isMaster ? 'text-sm font-bold' : 'text-[10px]',
                  )}
                >
                  gewählt
                </span>
              )}
            </div>
          )
        })}
      </div>

      {question.explanation && (
        <Card
          className={cn(
            'text-white/80',
            isMaster ? 'p-5 text-base md:text-lg' : 'p-3 text-sm',
          )}
        >
          <div
            className={cn(
              'mb-1 uppercase tracking-[0.22em] text-ink-muted',
              isMaster ? 'text-xs' : 'text-[10px]',
            )}
          >
            Erklärung
          </div>
          {question.explanation}
        </Card>
      )}

      <Button
        size="lg"
        variant="primary"
        onClick={() => send({ type: 'CD_NEXT_TURN' })}
        disabled={!canDispatch}
        className={cn('w-full', isMaster && 'h-16 text-lg')}
      >
        {live.usedTopics.length >= 12 ? 'Runde beenden' : 'Nächste Runde'}
      </Button>
    </>
  )
}

// ---------- Spotlight (Player-Heimspiel) -----------------------------------

/**
 * Spotlight-Modus („Heimspiel"): jeder Spieler mit Interessen bekommt eine
 * Frage aus einem seiner Topics. Er antwortet zuerst frei (mündlich), Master
 * markiert richtig oder falsch. Bei falsch: Gegenteam bekommt Multiple-Choice
 * (halbe Punkte).
 *
 * Semantik im Multi-Device:
 *   - Master oder aktueller Player klickt „Richtig!"/„Falsch"
 *   - Nur Nicht-Team-Mitglieder des aktiven Spielers sehen Steal-Options
 *   - Alle sehen die Auflösung
 */
function SpotlightRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: SpotlightLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />

  const activePlayer = live.activePlayerId
    ? state.round.players.find((p) => p.id === live.activePlayerId)
    : null
  const activeTeam = activePlayer
    ? state.round.teams.find((t) => t.id === activePlayer.teamId) ?? null
    : null
  const topicDef = live.activeTopic ? TOPICS_BY_ID[live.activeTopic] : null
  const question = live.activeQuestion

  const myPlayer = playerId
    ? state.round.players.find((p) => p.id === playerId)
    : null
  const isMaster = !myPlayer
  const isMyTurn = !!myPlayer && myPlayer.id === live.activePlayerId
  const isTeamMate = !!myPlayer && !isMyTurn && myPlayer.teamId === activePlayer?.teamId
  const isOpponent = !!myPlayer && myPlayer.teamId !== activePlayer?.teamId

  if (live.phase === 'empty') {
    return (
      <Card className="space-y-2 p-6 text-center">
        <div className="text-lg text-white/80">
          Keine spielbaren Interessen im Roster.
        </div>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'FINISH_MODE' })}
          disabled={!canDispatch}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          Modus überspringen
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className={cn('p-3', isMaster && 'p-4')}>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-brand-pink-soft">
              Spotlight
            </div>
            <div
              className={cn(
                'mt-0.5 font-mono text-white',
                isMaster ? 'text-lg' : 'text-sm',
              )}
            >
              Zug {live.currentIndex + 1} / {live.playerOrder.length}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {state.round.teams.map((team) => (
              <div
                key={team.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-white/[0.04]',
                  isMaster ? 'px-3 py-2' : 'px-2 py-1',
                )}
              >
                <span
                  className={cn('rounded-full', isMaster ? 'h-3 w-3' : 'h-2 w-2')}
                  style={{ background: getTeamColorHex(team.color) }}
                />
                <span className={cn('text-white/80', isMaster ? 'text-sm' : 'text-xs')}>
                  {team.name}
                </span>
                <span
                  className={cn(
                    'font-mono font-bold text-white tabular-nums',
                    isMaster ? 'text-2xl' : 'text-sm',
                  )}
                >
                  {live.scores[team.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Aktiver Spieler + Topic */}
      {activePlayer && (
        <Card
          className={cn(
            'flex items-center gap-3 border-brand-pink/40 bg-brand-pink/[0.06]',
            isMaster ? 'p-6' : 'p-3',
          )}
        >
          <span
            className={cn(
              'flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white',
              isMaster ? 'h-16 w-16 text-2xl' : 'h-10 w-10 text-base',
            )}
            style={{
              background: activeTeam
                ? getTeamColorHex(activeTeam.color)
                : 'rgba(255,255,255,0.1)',
            }}
          >
            {(activePlayer.name || 'N').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'font-semibold text-white',
                isMaster ? 'text-2xl md:text-3xl' : 'text-base',
              )}
            >
              {activePlayer.name || 'Namenlos'}
            </div>
            <div className={cn('text-white/70', isMaster ? 'text-base' : 'text-xs')}>
              {activeTeam?.name}
              {topicDef && (
                <>
                  {' · '}
                  <span aria-hidden>{topicDef.emoji}</span> {topicDef.label}
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Frage */}
      {question ? (
        <Card
          className={cn(
            'space-y-3',
            isMaster ? 'p-8 md:p-12' : 'p-4',
            live.phase === 'revealed' &&
              live.primaryOutcome === 'correct' &&
              'border-correct/40 bg-correct/[0.06]',
            live.phase === 'revealed' &&
              live.primaryOutcome === 'wrong' &&
              'border-wrong/40 bg-wrong/[0.06]',
          )}
        >
          <div
            className={cn(
              'font-semibold text-white',
              isMaster
                ? 'text-3xl leading-tight md:text-5xl md:leading-tight'
                : 'text-lg md:text-xl',
            )}
          >
            {question.question}
          </div>
        </Card>
      ) : (
        <LoadingCard label="Frage wird geladen …" />
      )}

      {/* Phase-abhängige Interaktion */}
      {live.phase === 'primary' && question && (
        <SpotlightPrimaryPanel
          isMaster={isMaster}
          isMyTurn={isMyTurn}
          isTeamMate={isTeamMate}
          canDispatch={canDispatch}
          playerName={activePlayer?.name ?? ''}
          send={send}
        />
      )}

      {live.phase === 'steal' && question && (
        <SpotlightStealPanel
          isMaster={isMaster}
          isOpponent={isOpponent}
          canDispatch={canDispatch}
          shuffledOptions={live.shuffledOptions}
          send={send}
        />
      )}

      {live.phase === 'revealed' && question && (
        <>
          <SpotlightRevealPanel
            isMaster={isMaster}
            live={live}
          />
          <Button
            size="lg"
            variant="primary"
            onClick={() => send({ type: 'SPOTLIGHT_NEXT' })}
            disabled={!canDispatch}
            className={cn('w-full', isMaster && 'h-16 text-lg')}
          >
            {live.currentIndex + 1 >= live.playerOrder.length
              ? 'Runde beenden'
              : 'Nächster Spieler'}
          </Button>
        </>
      )}
    </div>
  )
}

function SpotlightPrimaryPanel({
  isMaster,
  isMyTurn,
  isTeamMate,
  canDispatch,
  playerName,
  send,
}: {
  isMaster: boolean
  isMyTurn: boolean
  isTeamMate: boolean
  canDispatch: boolean
  playerName: string
  send: (a: GameAction) => void
}) {
  // Primär-Phase: Frage wurde vorgelesen, Player antwortet mündlich.
  // Master (oder der Player selbst) klickt „richtig" oder „falsch".
  return (
    <Card className={cn('space-y-3', isMaster ? 'p-5' : 'p-4')}>
      <div className="text-[10px] uppercase tracking-[0.32em] text-ink-muted">
        {isMyTurn
          ? 'Sag deine Antwort — jemand markiert Richtig / Falsch'
          : isTeamMate
            ? `${playerName} antwortet frei — kein Reinreden`
            : `Master markiert die Antwort für ${playerName}`}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => send({ type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'correct' })}
          disabled={!canDispatch || isTeamMate}
          className={cn(
            'flex items-center justify-center rounded-xl border font-bold uppercase tracking-wider transition-all disabled:opacity-40',
            isMaster ? 'h-20 text-2xl' : 'h-16 text-lg',
            'border-correct/60 bg-correct/15 text-correct hover:bg-correct/25',
          )}
        >
          Richtig!
        </button>
        <button
          type="button"
          onClick={() => send({ type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'wrong' })}
          disabled={!canDispatch || isTeamMate}
          className={cn(
            'flex items-center justify-center rounded-xl border font-bold uppercase tracking-wider transition-all disabled:opacity-40',
            isMaster ? 'h-20 text-2xl' : 'h-16 text-lg',
            'border-wrong/60 bg-wrong/15 text-wrong hover:bg-wrong/25',
          )}
        >
          Falsch
        </button>
      </div>
    </Card>
  )
}

function SpotlightStealPanel({
  isMaster,
  isOpponent,
  canDispatch,
  shuffledOptions,
  send,
}: {
  isMaster: boolean
  isOpponent: boolean
  canDispatch: boolean
  shuffledOptions: string[]
  send: (a: GameAction) => void
}) {
  const canClick = canDispatch && (isMaster || isOpponent)
  return (
    <>
      <Card className={cn('space-y-2', isMaster ? 'p-5' : 'p-3')}>
        <div className="text-[10px] uppercase tracking-[0.32em] text-brand-orange-soft">
          Steal — Gegenteam ist dran (halbe Punkte)
        </div>
      </Card>
      <div className={cn('space-y-2', isMaster && 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0')}>
        {shuffledOptions.map((option, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => send({ type: 'SPOTLIGHT_STEAL_ANSWER', renderedIndex: idx })}
            disabled={!canClick}
            className={cn(
              'flex w-full items-center rounded-xl border text-left transition-all disabled:opacity-40',
              isMaster ? 'gap-4 px-5 py-4' : 'gap-3 px-4 py-3',
              canClick
                ? 'border-brand-orange/40 bg-white/[0.04] text-white hover:border-brand-orange/70 hover:bg-brand-orange/10'
                : 'border-white/10 bg-white/[0.03] text-white/70',
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full bg-white/10 font-mono font-bold',
                isMaster ? 'h-11 w-11 text-lg' : 'h-8 w-8 text-sm',
              )}
            >
              {String.fromCharCode(65 + idx)}
            </span>
            <span className={cn('flex-1', isMaster ? 'text-lg md:text-xl' : 'text-sm md:text-base')}>
              {option}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

function SpotlightRevealPanel({
  isMaster,
  live,
}: {
  isMaster: boolean
  live: SpotlightLive
}) {
  const question = live.activeQuestion!
  const correctIdx = live.correctRenderedIndex
  const stealIdx = live.stealRenderedIndex
  return (
    <>
      <div className={cn('space-y-2', isMaster && 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0')}>
        {live.shuffledOptions.map((option, idx) => {
          const isCorrect = idx === correctIdx
          const isSteal = idx === stealIdx
          return (
            <div
              key={idx}
              className={cn(
                'flex items-center rounded-xl border',
                isMaster ? 'gap-4 px-5 py-4' : 'gap-3 px-4 py-3',
                isCorrect
                  ? 'border-correct/60 bg-correct/15 text-correct'
                  : isSteal
                    ? 'border-wrong/60 bg-wrong/15 text-wrong'
                    : 'border-white/10 bg-white/[0.02] text-white/60',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full font-mono font-bold',
                  isMaster ? 'h-11 w-11 text-lg' : 'h-8 w-8 text-sm',
                  isCorrect ? 'bg-correct/25' : isSteal ? 'bg-wrong/25' : 'bg-white/10',
                )}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span
                className={cn(
                  'flex-1',
                  isMaster ? 'text-lg md:text-xl' : 'text-sm md:text-base',
                )}
              >
                {option}
              </span>
              {isCorrect && (
                <span className={cn('uppercase tracking-wider', isMaster ? 'text-sm font-bold' : 'text-[10px]')}>
                  richtig
                </span>
              )}
            </div>
          )
        })}
      </div>

      {question.explanation && (
        <Card
          className={cn(
            'text-white/80',
            isMaster ? 'p-5 text-base md:text-lg' : 'p-3 text-sm',
          )}
        >
          <div
            className={cn(
              'mb-1 uppercase tracking-[0.22em] text-ink-muted',
              isMaster ? 'text-xs' : 'text-[10px]',
            )}
          >
            Erklärung
          </div>
          {question.explanation}
        </Card>
      )}
    </>
  )
}

// ---------- Klick! (Warm-Up-Rätsel) ----------------------------------------

/**
 * Klick! / Around-Corner: fünf Rätsel-Fragen mit stufenweisen Hinweisen.
 * Alle beraten gemeinsam (kein Team-Match). Master (oder jeder) klickt sich
 * durch die Hinweise, bis jemand die Lösung ruft — dann „Auflösen" und
 * weiter zum nächsten Rätsel.
 */
function AroundCornerRoomView({
  live,
  playerId,
  state,
  canDispatch,
  send,
}: {
  live: AroundCornerLive
  playerId: string | null
  state: GameState
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const myPlayer = playerId
    ? state.round?.players.find((p) => p.id === playerId)
    : null
  const isMaster = !myPlayer
  const question = live.activeQuestion

  if (live.phase === 'empty' || !question) {
    return (
      <Card className="space-y-2 p-6 text-center">
        <div className="text-lg text-white/80">Kein Rätsel mehr im Katalog.</div>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'AC_NEXT' })}
          disabled={!canDispatch}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          Modus beenden
        </Button>
      </Card>
    )
  }

  const revealedHints = question.hints.slice(0, live.revealedHints)
  const remainingHints = question.hints.length - live.revealedHints

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className={cn('p-3', isMaster && 'p-4')}>
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.32em] text-brand-cyan-soft">
            Klick!
          </div>
          <div className={cn('font-mono text-white', isMaster ? 'text-lg' : 'text-sm')}>
            Rätsel {live.currentIndex + 1} / {live.totalRiddles}
          </div>
        </div>
      </Card>

      {/* Frage */}
      <Card
        className={cn(
          'space-y-3',
          isMaster ? 'p-8 md:p-12' : 'p-4',
          live.phase === 'revealed' && 'border-correct/40 bg-correct/[0.05]',
        )}
      >
        <div
          className={cn(
            'font-semibold text-white',
            isMaster
              ? 'text-3xl leading-tight md:text-5xl md:leading-tight'
              : 'text-lg md:text-xl',
          )}
        >
          {question.question}
        </div>
      </Card>

      {/* Hinweise (progressiv) */}
      {revealedHints.length > 0 && (
        <div className="space-y-2">
          {revealedHints.map((hint, i) => (
            <Card
              key={i}
              className={cn(
                'flex items-start gap-3 border-brand-cyan/30 bg-brand-cyan/[0.04]',
                isMaster ? 'p-5' : 'p-3',
              )}
            >
              <span
                className={cn(
                  'flex flex-shrink-0 items-center justify-center rounded-full bg-brand-cyan/25 font-mono font-bold text-brand-cyan-soft',
                  isMaster ? 'h-10 w-10 text-lg' : 'h-7 w-7 text-sm',
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'flex-1 text-white',
                  isMaster ? 'text-lg md:text-xl' : 'text-sm md:text-base',
                )}
              >
                {hint}
              </span>
            </Card>
          ))}
        </div>
      )}

      {/* Lösung (bei revealed) */}
      {live.phase === 'revealed' && (
        <Card
          className={cn(
            'space-y-1 border-correct/60 bg-correct/10',
            isMaster ? 'p-6' : 'p-4',
          )}
        >
          <div className="text-[10px] uppercase tracking-[0.32em] text-correct">
            Lösung
          </div>
          <div
            className={cn(
              'font-bold text-white',
              isMaster ? 'text-3xl md:text-4xl' : 'text-lg md:text-xl',
            )}
          >
            {question.solution}
          </div>
        </Card>
      )}

      {/* Aktionen */}
      {live.phase === 'guessing' ? (
        <div className={cn('space-y-2', isMaster && 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0')}>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => send({ type: 'AC_REVEAL_HINT' })}
            disabled={!canDispatch || remainingHints === 0}
            className={cn('w-full', isMaster && 'h-16 text-lg')}
          >
            {remainingHints > 0
              ? `Hinweis aufdecken (${remainingHints} übrig)`
              : 'Keine Hinweise mehr'}
          </Button>
          <Button
            size="lg"
            variant="primary"
            onClick={() => send({ type: 'AC_REVEAL_SOLUTION' })}
            disabled={!canDispatch}
            className={cn('w-full', isMaster && 'h-16 text-lg')}
          >
            Auflösen
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'AC_NEXT' })}
          disabled={!canDispatch}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {live.currentIndex + 1 >= live.totalRiddles
            ? 'Klick! beenden'
            : 'Nächstes Rätsel'}
        </Button>
      )}
    </div>
  )
}

/**
 * Blitzrunde: der erste voll spielbare Modus im Multi-Device-Room.
 *
 * Auf dem Handy: aktuelle Behauptung, für das eigene Team die zwei Buttons
 * „Stimmt" / „Falsch". Nach der Antwort: Warten-Zustand oder Auflösen. Alle
 * Teams (Player wie Master) können den Reveal auslösen — im Party-Kontext
 * ist meistens der Master, aber wir sperren nichts.
 */
function FlashRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: FlashLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />

  const question = live.activeQuestion
  const myPlayer = playerId
    ? state.round.players.find((p) => p.id === playerId)
    : null
  const isMaster = !myPlayer // Master hat keinen Player-Eintrag im State.
  const myTeamId = myPlayer?.teamId ?? null
  const myTeamAnswer = myTeamId ? live.teamAnswers[myTeamId] : null
  const allTeamsAnswered = state.round.teams.every(
    (t) => live.teamAnswers[t.id] !== null && live.teamAnswers[t.id] !== undefined,
  )

  return (
    <div className="space-y-3">
      {/* Header: Zähler + Punkte-Übersicht (bei Master gr\u00f6\u00dfer) */}
      <Card className={cn('p-3', isMaster && 'p-4')}>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-brand-cyan-soft">
              Blitzrunde
            </div>
            <div
              className={cn(
                'mt-0.5 font-mono text-white',
                isMaster ? 'text-lg' : 'text-sm',
              )}
            >
              Behauptung {live.currentIndex + 1} / {live.totalStatements}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {state.round.teams.map((team) => (
              <div
                key={team.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-white/[0.04]',
                  isMaster ? 'px-3 py-2' : 'px-2 py-1',
                )}
              >
                <span
                  className={cn(
                    'rounded-full',
                    isMaster ? 'h-3 w-3' : 'h-2 w-2',
                  )}
                  style={{ background: getTeamColorHex(team.color) }}
                />
                <span
                  className={cn(
                    'text-white/80',
                    isMaster ? 'text-sm' : 'text-xs',
                  )}
                >
                  {team.name}
                </span>
                <span
                  className={cn(
                    'font-mono font-bold text-white tabular-nums',
                    isMaster ? 'text-2xl' : 'text-sm',
                  )}
                >
                  {live.scores[team.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Frage — gr\u00f6\u00dfer im Master-Presenter-Mode */}
      {question ? (
        <Card
          className={cn(
            'space-y-3',
            isMaster ? 'p-8 md:p-12' : 'p-4',
            live.phase === 'revealed' &&
              (question.correctAnswer
                ? 'border-correct/40 bg-correct/[0.05]'
                : 'border-wrong/40 bg-wrong/[0.05]'),
          )}
        >
          <div
            className={cn(
              'text-center font-semibold text-white',
              isMaster
                ? 'text-3xl leading-tight md:text-5xl md:leading-tight'
                : 'text-lg md:text-xl',
            )}
          >
            {question.question}
          </div>
          {live.phase === 'revealed' && (
            <div
              className={cn(
                'rounded-lg bg-black/40 text-center',
                isMaster ? 'p-6' : 'p-3',
              )}
            >
              <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">
                Antwort
              </div>
              <div
                className={cn(
                  'mt-1 font-bold uppercase tracking-wide',
                  isMaster ? 'text-5xl md:text-7xl' : 'text-2xl',
                  question.correctAnswer ? 'text-correct' : 'text-wrong',
                )}
              >
                {question.correctAnswer ? 'Stimmt' : 'Falsch'}
              </div>
              {question.explanation && (
                <div
                  className={cn(
                    'mt-2 text-white/70',
                    isMaster ? 'text-base md:text-lg' : 'text-xs',
                  )}
                >
                  {question.explanation}
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <LoadingCard label="Keine Frage geladen." />
      )}

      {/* Wahr/Falsch-Buttons f\u00fcr Player-am-Zug. Master klickt nicht selbst. */}
      {live.phase === 'answering' && myTeamId && !isMaster && (
        <Card className="space-y-2 p-4">
          <div className="text-[10px] uppercase tracking-[0.32em] text-ink-muted">
            Antwort für dein Team ·{' '}
            {state.round.teams.find((t) => t.id === myTeamId)?.name}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TfButton
              label="Stimmt"
              tone="correct"
              active={myTeamAnswer === true}
              onClick={() =>
                send({
                  type: 'FLASH_SET_ANSWER',
                  teamId: myTeamId,
                  answer: true,
                })
              }
              disabled={!canDispatch}
            />
            <TfButton
              label="Falsch"
              tone="wrong"
              active={myTeamAnswer === false}
              onClick={() =>
                send({
                  type: 'FLASH_SET_ANSWER',
                  teamId: myTeamId,
                  answer: false,
                })
              }
              disabled={!canDispatch}
            />
          </div>
        </Card>
      )}

      {/* Team-Antworten-Panel: wer hat schon geantwortet */}
      <Card className={cn('space-y-2', isMaster ? 'p-5' : 'p-3')}>
        <div
          className={cn(
            'uppercase tracking-[0.32em] text-ink-muted',
            isMaster ? 'text-xs' : 'text-[10px]',
          )}
        >
          Team-Antworten
        </div>
        <div
          className={cn(
            'grid gap-1.5',
            isMaster ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2',
          )}
        >
          {state.round.teams.map((team) => {
            const answer = live.teamAnswers[team.id]
            const isRevealed = live.phase === 'revealed' && question
            const correct = isRevealed && answer === question.correctAnswer
            const wrong = isRevealed && answer !== null && !correct
            return (
              <div
                key={team.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border',
                  isMaster ? 'px-3 py-3 text-base' : 'px-2 py-1.5 text-sm',
                  correct && 'border-correct/40 bg-correct/[0.08]',
                  wrong && 'border-wrong/40 bg-wrong/[0.08]',
                  !isRevealed && 'border-white/10 bg-white/[0.03]',
                )}
              >
                <span
                  className={cn(
                    'rounded-full',
                    isMaster ? 'h-3 w-3' : 'h-2 w-2',
                  )}
                  style={{ background: getTeamColorHex(team.color) }}
                />
                <span className="flex-1 text-white/85">{team.name}</span>
                {answer === null || answer === undefined ? (
                  <span
                    className={cn(
                      'text-white/40',
                      isMaster ? 'text-lg' : 'text-xs',
                    )}
                  >
                    …
                  </span>
                ) : (
                  <span
                    className={cn(
                      'font-mono font-bold uppercase',
                      isMaster ? 'text-lg' : 'text-xs',
                      correct
                        ? 'text-correct'
                        : wrong
                          ? 'text-wrong'
                          : 'text-white/70',
                    )}
                  >
                    {answer ? 'Stimmt' : 'Falsch'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Footer: Aktion */}
      {live.phase === 'answering' ? (
        <Button
          size="lg"
          variant={allTeamsAnswered ? 'primary' : 'secondary'}
          onClick={() => send({ type: 'FLASH_REVEAL' })}
          disabled={!canDispatch}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {allTeamsAnswered ? 'Auflösen' : 'Auflösen (jederzeit)'}
        </Button>
      ) : (
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'FLASH_NEXT' })}
          disabled={!canDispatch}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {live.currentIndex + 1 >= live.totalStatements
            ? 'Blitzrunde beenden'
            : 'Nächste Behauptung'}
        </Button>
      )}
    </div>
  )
}

/** Kleiner True/False-Button, groß genug fürs Handy. */
function TfButton({
  label,
  tone,
  active,
  onClick,
  disabled,
}: {
  label: string
  tone: 'correct' | 'wrong'
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-16 items-center justify-center rounded-xl border text-lg font-bold uppercase tracking-wider transition-all disabled:opacity-40',
        active
          ? tone === 'correct'
            ? 'border-correct/70 bg-correct/20 text-correct'
            : 'border-wrong/70 bg-wrong/20 text-wrong'
          : tone === 'correct'
            ? 'border-correct/30 bg-correct/[0.05] text-correct hover:bg-correct/10'
            : 'border-wrong/30 bg-wrong/[0.05] text-wrong hover:bg-wrong/10',
      )}
    >
      {label}
    </button>
  )
}

function PlayingPhaseView({
  state,
  canDispatch,
  send,
}: {
  state: GameState
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const currentModeId = state.round?.gameModes[state.currentModeIndex]
  const modeName = currentModeId ? MODES_BY_ID[currentModeId]?.name : null

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          Modus läuft
        </div>
        <div className="mt-1 flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-brand-purple-soft" />
          <span className="text-lg font-semibold text-white">
            {modeName ?? '—'}
          </span>
        </div>
        <div className="mt-1 font-mono text-xs text-ink-muted">
          kind: {state.live?.kind ?? '—'}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          Live-State
        </div>
        <details className="rounded bg-black/40 p-2 text-[11px] text-white/80">
          <summary className="cursor-pointer">JSON</summary>
          <pre className="mt-2 overflow-x-auto">
            {JSON.stringify(state.live, null, 2)}
          </pre>
        </details>
      </Card>

      <Button
        size="lg"
        variant="secondary"
        onClick={() => send({ type: 'FINISH_MODE' })}
        disabled={!canDispatch}
        className="w-full"
      >
        Modus beenden
      </Button>

      <p className="text-center text-[11px] text-ink-muted">
        Die vollen Spiel-UIs kommen im nächsten Release. Bis dahin:
        Master-Screen zum Anzeigen, Player-Handys zum Dispatchen.
      </p>
    </div>
  )
}

function ScoreboardPhaseView({
  state,
  canDispatch,
  send,
}: {
  state: GameState
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          Endstand
        </div>
        <div className="space-y-2">
          {state.round?.teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: getTeamColorHex(team.color) }}
              />
              <span className="flex-1 text-sm font-semibold text-white">
                {team.name}
              </span>
              <span className="font-mono text-lg font-bold text-white">
                {state.matchPoints[team.id] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          leading={<RefreshCw className="h-4 w-4" />}
          onClick={() => send({ type: 'BACK_TO_SETUP' })}
          disabled={!canDispatch}
          className="flex-1"
        >
          Nochmal
        </Button>
        <Link to="/" className="flex-1">
          <Button variant="ghost" className="w-full">
            Zur Startseite
          </Button>
        </Link>
      </div>
    </div>
  )
}
