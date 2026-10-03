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
  Crown,
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
import type { GameModeId, Player, Topic } from '@quizapp/shared'
import {
  answeringTeamId,
  MODES,
  MODES_BY_ID,
  TOPICS_ALPHABETICAL,
  TOPICS_BY_ID,
  getTeamColorHex,
} from '@quizapp/shared'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Card } from '@/components/Card'
import { AvatarBadge } from '@/components/AvatarBadge'
import { LobbySteps, ModeTile, PlayerLine, ShowPanel, StickyCta, TeamCard } from '@/components/show/LobbyBlocks'
import { BuzzerButton, ShowAnswers, ShowQuestion, ShowStatus, ShowTimer } from '@/components/show/ShowBlocks'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { PlayerInterestsPanel } from '@/components/PlayerInterestsPanel'
import { ConfettiBurst } from '@/components/ConfettiBurst'
import { ModeTransitionSplash } from '@/components/ModeTransitionSplash'
import { ConnectionToast } from '@/components/ConnectionToast'
import { PlayerTeamMatesPanel } from '@/components/PlayerTeamMatesPanel'
import { HostActionBar } from '@/components/HostActionBar'
import { findMatchWinner, WinnerHero } from '@/components/WinnerHero'
import { useRoomSync } from '@/hooks/useRoomSync'
import { useDeviceProfileSync } from '@/hooks/useDeviceProfileSync'
import { useSoundEnabled } from '@/hooks/useSoundEnabled'
import { playSound } from '@/lib/audio'
import { haptic } from '@/lib/haptics'
import { useWakeLock } from '@/hooks/useWakeLock'
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
  // URL-Parsing für Rolle & Bühnen-Modus. Legacy: alte Bookmarks/URLs mit
  // `role=master` werden als "Host + reine Bühne" interpretiert.
  const rawRole = searchParams.get('role') ?? 'player'
  const legacyMaster = rawRole === 'master'
  const requestedRole: 'player' | 'host' =
    rawRole === 'host' || legacyMaster ? 'host' : 'player'
  const requestedStageOnly =
    searchParams.get('stageOnly') === '1' || legacyMaster

  const room = useRoomSync({
    wsUrl,
    roomCode,
    playerName,
    role: requestedRole,
    stageOnly: requestedStageOnly,
    playerId: identity.playerId ?? undefined,
    enabled: !!wsUrl && !!roomCode && !!playerName,
  })

  // Effektive Rolle & Bühnen-Modus: vom Server bestätigt (im JOINED
  // beantwortet). Solange wir noch nicht verbunden sind, verwenden wir die
  // angefragten Werte als Vorschau — sonst würde die UI zwischen Player-
  // und Host-Optik hin- und herflackern beim Reconnect.
  const role: 'player' | 'host' = room.role ?? requestedRole
  const stageOnly: boolean = room.stageOnly ?? requestedStageOnly
  const isHost = role === 'host'

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

  // Team-Farb-Präsenz: sobald der eigene Player einem Team beigetreten ist,
  // ziehen wir seine Team-Farbe als dünnen Balken über den Content. Gilt für
  // alle, die im Roster stehen — also normale Player UND mitspielende Hosts.
  // Nur Stage-Only-Bühnen haben keinen eigenen Player-Eintrag.
  const myPlayer =
    !stageOnly && room.playerId && room.state?.round
      ? room.state.round.players.find((p) => p.id === room.playerId) ?? null
      : null
  const myTeam = myPlayer
    ? room.state?.round?.teams.find((t) => t.id === myPlayer.teamId) ?? null
    : null
  const myTeamColor = myTeam ? getTeamColorHex(myTeam.color) : null

  // Bildschirm im Raum wach halten — 20-s-Timer ohne Berührung sonst = Display aus.
  useWakeLock(room.status === 'joined' || room.status === 'reconnecting')

  // Geräte-Profil: Avatar/Titel übernehmen, eigene Antworten + Abende zählen.
  useDeviceProfileSync({ state: room.state ?? null, myPlayer, roomCode, canDispatch, send })

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
      haptic('correct')
      return // ein Sound pro Snapshot reicht.
    }
    // 2. Reveal ohne Punktzuwachs — falsche Antwort.
    if (snapshot.phase === 'revealed' && prev.phase !== 'revealed') {
      playSound('wrong')
      haptic('wrong')
      return
    }
    // 3. Buzzer klick.
    if (
      ((snapshot.phase === 'primary-answer' || snapshot.phase === 'steal-answer') &&
        prev.phase === 'awaiting-buzz') ||
      (snapshot.phase === 'rebound-answer' && prev.phase === 'rebound-buzz')
    ) {
      playSound('buzz')
      haptic('buzz')
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
          stageOnly ? 'max-w-6xl' : 'max-w-3xl',
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

        {/* Header-Variante nach Bühnen-Modus + Phase:
             - Stage + setup/lobby → Hero mit QR (Onboarding-Phase)
             - Stage + playing/scoreboard → kompakter Header (Content dominiert)
             - Player oder mitspielender Host → immer compact-Streifen */}
        {stageOnly &&
        (room.state?.phase === 'setup' || room.state?.phase === 'lobby') ? (
          <MasterHero
            roomCode={roomCode}
            playerCount={room.state?.round?.players.length ?? 0}
            onCopyCode={copyCode}
          />
        ) : currentPhase === 'playing' ? (
          // Während der Fragen: kein Room-Code — voller Fokus auf Frage und Antworten.
          !stageOnly && <PlayerInGameStrip teamName={myTeam?.name ?? null} teamColor={myTeamColor} playerName={playerName} />
        ) : stageOnly ? (
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
                <div className="text-xs uppercase tracking-[0.32em] text-ink-muted">
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
                <div className="text-xs uppercase tracking-[0.32em] text-ink-muted">
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


        {/* Teammates-Streifen: für alle mit Team im Playing (Player + mitspielender Host). */}
        {!stageOnly &&
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
            stageOnly={stageOnly}
            playerId={room.playerId}
            canDispatch={canDispatch}
            send={send}
          />
        ) : room.status === 'connecting' || room.status === 'joining' ? (
          <LoadingCard label="Verbinde …" />
        ) : (
          <LoadingCard label="Warte auf Server …" />
        )}

        {/* Host-Steuerung fest unten im Daumenbereich (mitspielender Host). */}
        {isHost &&
          !stageOnly &&
          currentPhase === 'playing' &&
          room.state && (
            <div className="sticky bottom-0 z-30 -mx-4 bg-gradient-to-t from-navy-900 via-navy-900/95 to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 md:-mx-6 md:px-6">
              <HostActionBar state={room.state} canDispatch={canDispatch} send={send} />
            </div>
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
          <div className="text-xs uppercase tracking-[0.32em] text-brand-purple-soft">
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
          <div className="text-xs uppercase tracking-[0.22em] text-white/40">
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
/** Schmaler Identitäts-Streifen für Spieler während der Fragen (ohne Room-Code). */
function PlayerInGameStrip({
  teamName,
  teamColor,
  playerName,
}: {
  teamName: string | null
  teamColor: string | null | undefined
  playerName: string
}) {
  return (
    <div className="flex items-center justify-end gap-2 px-1 text-sm font-semibold text-white">
      {teamColor && (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: teamColor, boxShadow: `0 0 8px ${teamColor}` }}
          aria-hidden
        />
      )}
      <span className="text-ink-muted">{teamName ?? 'Player'}</span>
      <span>· {playerName}</span>
    </div>
  )
}

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
        <div className="text-xs uppercase tracking-[0.32em] text-brand-purple-soft">
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
  stageOnly,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  role: 'player' | 'host'
  stageOnly: boolean
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const isHost = role === 'host'
  switch (state.phase) {
    case 'setup':
      return (
        <SetupPhaseView
          state={state}
          isHost={isHost}
          canDispatch={canDispatch}
          send={send}
        />
      )
    case 'lobby':
      return (
        <LobbyPhaseView
          state={state}
          role={role}
          stageOnly={stageOnly}
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
            isHost={isHost}
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
            isHost={isHost}
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
            isHost={isHost}
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
            isHost={isHost}
            canDispatch={canDispatch}
            send={send}
          />
        )
      }
      if (live?.kind === 'points-ladder') {
        return <LadderRoomView state={state} live={live} playerId={playerId} isHost={isHost} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'sprinter') {
        return <SprinterRoomView state={state} live={live} playerId={playerId} isHost={isHost} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'elimination') {
        return <EliminationRoomView state={state} live={live} playerId={playerId} isHost={isHost} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'category-board') {
        return <BoardRoomView state={state} live={live} playerId={playerId} isHost={isHost} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'duel-1v1') {
        return <DuelRoomView state={state} live={live} playerId={playerId} isHost={isHost} canDispatch={canDispatch} send={send} />
      }
      if (live?.kind === 'experts') {
        return <ExpertsRoomView state={state} live={live} playerId={playerId} isHost={isHost} canDispatch={canDispatch} send={send} />
      }
      return <PlayingPhaseView state={state} canDispatch={canDispatch} send={send} />
    }
    case 'scoreboard':
      return (
        <ScoreboardPhaseView
          state={state}
          isHost={isHost}
          canDispatch={canDispatch}
          send={send}
        />
      )
  }
}

