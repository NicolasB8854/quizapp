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
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  ListOrdered,
  Loader2,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import type { GameAction, GameState } from '@quizapp/shared'
import { MODES, MODES_BY_ID, getTeamColorHex } from '@quizapp/shared'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
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

  const canDispatch = room.status === 'joined' && role === 'player'

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
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
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

        {/* Room-Code + Rolle */}
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
                {role === 'master' ? 'Master-Screen' : 'Player'}
              </div>
              <div className="mt-1 font-semibold text-white">{playerName}</div>
            </div>
          </div>
        </Card>

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
  canDispatch,
  send,
}: {
  state: GameState
  role: 'player' | 'master'
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
      return <LobbyPhaseView state={state} role={role} canDispatch={canDispatch} send={send} />
    case 'playing':
      return <PlayingPhaseView state={state} canDispatch={canDispatch} send={send} />
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
          Nur Player können Setup-Actions auslösen. Master schaut zu.
        </p>
      )}
    </div>
  )
}

function LobbyPhaseView({
  state,
  role,
  canDispatch,
  send,
}: {
  state: GameState
  role: 'player' | 'master'
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const readyToStart =
    state.round.players.length > 0 &&
    state.round.players.every((p) => p.teamId !== null)

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
          Best-of-{state.round.bestOf} · Schritt: {state.lobbyStep}
        </div>
      </Card>

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
                <div className="mt-1 flex flex-wrap gap-1 pl-5 text-xs text-white/80">
                  {members.map((p) => (
                    <Badge key={p.id} tone="muted">
                      {p.name || 'Namenlos'}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {role === 'player' && (
        <Card className="space-y-2 p-4 text-xs text-ink-muted">
          <p>
            Roster & Team-Zuordnung nutzen aktuell noch die Offline-App —
            bis Multi-Device-Lobby fertig ist, kann der Master die Teams am
            großen Bildschirm einteilen.
          </p>
        </Card>
      )}

      <Button
        size="lg"
        variant="primary"
        onClick={() => send({ type: 'START_PLAYING' })}
        disabled={!canDispatch || !readyToStart}
        className="w-full"
      >
        Runde starten
      </Button>
    </div>
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
