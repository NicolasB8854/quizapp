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

import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  ListOrdered,
  Loader2,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type {
  AroundCornerLive,
  CategoryBoardLive,
  CategoryDuelLive,
  DuelLive,
  EliminationLive,
  ExpertsLive,
  FlashLive,
  GameAction,
  GameState,
  PointsLadderLive,
  SpotlightLive,
  SprinterLive,
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
import { ConfettiBurst } from '@/components/ConfettiBurst'
import { ModeTransitionSplash } from '@/components/ModeTransitionSplash'
import { ConnectionToast } from '@/components/ConnectionToast'
import { PlayerTeamMatesPanel } from '@/components/PlayerTeamMatesPanel'
import { useRoomSync } from '@/hooks/useRoomSync'
import { useSoundEnabled } from '@/hooks/useSoundEnabled'
import { playSound } from '@/lib/audio'
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

  // Team-Farb-Präsenz: sobald der Player einem Team beigetreten ist, ziehen
  // wir seine Team-Farbe als dünnen Balken über den Content. Gibt jedem Handy
  // ein sofort erkennbares „das ist meine Farbe"-Signal, ohne die
  // Content-Karten selbst zu überladen.
  const myPlayer =
    role === 'player' && room.playerId && room.state?.round
      ? room.state.round.players.find((p) => p.id === room.playerId) ?? null
      : null
  const myTeam = myPlayer
    ? room.state?.round?.teams.find((t) => t.id === myPlayer.teamId) ?? null
    : null
  const myTeamColor = myTeam ? getTeamColorHex(myTeam.color) : null

  // ---- Confetti-Feedback -----------------------------------------------
  // Kleiner Burst bei jedem Score-Anstieg im Playing (Team-Farbe der Punkte-
  // Gewinner), großer Burst beim Übergang in die Scoreboard-Phase (Winner-
  // Team-Farbe). Token-Timestamp erzwingt neuen Burst pro Trigger.
  const [burst, setBurst] = useState<{
    colors: string[]
    intensity: 'small' | 'large'
    token: number
  } | null>(null)
  const prevScoresRef = useRef<Record<string, number> | null>(null)
  const prevPhaseRef = useRef<string | null>(null)

  const liveScores =
    room.state?.live && 'scores' in room.state.live ? room.state.live.scores : null
  const teamsForBurst = room.state?.round?.teams ?? null
  const currentPhase = room.state?.phase ?? null

  useEffect(() => {
    // Score-Diff nur während Playing tracken; das Reset-Vermeidungs-Setzen
    // von prevScoresRef läuft aber immer, damit wir beim Wechsel in
    // playing keine Diffs auf 0-Referenzen bekommen.
    if (!liveScores || !teamsForBurst) {
      prevScoresRef.current = liveScores
      return
    }
    const previous = prevScoresRef.current
    prevScoresRef.current = { ...liveScores }
    if (!previous || currentPhase !== 'playing') return
    const winners = teamsForBurst.filter(
      (t) => (liveScores[t.id] ?? 0) > (previous[t.id] ?? 0),
    )
    if (winners.length === 0) return
    setBurst({
      colors: winners.map((t) => getTeamColorHex(t.color)),
      intensity: 'small',
      token: performance.now(),
    })
  }, [liveScores, teamsForBurst, currentPhase])

  useEffect(() => {
    const previousPhase = prevPhaseRef.current
    prevPhaseRef.current = currentPhase
    if (currentPhase !== 'scoreboard' || previousPhase === 'scoreboard') return
    const round = room.state?.round
    const matchPoints = room.state?.matchPoints ?? {}
    if (!round || round.teams.length === 0) return
    const maxPoints = Math.max(...round.teams.map((t) => matchPoints[t.id] ?? 0))
    if (maxPoints <= 0) return // Ohne Punkte: kein Winner-Burst.
    const winners = round.teams.filter((t) => (matchPoints[t.id] ?? 0) === maxPoints)
    setBurst({
      colors: winners.map((t) => getTeamColorHex(t.color)),
      intensity: 'large',
      token: performance.now(),
    })
  }, [currentPhase, room.state?.round, room.state?.matchPoints])

  // ---- Sound-Feedback --------------------------------------------------
  // Watchte einen kompakten Snapshot der Live-Situation und feuere Sounds
  // bei bestimmten Übergängen:
  //   correct — sobald der Score-Summenwert steigt (jede richtige Antwort).
  //   wrong   — beim Wechsel in 'revealed', wenn die Punktesumme unverändert.
  //   buzz    — beim Wechsel von 'awaiting-buzz' auf 'primary-answer'/'steal-answer'.
  //   timeUp  — Sprinter 'answering' → 'between-teams' oder Experts primaryOutcome='timeout'.
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()
  const prevSoundSnapshotRef = useRef<{
    kind: string
    phase: string
    scoresSum: number
    expertsPrimaryOutcome: string | null
  } | null>(null)

  useEffect(() => {
    const live = room.state?.live
    if (!live || currentPhase !== 'playing') {
      prevSoundSnapshotRef.current = null
      return
    }
    const scoresSum = Object.values(live.scores).reduce((s, n) => s + n, 0)
    const expertsPrimaryOutcome =
      live.kind === 'experts' ? (live as ExpertsLive).primaryOutcome ?? null : null
    const snapshot = {
      kind: live.kind,
      phase: live.phase,
      scoresSum,
      expertsPrimaryOutcome,
    }
    const prev = prevSoundSnapshotRef.current
    prevSoundSnapshotRef.current = snapshot
    if (!prev || prev.kind !== snapshot.kind) return // erster Snapshot oder Modus-Wechsel

    // 1. Score-Anstieg — passt für alle Modi.
    if (scoresSum > prev.scoresSum) {
      playSound('correct')
      return // ein Sound pro Snapshot reicht.
    }
    // 2. Reveal ohne Punktzuwachs — falsche Antwort.
    if (snapshot.phase === 'revealed' && prev.phase !== 'revealed') {
      playSound('wrong')
      return
    }
    // 3. Buzzer klick.
    if (
      (snapshot.phase === 'primary-answer' || snapshot.phase === 'steal-answer') &&
      prev.phase === 'awaiting-buzz'
    ) {
      playSound('buzz')
      return
    }
    // 4a. Sprinter-Timer abgelaufen.
    if (
      snapshot.kind === 'sprinter' &&
      snapshot.phase === 'between-teams' &&
      prev.phase === 'answering'
    ) {
      playSound('timeUp')
      return
    }
    // 4b. Experts-Solo-Timeout — Übergang primaryOutcome null → 'timeout'.
    if (
      snapshot.kind === 'experts' &&
      snapshot.expertsPrimaryOutcome === 'timeout' &&
      prev.expertsPrimaryOutcome !== 'timeout'
    ) {
      playSound('timeUp')
      return
    }
  }, [room.state?.live, currentPhase])

  // ---- Modus-Übergangs-Splash ------------------------------------------
  // Sobald wir in Playing sind und `live.kind` sich ändert (inklusive
  // dem ersten Übergang von null auf einen Modus), zeigen wir für ~1.6 s
  // einen Vollbild-Splash mit Modus-Name + Tagline. Beim Wechsel in
  // scoreboard kein Splash — dort feuert schon der Winner-Confetti-Burst.
  const [splash, setSplash] = useState<{
    mode: import('@quizapp/shared').GameMode
    modeIndex: number
    totalModes: number
    token: number
  } | null>(null)
  const prevLiveKindRef = useRef<string | null>(null)
  const currentLiveKind = room.state?.live?.kind ?? null
  const currentModeIndex = room.state?.currentModeIndex ?? 0

  useEffect(() => {
    const previous = prevLiveKindRef.current
    prevLiveKindRef.current = currentLiveKind
    if (currentPhase !== 'playing' || !currentLiveKind) return
    if (previous === currentLiveKind) return
    // Modus für den Splash aus der Runden-Modes-Sequenz beziehen.
    const round = room.state?.round
    if (!round) return
    const modeId = round.gameModes[currentModeIndex]
    const mode = modeId ? MODES_BY_ID[modeId] : null
    if (!mode) return
    setSplash({
      mode,
      modeIndex: currentModeIndex,
      totalModes: round.gameModes.length,
      token: performance.now(),
    })
  }, [currentLiveKind, currentPhase, currentModeIndex, room.state?.round])

  return (
    <ScreenLayout variant="dim">
      {myTeamColor && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px]"
          style={{
            background: myTeamColor,
            boxShadow: `0 0 12px ${myTeamColor}, 0 0 24px ${myTeamColor}80`,
          }}
        />
      )}
      {burst && (
        <ConfettiBurst
          colors={burst.colors}
          intensity={burst.intensity}
          token={burst.token}
          onDone={() => setBurst(null)}
        />
      )}
      {splash && (
        <ModeTransitionSplash
          mode={splash.mode}
          modeIndex={splash.modeIndex}
          totalModes={splash.totalModes}
          token={splash.token}
          onDone={() => setSplash(null)}
        />
      )}
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
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? 'Sound aus' : 'Sound an'}
            title={soundEnabled ? 'Sound aus' : 'Sound an'}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
              soundEnabled
                ? 'border-brand-purple/40 bg-brand-purple/10 text-brand-purple-soft hover:bg-brand-purple/20'
                : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70',
            )}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
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
          <Card
            className="space-y-3 p-4"
            style={
              myTeamColor
                ? { borderColor: `${myTeamColor}66`, boxShadow: `inset 0 1px 0 ${myTeamColor}55` }
                : undefined
            }
          >
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
                  {myTeam ? myTeam.name : 'Player'}
                </div>
                <div className="mt-1 flex items-center justify-end gap-2 font-semibold text-white">
                  {myTeamColor && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: myTeamColor,
                        boxShadow: `0 0 8px ${myTeamColor}`,
                      }}
                      aria-hidden
                    />
                  )}
                  <span>{playerName}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Verbindungs-Feedback: bleibt so lange wie möglich als schmaler
             Toast; Content darunter bleibt sichtbar, damit Reconnects nicht
             die ganze Bühne wegwischen. Priorität: Error > Reconnect > Config. */}
        {room.lastError ? (
          <ConnectionToast
            tone="error"
            label="Fehler"
            message={room.lastError}
          />
        ) : room.status === 'reconnecting' ? (
          <ConnectionToast
            tone="info"
            label="Verbindung"
            message="Wird wiederhergestellt …"
            showSpinner
          />
        ) : !wsUrl ? (
          <ConnectionToast
            tone="warn"
            label="Config"
            message="VITE_WS_URL fehlt — Multi-Device deaktiviert."
          />
        ) : null}

        {/* Teammates-Streifen: nur für Player im Playing, wenn Team gesetzt. */}
        {role === 'player' &&
          currentPhase === 'playing' &&
          myPlayer &&
          myTeam &&
          room.state?.round && (
            <PlayerTeamMatesPanel
              team={myTeam}
              myPlayer={myPlayer}
              teamPlayers={room.state.round.players.filter(
                (p) => p.teamId === myTeam.id,
              )}
            />
          )}

        {/* Content nach Status. Bei reconnecting mit vorhandenem State
             behalten wir die letzte Bühne — Buttons sind über canDispatch
             ohnehin deaktiviert. */}
        {(room.status === 'joined' || room.status === 'reconnecting') && room.state ? (
          <PhaseView
            state={room.state}
            role={role}
            playerId={room.playerId}
            canDispatch={canDispatch}
            send={send}
          />
        ) : room.status === 'connecting' || room.status === 'joining' ? (
          <LoadingCard label="Verbinde …" />
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
          role={role}
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
      if (live?.kind === 'points-ladder') {
        return <LadderRoomView state={state} live={live} playerId={playerId} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'sprinter') {
        return <SprinterRoomView state={state} live={live} playerId={playerId} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'elimination') {
        return <EliminationRoomView state={state} live={live} playerId={playerId} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'category-board') {
        return <BoardRoomView state={state} live={live} playerId={playerId} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'duel-1v1') {
        return <DuelRoomView state={state} live={live} playerId={playerId} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'experts') {
        return <ExpertsRoomView state={state} live={live} playerId={playerId} canDispatch={canDispatch} send={send} />
      }
      return <PlayingPhaseView state={state} canDispatch={canDispatch} send={send} />
    }
    case 'scoreboard':
      return (
        <ScoreboardPhaseView
          state={state}
          role={role}
          canDispatch={canDispatch}
          send={send}
        />
      )
  }
}