function SetupPhaseView({
  state,
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  isHost: boolean
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const readyModes = MODES.filter((m) => m.status === 'ready')
  const selectedCount = state.draft.selectedModes.length
  const minutes = readyModes
    .filter((m) => state.draft.selectedModes.includes(m.id))
    .reduce((sum, m) => sum + m.estimatedMinutes, 0)
  // Setup ist Show-Runner-Territorium — Player warten, bis der Host die Lobby öffnet.
  if (!isHost) {
    return (
      <div className="space-y-4">
        <LobbySteps current={0} />
        <ShowPanel accent eyebrow="Gleich geht’s los" title="Der Host wählt die Spielmodi">
          <p className="text-sm text-ink-muted">
            Sobald die Lobby offen ist, wählst du dein Team und deine Interessen. Bis dahin kannst du
            dein Profil anpassen.
          </p>
          <Link to="/profil" className="inline-flex text-sm font-semibold text-brand-cyan-soft hover:text-brand-cyan">
            Avatar & Profil bearbeiten →
          </Link>
          <div className="flex justify-center gap-1.5 pt-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-pulse rounded-full bg-brand-purple"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </ShowPanel>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <LobbySteps current={0} />
      <ShowPanel
        eyebrow="Schritt 1"
        title="Welche Modi spielt ihr?"
        action={<span className="text-xs text-ink-muted">{selectedCount} gewählt · ~{minutes} min</span>}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {readyModes.map((mode) => (
            <ModeTile
              key={mode.id}
              mode={mode}
              selected={state.draft.selectedModes.includes(mode.id)}
              onToggle={() => send({ type: 'TOGGLE_MODE', modeId: mode.id })}
              disabled={!canDispatch}
            />
          ))}
        </div>
      </ShowPanel>

      <ShowPanel
        eyebrow="Teams"
        title={`${state.draft.teams.length} Teams`}
        action={
          <Button size="md" variant="secondary" onClick={() => send({ type: 'ADD_TEAM' })} disabled={!canDispatch}>
            + Team
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {state.draft.teams.map((team) => {
            const hex = getTeamColorHex(team.color)
            return (
              <span
                key={team.id}
                className="inline-flex items-center gap-2 rounded-full border-2 bg-navy-900/70 py-1 pl-3 pr-1"
                style={{ borderColor: `${hex}99` }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: hex }} />
                <span className="text-sm font-semibold text-white">{team.name}</span>
                <button
                  type="button"
                  aria-label={`${team.name} entfernen`}
                  onClick={() => send({ type: 'REMOVE_TEAM', teamId: team.id })}
                  disabled={!canDispatch || state.draft.teams.length <= 2}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      </ShowPanel>

      <StickyCta hint={!canDispatch ? 'Verbindung wird aufgebaut …' : selectedCount === 0 ? 'Wähle mindestens einen Modus' : undefined}>
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'GO_TO_LOBBY' })}
          disabled={!canDispatch || selectedCount === 0}
          className="w-full"
        >
          Lobby öffnen
        </Button>
      </StickyCta>
    </div>
  )
}

function LobbyPhaseView({
  state,
  role,
  stageOnly,
  playerId,
  canDispatch,
  send,
}: {
  state: GameState
  role: 'player' | 'host'
  stageOnly: boolean
  playerId: string | null
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  if (!state.round) return <LoadingCard label="Lade Runde …" />
  const round = state.round
  const isHost = role === 'host'
  const pool = round.players.filter((p) => p.teamId === null)
  const readyToStart = round.players.length > 0 && pool.length === 0
  const myPlayer =
    !stageOnly && playerId ? round.players.find((p) => p.id === playerId) ?? null : null
  const modeNames = round.gameModes.map((id) => MODES_BY_ID[id]?.name).filter(Boolean)

  return (
    <div className="space-y-4">
      <LobbySteps current={readyToStart ? 2 : 1} />

      <ShowPanel eyebrow={round.name} title={`${round.players.length} im Raum`}>
        <div className="flex flex-wrap gap-1.5">
          {modeNames.map((name) => (
            <span key={name} className="rounded-full border border-brand-purple/40 bg-brand-purple/10 px-2.5 py-0.5 text-xs text-brand-purple-soft">
              {name}
            </span>
          ))}
        </div>
      </ShowPanel>

      {myPlayer && (
        <>
          <PlayerSelfCard state={state} me={myPlayer} canDispatch={canDispatch} send={send} />
          <PlayerInterestsPanel me={myPlayer} send={send} disabled={!canDispatch} defaultCollapsed={false} />
        </>
      )}

      <ShowPanel eyebrow="Teams" title={readyToStart ? 'Alle sind eingeteilt' : 'Wählt eure Teams'}>
        <div className="grid gap-2 sm:grid-cols-2">
          {round.teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              members={round.players.filter((p) => p.teamId === team.id)}
              myPlayerId={playerId}
              onJoin={
                myPlayer
                  ? () => send({ type: 'MOVE_PLAYER_TO_TEAM', playerId: myPlayer.id, teamId: team.id })
                  : undefined
              }
              joinDisabled={!canDispatch}
            />
          ))}
        </div>
        {pool.length > 0 && (
          <div className="rounded-2xl border-2 border-dashed border-white/15 p-3">
            <div className="eyebrow mb-2 text-ink-muted">Noch ohne Team ({pool.length})</div>
            <ul className="space-y-1.5">
              {pool.map((p) => (
                <PlayerLine key={p.id} player={p} isMe={p.id === playerId} />
              ))}
            </ul>
          </div>
        )}
        {isHost && round.players.length > 1 && (
          <Button variant="ghost" size="md" onClick={() => send({ type: 'SHUFFLE_PLAYERS' })} disabled={!canDispatch} className="w-full">
            Teams zufällig auslosen
          </Button>
        )}
      </ShowPanel>

      {isHost && <LobbyModesPanel selected={round.gameModes} canDispatch={canDispatch} send={send} />}

      <StickyCta
        hint={
          !readyToStart
            ? `${pool.length} ${pool.length === 1 ? 'Spieler wählt' : 'Spieler wählen'} noch ein Team`
            : !isHost
              ? 'Alle bereit — der Host startet'
              : stageOnly
                ? 'Alle bereit — starte die Runde auf der Bühne'
                : undefined
        }
      >
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'START_PLAYING' })}
          disabled={!canDispatch || !readyToStart || !isHost}
          className="w-full"
        >
          {isHost ? 'Runde starten' : readyToStart ? 'Wartet auf den Host' : 'Wartet auf Team-Auswahl'}
        </Button>
      </StickyCta>
    </div>
  )
}

/** Host darf in der Lobby noch Modi anpassen — ohne Roster-Reset. */
function LobbyModesPanel({
  selected,
  canDispatch,
  send,
}: {
  selected: readonly GameModeId[]
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const readyModes = useMemo(() => MODES.filter((m) => m.status === 'ready'), [])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const toggle = (id: GameModeId) => {
    if (!canDispatch) return
    const next = selectedSet.has(id) ? selected.filter((m) => m !== id) : [...selected, id]
    if (next.length === 0) return // mindestens ein Modus
    send({ type: 'SET_ROUND_MODES', modes: next })
  }
  return (
    <ShowPanel eyebrow="Host" title={`Modi (${selected.length})`}>
      <div className="grid gap-2 sm:grid-cols-2">
        {readyModes.map((mode) => (
          <ModeTile
            key={mode.id}
            mode={mode}
            compact
            selected={selectedSet.has(mode.id)}
            onToggle={() => toggle(mode.id)}
            disabled={!canDispatch}
          />
        ))}
      </div>
    </ShowPanel>
  )
}

/**
 * Karte für den eigenen Player: Avatar, Name, Titel, aktuelles Team.
 * Team-Wechsel läuft über „Beitreten" an den Team-Karten, Avatar über /profil.
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
  const team = state.round.teams.find((t) => t.id === me.teamId) ?? null
  const hex = team ? getTeamColorHex(team.color) : undefined
  return (
    <ShowPanel accent eyebrow="Das bist du">
      <div className="flex items-center gap-3">
        <AvatarBadge avatar={me.avatar} size="lg" teamHex={hex} name={me.name} className="flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <label className="block">
            <span className="sr-only">Anzeige-Name</span>
            <input
              value={me.name}
              onChange={(e) => send({ type: 'SET_PLAYER_NAME', playerId: me.id, name: e.target.value })}
              disabled={!canDispatch}
              className="w-full rounded-xl bg-white/10 px-3 py-2 text-lg font-semibold text-white placeholder-white/30 disabled:opacity-50"
              placeholder="Dein Name"
              maxLength={40}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {me.avatar.title && (
              <span className="rounded-full bg-amber-300/15 px-2 py-0.5 font-semibold text-amber-200">{me.avatar.title}</span>
            )}
            {team ? (
              <span className="font-semibold" style={{ color: hex }}>
                {team.name}
              </span>
            ) : (
              <span className="text-wrong">Noch kein Team — unten beitreten</span>
            )}
            <Link to="/profil" className="ml-auto text-brand-cyan-soft hover:text-brand-cyan">
              Avatar ändern
            </Link>
          </div>
        </div>
      </div>
    </ShowPanel>
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: CategoryDuelLive
  playerId: string | null
  isHost: boolean
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
            <div className="text-xs uppercase tracking-[0.32em] text-brand-purple-soft">
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
                · {live.usedTopics.length} / {live.battleTopics.length}
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
          isHost={isHost}
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
        {live.battleTopics.map((topicId) => {
          const topic = TOPICS_BY_ID[topicId]
          if (!topic) return null
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
                  isMaster ? 'text-base md:text-lg' : 'text-xs',
                )}
              >
                {topic.label}
              </span>
              {isUsed && (
                <span
                  className={cn(
                    'uppercase tracking-wider text-white/40',
                    'text-xs',
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
      <QuestionCard
        text={question.question}
        isMaster={isMaster}
        revealedTone={null}
        eyebrow={topicDef ? `${topicDef.emoji} ${topicDef.label}` : null}
      />

      <ShowAnswers
        options={live.shuffledOptions}
        correctIdx={null}
        onSelect={(idx) => send({ type: 'CD_SELECT_ANSWER', renderedIndex: idx })}
        canClick={canPlay}
        stage={isMaster}
      />

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
  isHost,
  canDispatch,
  send,
}: {
  live: CategoryDuelLive
  isMaster: boolean
  isHost: boolean
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
      <QuestionCard
        text={question.question}
        isMaster={isMaster}
        revealedTone={wasCorrect ? 'correct' : 'wrong'}
        explanation={question.explanation}
        eyebrow={topicDef ? `${topicDef.emoji} ${topicDef.label}` : null}
      />

      <ShowAnswers
        options={live.shuffledOptions}
        correctIdx={correctIdx}
        myPick={selectedIdx ?? undefined}
        onSelect={() => {}}
        canClick={false}
        stage={isMaster}
      />

      <Button
        size="lg"
        variant="primary"
        onClick={() => send({ type: 'CD_NEXT_TURN' })}
        disabled={!canDispatch || !isHost}
        className={cn('w-full', isMaster && 'h-16 text-lg')}
      >
        {live.usedTopics.length >= live.battleTopics.length ? 'Runde beenden' : 'Nächste Runde'}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: SpotlightLive
  playerId: string | null
  isHost: boolean
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
          disabled={!canDispatch || !isHost}
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
            <div className="text-xs uppercase tracking-[0.32em] text-brand-pink-soft">
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
          <AvatarBadge
            avatar={activePlayer.avatar}
            size={isMaster ? 'xl' : 'lg'}
            teamHex={activeTeam ? getTeamColorHex(activeTeam.color) : undefined}
            name={activePlayer.name}
            className="flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'font-semibold text-white',
                isMaster ? 'text-2xl md:text-3xl' : 'text-base',
              )}
            >
              {activePlayer.name || 'Namenlos'}
              {activePlayer.avatar.title && (
                <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 align-middle text-xs font-semibold text-amber-200">
                  {activePlayer.avatar.title}
                </span>
              )}
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
        <QuestionCard
          text={question.question}
          isMaster={isMaster}
          revealedTone={
            live.phase === 'revealed' ? (live.primaryOutcome === 'correct' ? 'correct' : 'wrong') : null
          }
          explanation={question.explanation}
          eyebrow={topicDef ? `${topicDef.emoji} ${topicDef.label}` : null}
        />
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
          shuffledOptions={live.shuffledOptions}
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
            disabled={!canDispatch || !isHost}
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
  shuffledOptions,
  send,
}: {
  isMaster: boolean
  isMyTurn: boolean
  isTeamMate: boolean
  canDispatch: boolean
  playerName: string
  shuffledOptions: string[]
  send: (a: GameAction) => void
}) {
  // Alle sehen die Optionen, der aktive Spieler tippt; die Bühne kann
  // stellvertretend tippen oder eine mündliche Antwort bewerten.
  return (
    <div className="space-y-3">
      <ShowStatus tone={isMyTurn ? 'active' : 'neutral'} stage={isMaster}>
        {isMyTurn
          ? 'Du bist dran — tippe deine Antwort'
          : isTeamMate
            ? `${playerName} antwortet — kein Reinreden`
            : `${playerName} antwortet`}
      </ShowStatus>
      <ShowAnswers
        options={shuffledOptions}
        correctIdx={null}
        onSelect={(idx) => send({ type: 'SPOTLIGHT_PRIMARY_ANSWER', renderedIndex: idx })}
        canClick={canDispatch && (isMyTurn || isMaster)}
        stage={isMaster}
      />
      {isMaster && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => send({ type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'correct' })} disabled={!canDispatch}>
            Mündlich richtig
          </Button>
          <Button variant="secondary" onClick={() => send({ type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'wrong' })} disabled={!canDispatch}>
            Mündlich falsch
          </Button>
        </div>
      )}
    </div>
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
  return (
    <div className="space-y-3">
      <ShowStatus tone={isOpponent ? 'active' : 'warn'} stage={isMaster}>
        {isOpponent ? 'Steal! Ihr dürft antworten — halbe Punkte' : 'Falsch — das Gegenteam darf stealen'}
      </ShowStatus>
      <ShowAnswers
        options={shuffledOptions}
        correctIdx={null}
        onSelect={(idx) => send({ type: 'SPOTLIGHT_STEAL_ANSWER', renderedIndex: idx })}
        canClick={canDispatch && (isMaster || isOpponent)}
        stage={isMaster}
      />
    </div>
  )
}

function SpotlightRevealPanel({ isMaster, live }: { isMaster: boolean; live: SpotlightLive }) {
  const wrongPicks: Record<number, string[]> = {}
  if (live.primaryRenderedIndex != null && live.primaryRenderedIndex !== live.correctRenderedIndex) {
    wrongPicks[live.primaryRenderedIndex] = ['primary']
  }
  if (live.stealRenderedIndex != null && live.stealRenderedIndex !== live.correctRenderedIndex) {
    wrongPicks[live.stealRenderedIndex] = [...(wrongPicks[live.stealRenderedIndex] ?? []), 'steal']
  }
  return (
    <ShowAnswers
      options={live.shuffledOptions}
      correctIdx={live.correctRenderedIndex}
      picksByIndex={wrongPicks}
      onSelect={() => {}}
      canClick={false}
      stage={isMaster}
    />
  )
}

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
  isHost,
  canDispatch,
  send,
}: {
  live: AroundCornerLive
  playerId: string | null
  state: GameState
  isHost: boolean
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
          disabled={!canDispatch || !isHost}
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
          <div className="text-xs uppercase tracking-[0.32em] text-brand-cyan-soft">
            Klick!
          </div>
          <div className={cn('font-mono text-white', isMaster ? 'text-lg' : 'text-sm')}>
            Rätsel {live.currentIndex + 1} / {live.totalRiddles}
          </div>
        </div>
      </Card>

      {/* Frage */}
      <QuestionCard
        text={question.question}
        isMaster={isMaster}
        revealedTone={live.phase === 'revealed' ? 'correct' : null}
      />

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
          <div className="text-xs uppercase tracking-[0.32em] text-correct">
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
            disabled={!canDispatch || !isHost}
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
          disabled={!canDispatch || !isHost}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: FlashLive
  playerId: string | null
  isHost: boolean
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
            <div className="text-xs uppercase tracking-[0.32em] text-brand-cyan-soft">
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
        <QuestionCard
          text={question.question}
          isMaster={isMaster}
          revealedTone={live.phase === 'revealed' ? 'neutral' : null}
          explanation={question.explanation}
          eyebrow={live.phase === 'revealed' ? (question.correctAnswer ? 'Auflösung: Stimmt ✓' : 'Auflösung: Falsch ✗') : 'Wahr oder falsch?'}
        />
      ) : (
        <LoadingCard label="Keine Frage geladen." />
      )}

      {/* Wahr/Falsch-Buttons f\u00fcr Player-am-Zug. Master klickt nicht selbst. */}
      {live.phase === 'answering' && myTeamId && !isMaster && (
        <Card className="space-y-2 p-4">
          <div className="text-xs uppercase tracking-[0.32em] text-ink-muted">
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
            'text-xs',
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
          disabled={!canDispatch || !isHost}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {allTeamsAnswered ? 'Auflösen' : 'Auflösen (jederzeit)'}
        </Button>
      ) : (
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'FLASH_NEXT' })}
          disabled={!canDispatch || !isHost}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: PointsLadderLive
  playerId: string | null
  isHost: boolean
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
          disabled={!canDispatch || !isHost}
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
                'text-xs',
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
                'text-xs',
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
          explanation={question?.explanation}
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
          Object.entries(live.teamAnswers).map(([k, v]) => {
            if (v === null || v === undefined) return [k, null]
            // Vor der Auflösung nur „eingeloggt" zeigen — sonst schaut man beim Gegner ab.
            // Das eigene Team sieht seinen Buchstaben weiterhin.
            if (live.phase !== 'revealed' && k !== myTeamId) return [k, '✓ eingeloggt']
            return [k, `Antwort ${String.fromCharCode(65 + (v as number))}`]
          }),
        )}
        isMaster={isMaster}
      />

      {/* Footer */}
      {live.phase === 'answering' ? (
        <Button
          size="lg"
          variant={allAnswered ? 'primary' : 'secondary'}
          onClick={() => send({ type: 'LADDER_REVEAL' })}
          disabled={!canDispatch || !isHost}
          className={cn('w-full', isMaster && 'h-16 text-lg')}
        >
          {allAnswered ? 'Auflösen' : 'Auflösen (jederzeit)'}
        </Button>
      ) : (
        <Button
          size="lg"
          variant="primary"
          onClick={() => send({ type: 'LADDER_NEXT' })}
          disabled={!canDispatch || !isHost}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: SprinterLive
  playerId: string | null
  isHost: boolean
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
  const reboundTeam = live.reboundTeamId
    ? state.round.teams.find((t) => t.id === live.reboundTeamId) ?? null
    : null
  const isMyRebound = !!myPlayer && myPlayer.teamId === live.reboundTeamId
  const inRebound = live.phase === 'rebound-buzz' || live.phase === 'rebound-answer'

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
          <div className="text-xs uppercase tracking-[0.32em] text-brand-orange-soft">
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
          disabled={!canDispatch || !isHost}
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
              'text-xs',
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
        <div className="ml-auto">
          <ShowTimer
            stage={isMaster}
            paused={inRebound}
            critical={!inRebound && remainingSecs <= 10}
            seconds={
              inRebound && live.sprintStartedAt && live.reboundStartedAt
                ? live.sprintDurationSeconds - (live.reboundStartedAt - live.sprintStartedAt) / 1000
                : remainingSecs
            }
          />
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

      <QuestionCard
          explanation={question?.explanation} text={question.question} isMaster={isMaster} revealedTone={null} />

      {live.phase === 'rebound-buzz' && (
        <Card className={cn('space-y-2', isMaster ? 'p-5' : 'p-4')}>
          <div className={cn('uppercase tracking-[0.32em] text-wrong', 'text-xs')}>
            Falsch! Rebound — wer weiß es? Falsch = Minuspunkte
          </div>
          <div className={cn('grid gap-2', isMaster ? 'grid-cols-2' : 'grid-cols-1')}>
            {state.round.teams
              .filter((team) => team.id !== live.activeTeamId)
              // Spieler sehen nur den Buzzer ihres eigenen Teams.
              .filter((team) => isMaster || team.id === myPlayer?.teamId)
              .map((team) => (
                <BuzzerButton
                  key={team.id}
                  team={team}
                  onBuzz={() => send({ type: 'SPRINTER_REBOUND_BUZZ', teamId: team.id })}
                  disabled={!canDispatch}
                  stage={isMaster}
                />
              ))}
          </div>
          {(isMaster || isHost || isMyTeam) && (
            <Button
              size="md"
              variant="ghost"
              onClick={() => send({ type: 'SPRINTER_REBOUND_PASS' })}
              disabled={!canDispatch}
              className="w-full"
            >
              Keiner buzzt — weiter sprinten
            </Button>
          )}
        </Card>
      )}

      {live.phase === 'rebound-answer' && reboundTeam && (
        <p className={cn('text-center text-ink-muted', isMaster ? 'text-base md:text-lg' : 'text-xs')}>
          {reboundTeam.name} antwortet — richtig +{live.pointsPerCorrect}, falsch −{live.pointsPerCorrect}
        </p>
      )}

      <OptionsGrid
        options={live.shuffledOptions}
        correctIdx={null}
        selectedIdxByTeam={
          inRebound && live.wrongRenderedIndex != null && activeTeam
            ? { [live.wrongRenderedIndex]: [activeTeam.id] }
            : {}
        }
        teams={state.round.teams}
        onSelect={(idx) =>
          live.phase === 'rebound-answer'
            ? send({ type: 'SPRINTER_REBOUND_ANSWER', renderedIndex: idx })
            : send({ type: 'SPRINTER_ANSWER', renderedIndex: idx })
        }
        canClick={
          canAnswer ||
          (live.phase === 'rebound-answer' && canDispatch && (isMaster || isMyRebound))
        }
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
            disabled={!canDispatch || !isHost}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: EliminationLive
  playerId: string | null
  isHost: boolean
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
          <div className="text-xs uppercase tracking-[0.32em] text-brand-pink-soft">
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
          disabled={!canDispatch || !isHost}
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
                'text-xs',
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
          <AvatarBadge
            avatar={activePlayer.avatar}
            size={isMaster ? 'xl' : 'lg'}
            teamHex={activeTeam ? getTeamColorHex(activeTeam.color) : undefined}
            name={activePlayer.name}
            className="flex-shrink-0"
          />
          <div>
            <div className={cn('font-semibold text-white', isMaster ? 'text-2xl' : 'text-base')}>
              {activePlayer.name || 'Namenlos'}
              {activePlayer.avatar.title && (
                <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 align-middle text-xs font-semibold text-amber-200">
                  {activePlayer.avatar.title}
                </span>
              )}
            </div>
            <div className={cn('text-white/70', isMaster ? 'text-base' : 'text-xs')}>
              {activeTeam?.name}
            </div>
          </div>
        </Card>
      )}

      <QuestionCard
          explanation={question?.explanation}
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
              'text-xs',
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
          disabled={!canDispatch || !isHost}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: CategoryBoardLive
  playerId: string | null
  isHost: boolean
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
    !!myPlayer && live.phase === 'steal-answer' && answeringTeamId(state) === myPlayer.teamId

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-mode-board',
                'text-xs',
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
                  isMaster ? 'text-sm md:text-base pb-1' : 'text-xs',
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
          explanation={live.activeQuestion?.explanation}
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
                  'text-xs',
                )}
              >
                Wer buzzert zuerst?
              </div>
              <div className={cn('grid gap-2', isMaster ? 'grid-cols-2' : 'grid-cols-1')}>
                {state.round.teams
                  // Spieler sehen nur den Buzzer ihres eigenen Teams.
                  .filter((team) => isMaster || team.id === myPlayer?.teamId)
                  .map((team) => (
                  <BuzzerButton
                    key={team.id}
                    team={team}
                    onBuzz={() => send({ type: 'BOARD_BUZZER', teamId: team.id })}
                    disabled={!canDispatch}
                    stage={isMaster}
                  />
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
                disabled={!canDispatch || !isHost}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: DuelLive
  playerId: string | null
  isHost: boolean
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
                'text-xs',
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
            'text-xs',
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
          explanation={live.activeQuestion?.explanation}
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
                  'text-xs',
                )}
              >
                Buzzer!
              </div>
              <div className={cn('grid gap-2', isMaster ? 'grid-cols-2' : 'grid-cols-1')}>
                {live.duelingTeamIds
                  // Spieler sehen nur den Buzzer ihres eigenen Teams.
                  .filter((teamId) => isMaster || teamId === myPlayer?.teamId)
                  .map((teamId) => {
                  const team = state.round?.teams.find((t) => t.id === teamId)
                  if (!team) return null
                  return (
                    <BuzzerButton
                      key={teamId}
                      team={team}
                      onBuzz={() => send({ type: 'DUEL_BUZZER', teamId: teamId })}
                      disabled={!canDispatch}
                      stage={isMaster}
                    />
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
                disabled={!canDispatch || !isHost}
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
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  live: ExpertsLive
  playerId: string | null
  isHost: boolean
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
      // Mehrfach-Dispatch ist harmlos (Reducer prüft die Phase) — so feuert der
      // Timeout auch, wenn das Gerät des aktiven Spielers gerade weg ist.
      if (isMaster || isMyTurn || isHost) send({ type: 'EXPERTS_MARK_PRIMARY', outcome: 'timeout' })
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
          disabled={!canDispatch || !isHost}
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
              'text-xs',
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
                        'text-xs',
                      )}
                    >
                      du
                    </span>
                  )}
                </div>
                {canEdit ? (
                  <select
                    value={chosen ?? ''}
                    onChange={(e) =>
                      e.target.value &&
                      send({ type: 'EXPERTS_SET_EXPERTISE', playerId: id, topic: e.target.value as Topic })
                    }
                    aria-label={`Fachgebiet für ${player.name || 'Spieler'}`}
                    className={cn(
                      'w-full rounded-lg border border-white/15 bg-white/[0.04] text-white focus:border-mode-experts/60 focus:outline-none',
                      isMaster ? 'px-4 py-3 text-lg' : 'px-3 py-2.5 text-base',
                    )}
                  >
                    <option value="" disabled>
                      Fachgebiet wählen …
                    </option>
                    {TOPICS_ALPHABETICAL.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={cn('text-white/80', isMaster ? 'text-lg' : 'text-sm')}>
                    {chosen ? `${TOPICS_BY_ID[chosen].emoji} ${TOPICS_BY_ID[chosen].label}` : 'wählt noch …'}
                  </div>
                )}
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
                'text-xs',
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
              Frage {live.currentStep + 1} / {live.questionsPerPlayer} · {live.pointsPerCorrect} Punkte
            </div>
          </div>
          {live.phase === 'primary' && (
            <div className="ml-auto">
              <ShowTimer seconds={remainingSecs} stage={isMaster} />
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
          <AvatarBadge
            avatar={activePlayer.avatar}
            size={isMaster ? 'xl' : 'lg'}
            teamHex={activeTeam ? getTeamColorHex(activeTeam.color) : undefined}
            name={activePlayer.name}
            className="flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className={cn('font-semibold text-white', isMaster ? 'text-xl md:text-2xl' : 'text-base')}>
              {activePlayer.name || 'Namenlos'}
              {activePlayer.avatar.title && (
                <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 align-middle text-xs font-semibold text-amber-200">
                  {activePlayer.avatar.title}
                </span>
              )}
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
          explanation={question?.explanation}
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

      {live.phase === 'question-shown' && (
        <Card className={cn('space-y-3', isMaster ? 'p-5' : 'p-4')}>
          <div
            className={cn(
              'uppercase tracking-[0.32em] text-ink-muted',
              'text-xs',
            )}
          >
            {isMyTurn ? 'Lies die Frage — dann Antworten aufdecken' : `${activePlayer?.name ?? 'Experte'} liest die Frage`}
          </div>
          <Button
            size="lg"
            variant="primary"
            onClick={() => send({ type: 'EXPERTS_SHOW_OPTIONS' })}
            disabled={!canDispatch || !(isMyTurn || isMaster || isHost)}
            className={cn('w-full', isMaster && 'h-16 text-lg')}
          >
            Antworten anzeigen · {live.soloDurationSeconds}s
          </Button>
        </Card>
      )}

      {live.phase === 'primary' && (
        <>
          <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-ink-muted',
                'text-xs',
              )}
            >
              {isMyTurn ? 'Du bist dran — tippe deine Antwort' : `${activePlayer?.name ?? 'Experte'} antwortet`}
            </div>
          </Card>
          <OptionsGrid
            options={live.shuffledOptions}
            correctIdx={null}
            selectedIdxByTeam={{}}
            teams={state.round.teams}
            onSelect={(idx) => send({ type: 'EXPERTS_PRIMARY_ANSWER', renderedIndex: idx })}
            canClick={canDispatch && (isMyTurn || isMaster)}
            isMaster={isMaster}
          />
        </>
      )}

      {live.phase === 'steal-answer' && (
        <>
          <Card className={cn(isMaster ? 'p-5' : 'p-3')}>
            <div
              className={cn(
                'uppercase tracking-[0.32em] text-brand-orange-soft',
                'text-xs',
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
            highlightMyPick={live.primaryRenderedIndex ?? undefined}
          />
          <Button
            size="lg"
            variant="primary"
            onClick={() => send({ type: 'EXPERTS_NEXT' })}
            disabled={!canDispatch || !(isHost || isMaster)}
            className={cn('w-full', isMaster && 'h-16 text-lg')}
          >
            {live.currentIndex + 1 >= live.playerOrder.length * live.questionsPerPlayer
              ? 'Runde beenden'
              : 'Nächste Frage'}
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
  explanation,
  eyebrow,
}: {
  text: string
  isMaster: boolean
  revealedTone: 'correct' | 'wrong' | 'neutral' | null
  explanation?: string | null
  eyebrow?: string | null
}) {
  return (
    <ShowQuestion
      text={text}
      stage={isMaster}
      tone={revealedTone}
      explanation={explanation}
      eyebrow={eyebrow ?? undefined}
    />
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
  disabledIdx,
}: {
  options: string[]
  correctIdx: number | null
  selectedIdxByTeam: Record<number, string[]>
  teams: Array<{ id: string; color: import('@quizapp/shared').TeamColor; name: string }>
  onSelect: (idx: number) => void
  canClick: boolean
  isMaster: boolean
  highlightMyPick?: number
  disabledIdx?: number | null
}) {
  return (
    <ShowAnswers
      options={options}
      correctIdx={correctIdx}
      picksByIndex={selectedIdxByTeam}
      teams={teams}
      onSelect={onSelect}
      canClick={canClick}
      stage={isMaster}
      myPick={highlightMyPick}
      disabledIdx={disabledIdx}
    />
  )
}

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
  const hex = getTeamColorHex(team.color)
  return (
    <div
      className={cn(
        'relative flex items-center gap-2 rounded-full border-2 bg-navy-900/80',
        isMaster ? 'px-4 py-2' : 'px-3 py-1',
      )}
      style={{ borderColor: `${hex}99`, boxShadow: `0 0 18px -8px ${hex}` }}
    >
      <span
        className={cn('rounded-full', isMaster ? 'h-3 w-3' : 'h-2.5 w-2.5')}
        style={{ background: hex, boxShadow: `0 0 8px ${hex}` }}
      />
      <span className={cn('font-medium text-white/85', isMaster ? 'text-base' : 'text-sm')}>{team.name}</span>
      <span
        className={cn(
          'font-display font-extrabold text-white tabular-nums',
          isMaster ? 'text-2xl' : 'text-base',
        )}
      >
        {score}
      </span>
      {delta !== null && delta > 0 && (
        <span
          key={delta}
          className={cn(
            'pointer-events-none absolute left-1/2 -top-3 rounded-full bg-correct/25 font-mono font-bold text-correct animate-score-pop',
            isMaster ? 'px-2.5 py-0.5 text-base' : 'px-1.5 py-[1px] text-xs',
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
      <div className={cn('uppercase tracking-[0.32em] text-ink-muted', 'text-xs')}>
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
        <details className="rounded bg-black/40 p-2 text-xs text-white/80">
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

      <p className="text-center text-xs text-ink-muted">
        Die vollen Spiel-UIs kommen im nächsten Release. Bis dahin:
        Master-Screen zum Anzeigen, Player-Handys zum Dispatchen.
      </p>
    </div>
  )
}

function ScoreboardPhaseView({
  state,
  isHost,
  canDispatch,
  send,
}: {
  state: GameState
  isHost: boolean
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  // "Nochmal" und "Modi neu wählen" sind Show-Entscheidungen — nur der Host
  // darf das für alle triggern.
  const winner = state.round ? findMatchWinner(state.round.teams, state.matchPoints) : null
  const ranked = state.round
    ? [...state.round.teams].sort((a, b) => (state.matchPoints[b.id] ?? 0) - (state.matchPoints[a.id] ?? 0))
    : []
  return (
    <div className="space-y-3">
      <Card className="p-6">
        <WinnerHero winner={winner} players={state.round?.players ?? []} />
      </Card>
      <Card className="space-y-3 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          Endstand · Match-Punkte
        </div>
        <div className="space-y-2">
          {ranked.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
            >
              {winner?.id === team.id && (
                <Crown aria-hidden className="h-4 w-4 text-amber-300" fill="currentColor" />
              )}
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

      {isHost ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="primary"
              leading={<RefreshCw className="h-4 w-4" />}
              onClick={() => send({ type: 'RESTART_MATCH' })}
              disabled={!canDispatch}
              className="flex-1"
            >
              Nochmal — gleiche Modi
            </Button>
            <Button
              variant="secondary"
              onClick={() => send({ type: 'BACK_TO_SETUP' })}
              disabled={!canDispatch}
              className="flex-1"
            >
              Modi neu wählen
            </Button>
          </div>
          <Link to="/" className="block">
            <Button variant="ghost" className="w-full">
              Zur Startseite
            </Button>
          </Link>
        </div>
      ) : (
        <Card className="p-3 text-center text-xs text-ink-muted">
          Warte auf den Host — er entscheidet, ob eine neue Runde startet.
        </Card>
      )}
    </div>
  )
}