function SetupPhaseView({
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
  const readyModes = MODES.filter((m) => m.status === 'ready')
  // Setup ist Show-Runner-Territorium — der Master konfiguriert Modi/Teams
  // für alle. Player warten nur; sonst könnten sie z. B. Teams entfernen,
  // während der Master schon konfiguriert.
  if (role !== 'master') {
    return (
      <Card className="space-y-2 p-5 text-center">
        <div className="text-[10px] uppercase tracking-[0.32em] text-brand-purple-soft">
          Setup
        </div>
        <div className="text-base font-semibold text-white">
          Warte auf den Master
        </div>
        <div className="text-xs text-ink-muted">
          Der Master wählt die Modi und startet die Lobby. Gleich geht&apos;s los.
        </div>
      </Card>
    )
  }
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
        disabled={!canDispatch || !isMaster}
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
          disabled={!canDispatch || !isMaster}
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
            disabled={!canDispatch || !isMaster}
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
          disabled={!canDispatch || !isMaster}
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
            disabled={!canDispatch || !isMaster}
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
          disabled={!canDispatch || !isMaster}
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
          disabled={!canDispatch || !isMaster}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {allTeamsAnswered ? 'Auflösen' : 'Auflösen (jederzeit)'}
        </Button>
      ) : (
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'FLASH_NEXT' })}
          disabled={!canDispatch || !isMaster}
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

// ============================================================================
// Weitere Modi (Ladder / Sprinter / Elimination / Board / Duel / Experts)
// ============================================================================
//
// Alle sechs folgen dem gleichen Aufbau wie Flash/Themen-Battle/Spotlight/
// AroundCorner: eine Root-Komponente pro `live.kind`, phase-abhängige
// Sub-Views, kompaktes Master-Presenter-Styling. Der Reducer + alle Actions
// existieren bereits — hier ist reine UI-Verdrahtung.

// ---------- Ladder (Alles oder Nichts) --------------------------------------

function LadderRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: PointsLadderLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const question = live.activeQuestion
  const myPlayer = playerId ? state.round.players.find((p) => p.id === playerId) : null
  const isMaster = !myPlayer
  const myTeamId = myPlayer?.teamId ?? null
  const currentStake = live.ladder[live.currentIndex] ?? 0
  const allAnswered = state.round.teams.every(
    (t) => live.teamAnswers[t.id] !== null && live.teamAnswers[t.id] !== undefined,
  )

  if (live.phase === 'empty' || !question) {
    return (
      <Card className="space-y-2 p-6 text-center">
        <div className="text-lg text-white/80">Keine Fragen im Katalog.</div>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'FINISH_MODE' })}
          disabled={!canDispatch || !isMaster}
          className="w-full"
        >
          Modus überspringen
        </Button>
      </Card>
    )
  }

  const myTeamAnswer = myTeamId ? live.teamAnswers[myTeamId] : null

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-mode-ladder',
                isMaster ? 'text-xs' : 'text-[10px]',
              )}
            >
              Alles oder Nichts
            </div>
            <div
              className={cn(
                'mt-1 font-mono text-white',
                isMaster ? 'text-2xl md:text-3xl' : 'text-sm',
              )}
            >
              Stufe {live.currentIndex + 1} / {live.totalQuestions}
            </div>
          </div>
          {/* Stake-Prominenz: die Punkte, um die es geht, sind hier
              die Herz-Info und dürfen groß werden. */}
          <div
            className={cn(
              'rounded-xl border border-mode-ladder/40 bg-mode-ladder/[0.08] text-mode-ladder',
              isMaster ? 'px-5 py-3' : 'px-3 py-1.5',
            )}
          >
            <div
              className={cn(
                'uppercase tracking-[0.32em]',
                isMaster ? 'text-[10px]' : 'text-[9px]',
              )}
            >
              Einsatz
            </div>
            <div
              className={cn(
                'font-mono font-bold tabular-nums',
                isMaster ? 'text-4xl md:text-5xl' : 'text-xl',
              )}
            >
              {currentStake}
            </div>
          </div>
          <div className={cn('flex flex-wrap gap-2', isMaster ? 'w-full pt-1' : 'ml-auto')}>
            {state.round.teams.map((team) => (
              <TeamScoreChip key={team.id} team={team} score={live.scores[team.id] ?? 0} isMaster={isMaster} />
            ))}
          </div>
        </div>
      </Card>

      {/* Frage */}
      <QuestionCard
        text={question.question}
        isMaster={isMaster}
        revealedTone={
          live.phase === 'revealed'
            ? myTeamAnswer === live.correctRenderedIndex
              ? 'correct'
              : 'neutral'
            : null
        }
      />

      {/* Optionen */}
      <OptionsGrid
        options={live.shuffledOptions}
        correctIdx={live.phase === 'revealed' ? live.correctRenderedIndex : null}
        selectedIdxByTeam={
          live.phase === 'revealed'
            ? Object.entries(live.teamAnswers).reduce<Record<number, string[]>>(
                (acc, [teamId, idx]) => {
                  if (idx === null || idx === undefined) return acc
                  acc[idx] = acc[idx] ? [...acc[idx], teamId] : [teamId]
                  return acc
                },
                {},
              )
            : {}
        }
        teams={state.round.teams}
        onSelect={(idx) => {
          if (!myTeamId || live.phase !== 'answering') return
          send({ type: 'LADDER_SET_ANSWER', teamId: myTeamId, renderedIndex: idx })
        }}
        canClick={
          live.phase === 'answering' && !isMaster && !!myTeamId && canDispatch
        }
        isMaster={isMaster}
        highlightMyPick={myTeamAnswer ?? undefined}
      />

      {/* Team-Antworten-Panel */}
      <TeamAnswersPanel
        teams={state.round.teams}
        teamAnswers={Object.fromEntries(
          Object.entries(live.teamAnswers).map(([k, v]) => [k, v === null || v === undefined ? null : `Antwort ${String.fromCharCode(65 + (v as number))}`]),
        )}
        isMaster={isMaster}
      />

      {/* Footer */}
      {live.phase === 'answering' ? (
        <Button
          size="lg"
          variant={allAnswered ? 'primary' : 'secondary'}
          onClick={() => send({ type: 'LADDER_REVEAL' })}
          disabled={!canDispatch || !isMaster}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {allAnswered ? 'Auflösen' : 'Auflösen (jederzeit)'}
        </Button>
      ) : (
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'LADDER_NEXT' })}
          disabled={!canDispatch || !isMaster}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {live.currentIndex + 1 >= live.totalQuestions ? 'Runde beenden' : 'Nächste Stufe'}
        </Button>
      )}
    </div>
  )
}

// ---------- Sprinter (Team-Sprint mit Timer) -------------------------------

function SprinterRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: SprinterLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const myPlayer = playerId ? state.round.players.find((p) => p.id === playerId) : null
  const isMaster = !myPlayer
  const activeTeam = state.round.teams.find((t) => t.id === live.activeTeamId)
  const isMyTeam = !!myPlayer && myPlayer.teamId === live.activeTeamId
  const canAnswer =
    live.phase === 'answering' && (isMaster || isMyTeam) && canDispatch

  // Countdown-Timer im Frontend. Master oder der aktive Player dispatcht
  // SPRINTER_TIME_UP wenn die Zeit vorbei ist.
  const remainingSecs = useSprintCountdown(
    live.phase === 'answering' ? live.sprintStartedAt : null,
    live.sprintDurationSeconds,
    () => {
      if (isMaster || isMyTeam) send({ type: 'SPRINTER_TIME_UP' })
    },
  )

  if (live.phase === 'between-teams') {
    const nextTeam =
      live.currentTeamIndex + 1 < live.teamOrder.length
        ? state.round.teams.find((t) => t.id === live.teamOrder[live.currentTeamIndex + 1])
        : null
    return (
      <div className="space-y-3">
        <Card className={cn('space-y-3 text-center', isMaster ? 'p-8' : 'p-5')}>
          <div className="text-[10px] uppercase tracking-[0.32em] text-brand-orange-soft">
            Sprinter · Zwischenstand
          </div>
          <div className={cn('space-y-2', isMaster ? 'text-base' : 'text-sm')}>
            {state.round.teams.map((team) => (
              <div key={team.id} className="flex items-center justify-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: getTeamColorHex(team.color) }}
                />
                <span className="text-white/80">{team.name}</span>
                <span
                  className={cn(
                    'font-mono font-bold text-white',
                    isMaster ? 'text-3xl' : 'text-xl',
                  )}
                >
                  {live.scores[team.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'SPRINTER_START_NEXT_TEAM' })}
          disabled={!canDispatch || !isMaster}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {nextTeam ? `${nextTeam.name} startet` : 'Runde beenden'}
        </Button>
      </div>
    )
  }

  const question = live.activeQuestion
  if (!question) return <LoadingCard label="Lade Frage …" />

  return (
    <div className="space-y-3">
      {/* Header: aktives Team + Timer */}
      <Card
        className={cn(
          'flex flex-wrap items-center gap-3',
          isMaster ? 'p-5' : 'p-3',
        )}
      >
        <div className="min-w-0">
          <div
            className={cn(
              'uppercase tracking-[0.32em] text-brand-orange-soft',
              isMaster ? 'text-xs' : 'text-[10px]',
            )}
          >
            Sprinter
          </div>
          {activeTeam && (
            <div
              className={cn(
                'mt-1 flex items-center gap-3',
                isMaster ? 'text-2xl md:text-3xl' : 'text-sm',
              )}
            >
              <span
                className={cn('rounded-full', isMaster ? 'h-4 w-4' : 'h-2.5 w-2.5')}
                style={{
                  background: getTeamColorHex(activeTeam.color),
                  boxShadow: isMaster ? `0 0 12px ${getTeamColorHex(activeTeam.color)}` : undefined,
                }}
              />
              <span className="font-semibold text-white">{activeTeam.name} sprintet</span>
            </div>
          )}
        </div>
        <div className="ml-auto text-right">
          <div
            className={cn(
              'uppercase tracking-[0.22em] text-ink-muted',
              isMaster ? 'text-xs' : 'text-[10px]',
            )}
          >
            Verbleibend
          </div>
          <div
            className={cn(
              'font-mono font-bold tabular-nums',
              isMaster ? 'text-6xl' : 'text-3xl',
              remainingSecs <= 10 ? 'text-wrong animate-timer-pulse' : 'text-white',
            )}
          >
            {Math.max(0, Math.floor(remainingSecs))}s
          </div>
        </div>
        <div className="w-full">
          <div className="flex flex-wrap gap-2">
            {state.round.teams.map((team) => (
              <TeamScoreChip
                key={team.id}
                team={team}
                score={live.scores[team.id] ?? 0}
                isMaster={isMaster}
              />
            ))}
          </div>
        </div>
      </Card>

      <QuestionCard text={question.question} isMaster={isMaster} revealedTone={null} />

      <OptionsGrid
        options={live.shuffledOptions}
        correctIdx={null}
        selectedIdxByTeam={{}}
        teams={state.round.teams}
        onSelect={(idx) => send({ type: 'SPRINTER_ANSWER', renderedIndex: idx })}
        canClick={canAnswer}
        isMaster={isMaster}
      />

      <div className={cn('grid gap-2', isMaster && 'md:grid-cols-2')}>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => send({ type: 'SPRINTER_SKIP' })}
          disabled={!canAnswer}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          Weiter / Skip
        </Button>
        {isMaster && (
          <Button
            size="lg"
            variant="ghost"
            onClick={() => send({ type: 'SPRINTER_TIME_UP' })}
            disabled={!canDispatch || !isMaster}
            className="w-full h-16 text-lg"
          >
            Timer stoppen
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Kleiner Hook für Frontend-Countdown im Sprinter/Experts. Läuft nur wenn
 * `startedAt` gesetzt ist; ruft `onExpire` genau einmal beim ersten
 * Unterschreiten von 0.
 */
function useSprintCountdown(
  startedAt: number | null,
  duration: number,
  onExpire: () => void,
): number {
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef(false)
  useEffect(() => {
    fired.current = false
  }, [startedAt])
  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [startedAt])
  if (startedAt === null) return duration
  const elapsed = (now - startedAt) / 1000
  const remaining = duration - elapsed
  if (remaining <= 0 && !fired.current) {
    fired.current = true
    onExpire()
  }
  return remaining
}

// ---------- Elimination (Last-Player-Standing) -----------------------------

function EliminationRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: EliminationLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const myPlayer = playerId ? state.round.players.find((p) => p.id === playerId) : null
  const isMaster = !myPlayer
  const activePlayer = state.round.players.find((p) => p.id === live.activePlayerId)
  const activeTeam = activePlayer ? state.round.teams.find((t) => t.id === activePlayer.teamId) : null
  const isMyTurn = !!myPlayer && myPlayer.id === live.activePlayerId
  const canAnswer = live.phase === 'answering' && (isMaster || isMyTurn) && canDispatch

  if (live.phase === 'empty' || live.phase === 'finished') {
    const winner = live.winnerTeamId
      ? state.round.teams.find((t) => t.id === live.winnerTeamId)
      : null
    return (
      <div className="space-y-3">
        <Card className={cn('space-y-3 text-center', isMaster ? 'p-8' : 'p-5')}>
          <div className="text-[10px] uppercase tracking-[0.32em] text-brand-pink-soft">
            Elimination
          </div>
          <div className={cn('font-bold text-white', isMaster ? 'text-4xl' : 'text-2xl')}>
            {winner ? `${winner.name} gewinnt!` : 'Runde beendet'}
          </div>
          <div className={cn('space-y-1', isMaster ? 'text-base' : 'text-sm')}>
            {state.round.teams.map((team) => (
              <div key={team.id} className="flex items-center justify-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: getTeamColorHex(team.color) }} />
                <span className="text-white/80">{team.name}</span>
                <span className={cn('font-mono font-bold text-white', isMaster ? 'text-2xl' : 'text-lg')}>
                  {live.scores[team.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'FINISH_MODE' })}
          disabled={!canDispatch || !isMaster}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          Runde abschließen
        </Button>
      </div>
    )
  }

  const question = live.activeQuestion
  if (!question) return <LoadingCard label="Lade Frage …" />

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-brand-pink-soft',
                isMaster ? 'text-xs' : 'text-[10px]',
              )}
            >
              Elimination
            </div>
            <div
              className={cn(
                'mt-1 font-mono text-white',
                isMaster ? 'text-2xl md:text-3xl' : 'text-sm',
              )}
            >
              {live.playerOrder.length - live.eliminatedIds.length} von{' '}
              {live.playerOrder.length} noch dabei
            </div>
          </div>
          <div className={cn('flex flex-wrap gap-2', isMaster ? 'w-full pt-1' : 'ml-auto')}>
            {state.round.teams.map((team) => (
              <TeamScoreChip key={team.id} team={team} score={live.scores[team.id] ?? 0} isMaster={isMaster} />
            ))}
          </div>
        </div>
      </Card>

      {/* Aktiver Player */}
      {activePlayer && (
        <Card
          className={cn(
            'flex items-center gap-3 border-brand-pink/40 bg-brand-pink/[0.06]',
            isMaster ? 'p-5' : 'p-3',
          )}
        >
          <span
            className={cn(
              'flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white',
              isMaster ? 'h-14 w-14 text-xl' : 'h-9 w-9 text-sm',
            )}
            style={{ background: activeTeam ? getTeamColorHex(activeTeam.color) : 'rgba(255,255,255,0.1)' }}
          >
            {(activePlayer.name || 'N').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className={cn('font-semibold text-white', isMaster ? 'text-2xl' : 'text-base')}>
              {activePlayer.name || 'Namenlos'}
            </div>
            <div className={cn('text-white/70', isMaster ? 'text-base' : 'text-xs')}>
              {activeTeam?.name}
            </div>
          </div>
        </Card>
      )}

      <QuestionCard
        text={question.question}
        isMaster={isMaster}
        revealedTone={
          live.phase === 'revealed'
            ? live.lastOutcome === 'correct'
              ? 'correct'
              : 'wrong'
            : null
        }
      />

      <OptionsGrid
        options={live.shuffledOptions}
        correctIdx={live.phase === 'revealed' ? live.correctRenderedIndex : null}
        selectedIdxByTeam={{}}
        teams={state.round.teams}
        onSelect={(idx) => send({ type: 'ELIM_ANSWER', renderedIndex: idx })}
        canClick={canAnswer}
        isMaster={isMaster}
      />

      {/* Ausgeschieden-Liste */}
      {live.eliminatedIds.length > 0 && (
        <Card className={cn('space-y-1', isMaster ? 'p-4' : 'p-3')}>
          <div
            className={cn(
              'uppercase tracking-[0.32em] text-ink-muted',
              isMaster ? 'text-xs' : 'text-[10px]',
            )}
          >
            Ausgeschieden ({live.eliminatedIds.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {live.eliminatedIds.map((id) => {
              const p = state.round?.players.find((x) => x.id === id)
              return (
                <Badge key={id} tone="muted">
                  {p?.name || 'Namenlos'}
                </Badge>
              )
            })}
          </div>
        </Card>
      )}

      {live.phase === 'revealed' && (
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'ELIM_NEXT' })}
          disabled={!canDispatch || !isMaster}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          Nächster Spieler
        </Button>
      )}
    </div>
  )
}

// ---------- Category Board (5×4-Punktebrett) -------------------------------

function BoardRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: CategoryBoardLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const myPlayer = playerId ? state.round.players.find((p) => p.id === playerId) : null
  const isMaster = !myPlayer
  const cellPickerTeam = live.cellPickerTeamId
    ? state.round.teams.find((t) => t.id === live.cellPickerTeamId)
    : null
  const buzzingTeam = live.buzzingTeamId
    ? state.round.teams.find((t) => t.id === live.buzzingTeamId)
    : null
  const isMyPick = !!myPlayer && myPlayer.teamId === live.cellPickerTeamId
  const isMyBuzz = !!myPlayer && myPlayer.teamId === live.buzzingTeamId
  const isMySteal =
    !!myPlayer && !!live.buzzingTeamId && myPlayer.teamId !== live.buzzingTeamId

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-mode-board',
                isMaster ? 'text-xs' : 'text-[10px]',
              )}
            >
              Punktejagd
            </div>
            {cellPickerTeam && live.phase === 'pick-cell' && (
              <div className={cn('mt-1', isMaster ? 'text-2xl md:text-3xl' : 'text-sm')}>
                <span className="font-semibold text-white">{cellPickerTeam.name}</span>{' '}
                <span className="text-white/60">wählt eine Zelle</span>
              </div>
            )}
          </div>
          <div className={cn('flex flex-wrap gap-2', isMaster ? 'w-full pt-1' : 'ml-auto')}>
            {state.round.teams.map((team) => (
              <TeamScoreChip key={team.id} team={team} score={live.scores[team.id] ?? 0} isMaster={isMaster} />
            ))}
          </div>
        </div>
      </Card>

      {/* Board-Grid */}
      <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
        <div
          className={cn('grid', isMaster ? 'gap-2' : 'gap-1')}
          style={{ gridTemplateColumns: `repeat(${live.boardTopics.length}, minmax(0, 1fr))` }}
        >
          {live.boardTopics.map((topic) => {
            const topicDef = TOPICS_BY_ID[topic]
            return (
              <div
                key={topic}
                className={cn(
                  'text-center uppercase tracking-wider text-white/70',
                  isMaster ? 'text-sm md:text-base pb-1' : 'text-[10px]',
                )}
              >
                <div aria-hidden className={isMaster ? 'text-4xl md:text-5xl leading-none' : 'text-lg'}>
                  {topicDef?.emoji}
                </div>
                <div className={cn('truncate', isMaster && 'mt-1')}>{topicDef?.label}</div>
              </div>
            )
          })}
          {live.cellValues.map((value, rowIdx) => (
            <BoardRow
              key={rowIdx}
              boardTopics={live.boardTopics}
              rowIdx={rowIdx}
              value={value}
              playedCells={live.playedCells}
              activeCell={live.activeCell}
              canPick={live.phase === 'pick-cell' && canDispatch && (isMaster || isMyPick)}
              onPick={(topic, valueIndex) => send({ type: 'BOARD_PICK_CELL', topic, valueIndex })}
              isMaster={isMaster}
            />
          ))}
        </div>
      </Card>

      {/* Frage + Buzzer + Answer */}
      {live.phase !== 'pick-cell' && live.activeQuestion && (
        <>
          <QuestionCard
            text={live.activeQuestion.question}
            isMaster={isMaster}
            revealedTone={
              live.phase === 'revealed'
                ? live.primaryOutcome === 'correct' || live.stealOutcome === 'correct'
                  ? 'correct'
                  : 'wrong'
                : null
            }
          />

          {live.phase === 'awaiting-buzz' && (
            <Card className={cn('space-y-2', isMaster ? 'p-5' : 'p-4')}>
              <div
                className={cn(
                  'uppercase tracking-[0.32em] text-ink-muted',
                  isMaster ? 'text-xs' : 'text-[10px]',
                )}
              >
                Wer buzzert zuerst?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {state.round.teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => send({ type: 'BOARD_BUZZER', teamId: team.id })}
                    disabled={!canDispatch}
                    className={cn(
                      'rounded-xl border py-3 text-center font-bold text-white transition-all disabled:opacity-40',
                      isMaster ? 'h-20 text-2xl md:text-3xl' : 'h-14 text-base',
                    )}
                    style={{
                      borderColor: getTeamColorHex(team.color),
                      background: `${getTeamColorHex(team.color)}22`,
                    }}
                  >
                    {team.name} buzzt
                  </button>
                ))}
              </div>
            </Card>
          )}

          {(live.phase === 'primary-answer' || live.phase === 'steal-answer') && (
            <OptionsGrid
              options={live.shuffledOptions}
              correctIdx={null}
              selectedIdxByTeam={{}}
              teams={state.round.teams}
              onSelect={(idx) => send({ type: 'BOARD_ANSWER', renderedIndex: idx })}
              canClick={
                canDispatch &&
                (isMaster ||
                  (live.phase === 'primary-answer' && isMyBuzz) ||
                  (live.phase === 'steal-answer' && isMySteal))
              }
              isMaster={isMaster}
            />
          )}

          {(live.phase === 'primary-answer' || live.phase === 'steal-answer') && buzzingTeam && (
            <p
              className={cn(
                'text-center text-ink-muted',
                isMaster ? 'text-base md:text-lg' : 'text-xs',
              )}
            >
              {live.phase === 'primary-answer'
                ? `${buzzingTeam.name} antwortet`
                : `Steal — Gegenteam von ${buzzingTeam.name} antwortet`}
            </p>
          )}

          {live.phase === 'revealed' && (
            <>
              <OptionsGrid
                options={live.shuffledOptions}
                correctIdx={live.correctRenderedIndex}
                selectedIdxByTeam={{}}
                teams={state.round.teams}
                onSelect={() => {}}
                canClick={false}
                isMaster={isMaster}
              />
              <Button
                size="lg"
                variant="primary"
                onClick={() => send({ type: 'BOARD_NEXT' })}
                disabled={!canDispatch || !isMaster}
                className={cn('w-full', isMaster && 'h-16 text-lg')}
              >
                {live.playedCells.length + 1 >= live.boardTopics.length * live.cellValues.length
                  ? 'Runde beenden'
                  : 'Nächste Zelle'}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function BoardRow({
  boardTopics,
  rowIdx,
  value,
  playedCells,
  activeCell,
  canPick,
  onPick,
  isMaster,
}: {
  boardTopics: Topic[]
  rowIdx: number
  value: number
  playedCells: Array<{ topic: Topic; valueIndex: number }>
  activeCell: { topic: Topic; valueIndex: number } | null
  canPick: boolean
  onPick: (topic: Topic, valueIndex: number) => void
  isMaster: boolean
}) {
  return (
    <>
      {boardTopics.map((topic) => {
        const isPlayed = playedCells.some((c) => c.topic === topic && c.valueIndex === rowIdx)
        const isActive = activeCell?.topic === topic && activeCell?.valueIndex === rowIdx
        return (
          <button
            key={topic}
            type="button"
            onClick={() => onPick(topic, rowIdx)}
            disabled={isPlayed || !canPick}
            className={cn(
              'rounded-md border text-center font-mono font-bold tabular-nums transition-all',
              isMaster ? 'py-5 text-3xl md:text-4xl' : 'py-2 text-sm',
              isActive
                ? 'border-mode-board bg-mode-board/25 text-mode-board'
                : isPlayed
                  ? 'border-white/5 bg-white/[0.02] text-white/20'
                  : canPick
                    ? 'border-mode-board/40 bg-mode-board/[0.08] text-mode-board hover:border-mode-board/70 hover:bg-mode-board/15'
                    : 'border-white/10 bg-white/[0.03] text-white/50',
            )}
          >
            {isPlayed ? '×' : value}
          </button>
        )
      })}
    </>
  )
}

// ---------- Duel 1v1 -------------------------------------------------------

function DuelRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: DuelLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const myPlayer = playerId ? state.round.players.find((p) => p.id === playerId) : null
  const isMaster = !myPlayer
  const buzzingTeam = live.buzzingTeamId
    ? state.round.teams.find((t) => t.id === live.buzzingTeamId)
    : null
  const isDuelingTeam = !!myPlayer && live.duelingTeamIds.includes(myPlayer.teamId ?? '')
  const isMyBuzz = !!myPlayer && myPlayer.teamId === live.buzzingTeamId
  const isMySteal =
    !!myPlayer && isDuelingTeam && myPlayer.teamId !== live.buzzingTeamId

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-mode-duel',
                isMaster ? 'text-xs' : 'text-[10px]',
              )}
            >
              Duell 1:1
            </div>
            <div
              className={cn(
                'mt-1 font-mono text-white',
                isMaster ? 'text-2xl md:text-3xl' : 'text-sm',
              )}
            >
              Duell {live.currentIndex + 1} / {live.totalDuels}
            </div>
          </div>
          <div className={cn('flex flex-wrap gap-2', isMaster ? 'w-full pt-1' : 'ml-auto')}>
            {state.round.teams.map((team) => (
              <TeamScoreChip key={team.id} team={team} score={live.scores[team.id] ?? 0} isMaster={isMaster} />
            ))}
          </div>
        </div>
      </Card>

      {/* Duelierende Teams */}
      <Card className={cn('space-y-2', isMaster ? 'p-5' : 'p-3')}>
        <div
          className={cn(
            'uppercase tracking-[0.32em] text-ink-muted',
            isMaster ? 'text-xs' : 'text-[10px]',
          )}
        >
          Duellierende Teams
        </div>
        <div className="grid grid-cols-2 gap-2">
          {live.duelingTeamIds.map((teamId) => {
            const team = state.round?.teams.find((t) => t.id === teamId)
            const chosen = live.duelPlayers[teamId]
            const chosenPlayer = chosen ? state.round?.players.find((p) => p.id === chosen) : null
            const teamPlayers = state.round?.players.filter((p) => p.teamId === teamId) ?? []
            return (
              <div
                key={teamId}
                className={cn('rounded-lg border p-2', isMaster && 'p-4')}
                style={{
                  borderColor: team ? `${getTeamColorHex(team.color)}66` : undefined,
                  background: team ? `${getTeamColorHex(team.color)}0d` : undefined,
                }}
              >
                <div
                  className={cn(
                    'font-semibold text-white',
                    isMaster ? 'text-xl md:text-2xl' : 'text-sm',
                  )}
                >
                  {team?.name}
                </div>
                {live.phase === 'setup-duel' ? (
                  <div className={cn('mt-2 space-y-1', isMaster && 'space-y-1.5')}>
                    {teamPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          send({ type: 'DUEL_SET_PLAYER', teamId, playerId: p.id })
                        }
                        disabled={!canDispatch}
                        className={cn(
                          'w-full rounded text-left transition-all disabled:opacity-40',
                          isMaster ? 'px-3 py-2 text-base md:text-lg' : 'px-2 py-1 text-xs',
                          chosen === p.id
                            ? 'bg-white/15 text-white'
                            : 'bg-white/[0.03] text-white/70 hover:bg-white/10',
                        )}
                      >
                        {chosen === p.id && '✓ '}
                        {p.name || 'Namenlos'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'mt-2 text-white/85',
                      isMaster ? 'text-lg md:text-xl font-semibold' : 'text-xs',
                    )}
                  >
                    {chosenPlayer?.name || '—'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {live.phase === 'setup-duel' && (
        <p
          className={cn(
            'text-center text-ink-muted',
            isMaster ? 'text-base md:text-lg' : 'text-xs',
          )}
        >
          Beide Teams wählen ihre Vertreter — dann startet der Buzzer.
        </p>
      )}

      {/* Frage + Buzzer + Answer analog Board */}
      {live.phase !== 'setup-duel' && live.activeQuestion && (
        <>
          <QuestionCard
            text={live.activeQuestion.question}
            isMaster={isMaster}
            revealedTone={
              live.phase === 'revealed'
                ? live.primaryOutcome === 'correct' || live.stealOutcome === 'correct'
                  ? 'correct'
                  : 'wrong'
                : null
            }
          />

          {live.phase === 'awaiting-buzz' && (
            <Card className={cn('space-y-2', isMaster ? 'p-5' : 'p-4')}>
              <div
                className={cn(
                  'uppercase tracking-[0.32em] text-ink-muted',
                  isMaster ? 'text-xs' : 'text-[10px]',
                )}
              >
                Buzzer!
              </div>
              <div className="grid grid-cols-2 gap-2">
                {live.duelingTeamIds.map((teamId) => {
                  const team = state.round?.teams.find((t) => t.id === teamId)
                  if (!team) return null
                  return (
                    <button
                      key={teamId}
                      type="button"
                      onClick={() => send({ type: 'DUEL_BUZZER', teamId })}
                      disabled={!canDispatch}
                      className={cn(
                        'rounded-xl border py-3 text-center font-bold text-white transition-all disabled:opacity-40',
                        isMaster ? 'h-20 text-2xl md:text-3xl' : 'h-14 text-base',
                      )}
                      style={{
                        borderColor: getTeamColorHex(team.color),
                        background: `${getTeamColorHex(team.color)}22`,
                      }}
                    >
                      {team.name} buzzt
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          {(live.phase === 'primary-answer' || live.phase === 'steal-answer') && (
            <OptionsGrid
              options={live.shuffledOptions}
              correctIdx={null}
              selectedIdxByTeam={{}}
              teams={state.round.teams}
              onSelect={(idx) => send({ type: 'DUEL_ANSWER', renderedIndex: idx })}
              canClick={
                canDispatch &&
                (isMaster ||
                  (live.phase === 'primary-answer' && isMyBuzz) ||
                  (live.phase === 'steal-answer' && isMySteal))
              }
              isMaster={isMaster}
            />
          )}

          {(live.phase === 'primary-answer' || live.phase === 'steal-answer') && buzzingTeam && (
            <p
              className={cn(
                'text-center text-ink-muted',
                isMaster ? 'text-base md:text-lg' : 'text-xs',
              )}
            >
              {live.phase === 'primary-answer'
                ? `${buzzingTeam.name} antwortet`
                : `Steal — Gegenteam antwortet`}
            </p>
          )}

          {live.phase === 'revealed' && (
            <>
              <OptionsGrid
                options={live.shuffledOptions}
                correctIdx={live.correctRenderedIndex}
                selectedIdxByTeam={{}}
                teams={state.round.teams}
                onSelect={() => {}}
                canClick={false}
                isMaster={isMaster}
              />
              <Button
                size="lg"
                variant="primary"
                onClick={() => send({ type: 'DUEL_NEXT' })}
                disabled={!canDispatch || !isMaster}
                className={cn('w-full', isMaster && 'h-16 text-lg')}
              >
                {live.currentIndex + 1 >= live.totalDuels ? 'Duelle beenden' : 'Nächstes Duell'}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ---------- Experts (Fachrunde mit Timer) ----------------------------------

function ExpertsRoomView({
  state,
  live,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  live: ExpertsLive
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const myPlayer = playerId ? state.round.players.find((p) => p.id === playerId) : null
  const isMaster = !myPlayer
  const activePlayer = state.round.players.find((p) => p.id === live.activePlayerId)
  const activeTeam = activePlayer ? state.round.teams.find((t) => t.id === activePlayer.teamId) : null
  const isMyTurn = !!myPlayer && myPlayer.id === live.activePlayerId
  const isOpponent = !!myPlayer && !isMyTurn && myPlayer.teamId !== activePlayer?.teamId

  const remainingSecs = useSprintCountdown(
    live.phase === 'primary' ? live.soloStartedAt : null,
    live.soloDurationSeconds,
    () => {
      if (isMaster || isMyTurn) send({ type: 'EXPERTS_MARK_PRIMARY', outcome: 'timeout' })
    },
  )

  if (live.phase === 'empty') {
    return (
      <Card className="space-y-2 p-6 text-center">
        <div className="text-lg text-white/80">Keine spielbaren Fachrunden.</div>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'FINISH_MODE' })}
          disabled={!canDispatch || !isMaster}
          className="w-full"
        >
          Modus überspringen
        </Button>
      </Card>
    )
  }

  if (live.phase === 'setup-experts') {
    const allChosen = Object.values(live.expertise).every((v) => v !== null)
    return (
      <div className="space-y-3">
        <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
          <div
            className={cn(
              'uppercase tracking-[0.32em] text-mode-experts',
              isMaster ? 'text-xs' : 'text-[10px]',
            )}
          >
            Fachrunde · Setup
          </div>
          <div
            className={cn(
              'mt-1 text-white',
              isMaster ? 'text-2xl md:text-3xl font-semibold' : 'text-sm',
            )}
          >
            Jeder Spieler wählt ein Fachgebiet
          </div>
        </Card>
        <div className="space-y-2">
          {live.playerOrder.map((id) => {
            const player = state.round?.players.find((p) => p.id === id)
            if (!player) return null
            const chosen = live.expertise[id]
            const isMe = player.id === playerId
            const canEdit = canDispatch && (isMaster || isMe)
            return (
              <Card key={id} className={cn('space-y-2', isMaster ? 'p-5' : 'p-3')}>
                <div
                  className={cn(
                    'font-semibold text-white',
                    isMaster ? 'text-xl md:text-2xl' : 'text-sm',
                  )}
                >
                  {player.name || 'Namenlos'}
                  {isMe && (
                    <span
                      className={cn(
                        'ml-2 text-brand-purple-soft uppercase tracking-wider',
                        isMaster ? 'text-xs' : 'text-[10px]',
                      )}
                    >
                      du
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    'grid gap-1.5',
                    isMaster ? 'grid-cols-6 gap-2' : 'grid-cols-4 gap-1 sm:grid-cols-6',
                  )}
                >
                  {TOPICS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => send({ type: 'EXPERTS_SET_EXPERTISE', playerId: id, topic: t.id })}
                      disabled={!canEdit}
                      title={t.label}
                      className={cn(
                        'rounded-lg border transition-all disabled:opacity-40',
                        isMaster ? 'py-3 text-3xl md:text-4xl' : 'py-1 text-[10px]',
                        chosen === t.id
                          ? 'border-mode-experts/60 bg-mode-experts/15 text-mode-experts'
                          : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-mode-experts/40 hover:bg-mode-experts/[0.08]',
                      )}
                    >
                      <span aria-hidden>{t.emoji}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'EXPERTS_START_ROUND' })}
          disabled={!canDispatch || !allChosen}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {allChosen ? 'Runde starten' : 'Warte auf alle Fachgebiete'}
        </Button>
      </div>
    )
  }

  // primary / steal-answer / revealed
  const question = live.activeQuestion
  const topicId = activePlayer ? live.expertise[activePlayer.id] : null
  const topicDef = topicId ? TOPICS_BY_ID[topicId] : null

  return (
    <div className="space-y-3">
      <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-mode-experts',
                isMaster ? 'text-xs' : 'text-[10px]',
              )}
            >
              Fachrunde
            </div>
            <div
              className={cn(
                'mt-1 font-mono text-white',
                isMaster ? 'text-2xl md:text-3xl' : 'text-sm',
              )}
            >
              Zug {live.currentIndex + 1} / {live.playerOrder.length}
            </div>
          </div>
          {live.phase === 'primary' && (
            <div className="ml-auto text-right">
              <div
                className={cn(
                  'uppercase tracking-[0.22em] text-ink-muted',
                  isMaster ? 'text-xs' : 'text-[10px]',
                )}
              >
                Timer
              </div>
              <div
                className={cn(
                  'font-mono font-bold tabular-nums',
                  isMaster ? 'text-5xl md:text-6xl' : 'text-2xl',
                  remainingSecs <= 5 ? 'text-wrong animate-timer-pulse' : 'text-white',
                )}
              >
                {Math.max(0, Math.floor(remainingSecs))}s
              </div>
            </div>
          )}
          <div className="w-full flex flex-wrap gap-2">
            {state.round.teams.map((team) => (
              <TeamScoreChip key={team.id} team={team} score={live.scores[team.id] ?? 0} isMaster={isMaster} />
            ))}
          </div>
        </div>
      </Card>

      {activePlayer && (
        <Card
          className={cn(
            'flex items-center gap-3 border-mode-experts/40 bg-mode-experts/[0.06]',
            isMaster ? 'p-5' : 'p-3',
          )}
        >
          <span
            className={cn(
              'flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white',
              isMaster ? 'h-14 w-14 text-xl' : 'h-9 w-9 text-sm',
            )}
            style={{ background: activeTeam ? getTeamColorHex(activeTeam.color) : 'rgba(255,255,255,0.1)' }}
          >
            {(activePlayer.name || 'N').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className={cn('font-semibold text-white', isMaster ? 'text-xl md:text-2xl' : 'text-base')}>
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

      {question && (
        <QuestionCard
          text={question.question}
          isMaster={isMaster}
          revealedTone={
            live.phase === 'revealed'
              ? live.primaryOutcome === 'correct'
                ? 'correct'
                : 'wrong'
              : null
          }
        />
      )}

      {live.phase === 'primary' && (
        <Card className={cn('space-y-3', isMaster ? 'p-5' : 'p-4')}>
          <div
            className={cn(
              'uppercase tracking-[0.32em] text-ink-muted',
              isMaster ? 'text-xs' : 'text-[10px]',
            )}
          >
            Solo-Antwort (frei) · Master markiert
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => send({ type: 'EXPERTS_MARK_PRIMARY', outcome: 'correct' })}
              disabled={!canDispatch || !isMaster}
              className={cn(
                'flex items-center justify-center rounded-xl border font-bold uppercase tracking-wider transition-all disabled:opacity-40 border-correct/60 bg-correct/15 text-correct',
                isMaster ? 'h-20 text-2xl' : 'h-14 text-lg',
              )}
            >
              Richtig
            </button>
            <button
              type="button"
              onClick={() => send({ type: 'EXPERTS_MARK_PRIMARY', outcome: 'wrong' })}
              disabled={!canDispatch || !isMaster}
              className={cn(
                'flex items-center justify-center rounded-xl border font-bold uppercase tracking-wider transition-all disabled:opacity-40 border-wrong/60 bg-wrong/15 text-wrong',
                isMaster ? 'h-20 text-2xl' : 'h-14 text-lg',
              )}
            >
              Falsch
            </button>
          </div>
        </Card>
      )}

      {live.phase === 'steal-answer' && (
        <>
          <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-brand-orange-soft',
                isMaster ? 'text-xs' : 'text-[10px]',
              )}
            >
              Steal — Gegenteam ist dran
            </div>
          </Card>
          <OptionsGrid
            options={live.shuffledOptions}
            correctIdx={null}
            selectedIdxByTeam={{}}
            teams={state.round.teams}
            onSelect={(idx) => send({ type: 'EXPERTS_STEAL_ANSWER', renderedIndex: idx })}
            canClick={canDispatch && (isMaster || isOpponent)}
            isMaster={isMaster}
          />
        </>
      )}

      {live.phase === 'revealed' && (
        <>
          <OptionsGrid
            options={live.shuffledOptions}
            correctIdx={live.correctRenderedIndex}
            selectedIdxByTeam={{}}
            teams={state.round.teams}
            onSelect={() => {}}
            canClick={false}
            isMaster={isMaster}
          />
          <Button
            size="lg"
            variant="primary"
            onClick={() => send({ type: 'EXPERTS_NEXT' })}
            disabled={!canDispatch || !isMaster}
            className={cn('w-full', isMaster && 'h-16 text-lg')}
          >
            {live.currentIndex + 1 >= live.playerOrder.length ? 'Runde beenden' : 'Nächster Experte'}
          </Button>
        </>
      )}
    </div>
  )
}

// ---------- Shared Sub-Building-Blocks -------------------------------------

/**
 * Wiederverwendbare Frage-Card: einheitliches Styling für alle Modi mit MC.
 * `revealedTone` färbt den Rand: 'correct' → grün, 'wrong' → rot, null → neutral.
 */
function QuestionCard({
  text,
  isMaster,
  revealedTone,
}: {
  text: string
  isMaster: boolean
  revealedTone: 'correct' | 'wrong' | 'neutral' | null
}) {
  // `key` an revealedTone koppelt die Component-Instanz an den Tone-Wechsel:
  // sobald sich `correct` / `wrong` ändert, wird der Card neu gemountet und
  // die CSS-Animation läuft frisch. Ohne key würde ein Wiederholungs-Reveal
  // die Animation nicht neu triggern.
  return (
    <Card
      key={revealedTone ?? 'neutral'}
      className={cn(
        'space-y-3',
        isMaster ? 'p-8 md:p-12' : 'p-4',
        revealedTone === 'correct' && 'border-correct/40 bg-correct/[0.06] animate-reveal-correct',
        revealedTone === 'wrong' && 'border-wrong/40 bg-wrong/[0.06] animate-reveal-wrong',
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
        {text}
      </div>
    </Card>
  )
}

/**
 * Wiederverwendbare MC-Optionen-Grid. Zeigt richtige Antwort bei
 * `correctIdx` gesetzt, und Team-Auswahlen bei `selectedIdxByTeam`.
 */
function OptionsGrid({
  options,
  correctIdx,
  selectedIdxByTeam,
  teams,
  onSelect,
  canClick,
  isMaster,
  highlightMyPick,
}: {
  options: string[]
  correctIdx: number | null
  selectedIdxByTeam: Record<number, string[]>
  teams: Array<{ id: string; color: import('@quizapp/shared').TeamColor; name: string }>
  onSelect: (idx: number) => void
  canClick: boolean
  isMaster: boolean
  highlightMyPick?: number
}) {
  return (
    <div className={cn('space-y-2', isMaster && 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0')}>
      {options.map((option, idx) => {
        const isCorrect = correctIdx !== null && idx === correctIdx
        const wrongPicks = selectedIdxByTeam[idx]?.filter(() => idx !== correctIdx) ?? []
        const isMine = highlightMyPick === idx
        return (
          <button
            key={idx}
            type="button"
            onClick={() => canClick && onSelect(idx)}
            disabled={!canClick}
            className={cn(
              'flex w-full items-center rounded-xl border text-left transition-all disabled:cursor-default disabled:opacity-100',
              isMaster ? 'gap-4 px-5 py-4' : 'gap-3 px-4 py-3',
              isCorrect
                ? 'border-correct/60 bg-correct/15 text-correct'
                : wrongPicks.length > 0
                  ? 'border-wrong/60 bg-wrong/15 text-wrong'
                  : isMine
                    ? 'border-brand-purple/60 bg-brand-purple/15 text-brand-purple-soft'
                    : canClick
                      ? 'border-brand-purple/40 bg-white/[0.04] text-white hover:border-brand-purple/70 hover:bg-brand-purple/10'
                      : 'border-white/10 bg-white/[0.02] text-white/70',
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full bg-white/10 font-mono font-bold',
                isMaster ? 'h-11 w-11 text-lg' : 'h-8 w-8 text-sm',
                isCorrect && 'bg-correct/25',
                wrongPicks.length > 0 && !isCorrect && 'bg-wrong/25',
              )}
            >
              {String.fromCharCode(65 + idx)}
            </span>
            <span className={cn('flex-1', isMaster ? 'text-lg md:text-xl' : 'text-sm md:text-base')}>
              {option}
            </span>
            {selectedIdxByTeam[idx] && selectedIdxByTeam[idx].length > 0 && (
              <span className="flex gap-1">
                {selectedIdxByTeam[idx].map((teamId) => {
                  const team = teams.find((t) => t.id === teamId)
                  if (!team) return null
                  return (
                    <span
                      key={teamId}
                      className="h-2 w-2 rounded-full"
                      style={{ background: getTeamColorHex(team.color) }}
                    />
                  )
                })}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Trackt Änderungen an `score` und meldet für ~1.4s den positiven Delta.
 * Wird für die `+N`-Toast-Animation am TeamScoreChip verwendet. Negative
 * Deltas werden bewusst ignoriert — im Party-Kontext ist ein Punkt-Abzug
 * eher selten und würde sonst schnell irritieren.
 */
function useScoreDelta(score: number): number | null {
  const previousRef = useRef(score)
  const [delta, setDelta] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = score
    if (score > previous) {
      const diff = score - previous
      setDelta(diff)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setDelta(null), 1400)
    }
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [score])

  return delta
}

/** Team-Score-Chip: Farbdot + Name + Punkte, mit `+N`-Toast bei Punktzuwachs. */
function TeamScoreChip({
  team,
  score,
  isMaster,
}: {
  team: { id: string; color: import('@quizapp/shared').TeamColor; name: string }
  score: number
  isMaster: boolean
}) {
  const delta = useScoreDelta(score)
  return (
    <div
      className={cn(
        'relative flex items-center gap-1.5 rounded-lg bg-white/[0.04]',
        isMaster ? 'px-3 py-2' : 'px-2 py-1',
      )}
    >
      <span
        className={cn('rounded-full', isMaster ? 'h-3 w-3' : 'h-2 w-2')}
        style={{ background: getTeamColorHex(team.color) }}
      />
      <span className={cn('text-white/80', isMaster ? 'text-sm' : 'text-xs')}>{team.name}</span>
      <span
        className={cn(
          'font-mono font-bold text-white tabular-nums',
          isMaster ? 'text-2xl' : 'text-sm',
        )}
      >
        {score}
      </span>
      {delta !== null && delta > 0 && (
        <span
          key={delta}
          className={cn(
            'pointer-events-none absolute left-1/2 -top-3 rounded-full bg-correct/25 font-mono font-bold text-correct animate-score-pop',
            isMaster ? 'px-2.5 py-0.5 text-base' : 'px-1.5 py-[1px] text-[11px]',
          )}
          aria-hidden
        >
          +{delta}
        </span>
      )}
    </div>
  )
}

/** Team-Antworten-Übersicht (String-basiert). */
function TeamAnswersPanel({
  teams,
  teamAnswers,
  isMaster,
}: {
  teams: Array<{ id: string; color: import('@quizapp/shared').TeamColor; name: string }>
  teamAnswers: Record<string, string | null>
  isMaster: boolean
}) {
  return (
    <Card className={cn('space-y-2', isMaster ? 'p-5' : 'p-3')}>
      <div className={cn('uppercase tracking-[0.32em] text-ink-muted', isMaster ? 'text-xs' : 'text-[10px]')}>
        Team-Antworten
      </div>
      <div className={cn('grid gap-1.5', isMaster ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2')}>
        {teams.map((team) => {
          const ans = teamAnswers[team.id]
          return (
            <div
              key={team.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03]',
                isMaster ? 'px-3 py-3 text-base' : 'px-2 py-1.5 text-sm',
              )}
            >
              <span className={cn('rounded-full', isMaster ? 'h-3 w-3' : 'h-2 w-2')} style={{ background: getTeamColorHex(team.color) }} />
              <span className="flex-1 text-white/85">{team.name}</span>
              <span className={cn('font-mono font-bold', isMaster ? 'text-lg' : 'text-xs', ans ? 'text-white' : 'text-white/40')}>
                {ans ?? '…'}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
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
  role,
  canDispatch,
  send,
}: {
  state: GameState
  role: 'player' | 'master'
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  // "Nochmal" ist eine Show-Entscheidung — nur der Master darf das für alle
  // triggern, sonst könnte ein Player mitten im Endstand die Runde neu starten.
  const isMaster = role === 'master'
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

      {isMaster ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            leading={<RefreshCw className="h-4 w-4" />}
            onClick={() => send({ type: 'RESTART_MATCH' })}
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
      ) : (
        <Card className="p-3 text-center text-xs text-ink-muted">
          Warte auf den Master — er entscheidet, ob eine neue Runde startet.
        </Card>
      )}
    </div>
  )
}
