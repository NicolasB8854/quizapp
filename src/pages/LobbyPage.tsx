/**
 * Lobby — dreistufiger Setup-Flow (Session S).
 *
 *  1. Roster  — Spieler erfassen (Name, Avatar, Interessen), noch ohne Team.
 *                Bekannte Profile aus der Bibliothek werden ebenfalls hier zugeladen.
 *  2. Assign  — Wartebereich (Pool) + Team-Slots. Zuordnung per Drag-and-Drop oder
 *                „Zufall!"-Button (Shuffle). Weiter erst, wenn kein Player mehr im Pool.
 *  3. Ready   — Team-Ready-Karten mit Toggle + Interessen-Preview + „Spiel starten".
 *
 * Der Fortschritt läuft über `state.lobbyStep`. Der Master kann per LOBBY_BACK
 * zurückspringen; per LOBBY_ADVANCE weiterschalten (mit Reducer-Guards).
 *
 * Room-Code-Kachel bleibt konstant sichtbar über allen Schritten — das ist
 * die visuelle Anker-Konstante für die Runde.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Play, Check, Gamepad2, Clock, Trophy,
  Sparkles, Plus, UserMinus, Users, Pencil, BookOpen, Shuffle,
  Camera, X as XIcon,
} from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { AvatarBadge } from '@/components/AvatarBadge'
import { useGame, type GameAction } from '@/context/GameContext'
import { MODES_BY_ID } from '@/data/modes'
import { TOPICS, TOPICS_BY_ID } from '@/data/topics'
import { AVATAR_COLORS } from '@/data/avatars'
import { downscaleImageToDataUrl } from '@/lib/image'
import { getTeamColorTokens } from '@/data/teams'
import type { Topic } from '@/types/question'
import type { Avatar, Player, RoundConfig, SkillLevel, Team } from '@/types/round'
import { computeInterestProfile } from '@/lib/interestProfile'
import {
  readPlayerLibrary,
  removeFromPlayerLibrary,
  type PlayerProfile,
} from '@/lib/playerLibrary'
import { cn } from '@/lib/classnames'

// MIME-Type für den Drag-and-Drop-Datenaustausch (nur Player-IDs, kein Payload).
const DND_PLAYER_MIME = 'application/x-quizapp-player'

export default function LobbyPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useGame()

  const [readyIds, setReadyIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (state.phase === 'setup')      navigate('/setup', { replace: true })
    if (state.phase === 'playing')    navigate('/game', { replace: true })
    if (state.phase === 'scoreboard') navigate('/scoreboard', { replace: true })
  }, [state.phase, navigate])

  const totalMinutes = useMemo(() => {
    if (!state.round) return 0
    return state.round.gameModes.reduce(
      (sum, id) => sum + (MODES_BY_ID[id]?.estimatedMinutes ?? 0),
      0,
    )
  }, [state.round])

  if (!state.round) return null

  const round = state.round
  const step = state.lobbyStep
  const poolCount = round.players.filter((p) => p.teamId === null).length
  const allAssigned = poolCount === 0
  const canAdvance = step === 'roster' || (step === 'assign' && allAssigned)

  // Ready-Check pro Spieler (Session T, gemäß Mockup) statt pro Team.
  // `readyIds` speichert Player-IDs; leere Menge = niemand bestätigt.
  const allReady = round.players.length > 0 &&
    round.players.every((p) => readyIds.has(p.id))
  const readyCount = round.players.filter((p) => readyIds.has(p.id)).length
  const totalPlayers = round.players.length

  const togglePlayerReady = (playerId: string) => {
    setReadyIds((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }
  const setAllReady = () => {
    setReadyIds(new Set(round.players.map((p) => p.id)))
  }

  return (
    <ScreenLayout
      variant="home"
      navActions={
        <Button
          variant="ghost"
          size="md"
          leading={<ArrowLeft className="h-4 w-4" />}
          onClick={() => {
            if (step === 'roster') {
              dispatch({ type: 'BACK_TO_SETUP' })
            } else {
              dispatch({ type: 'LOBBY_BACK' })
            }
          }}
        >
          {step === 'roster' ? 'Zurück zum Setup' : 'Ein Schritt zurück'}
        </Button>
      }
      headerMeta={
        step === 'roster'
          ? 'Lobby · Wer spielt mit'
          : step === 'assign'
          ? 'Lobby · Teams einteilen'
          : 'Lobby · Bereitmachen'
      }
    >
      <div className="mx-auto max-w-5xl pt-2 md:pt-6 pb-14 animate-titleIn">
        {/* Room-Code — Anker-Element für alle Schritte, aber im Ready-Screen groß, sonst kompakt. */}
        <RoomCodeHero
          code={round.roomCode}
          compact={step !== 'ready'}
        />

        {/* Schritt-Indikator */}
        <LobbyStepIndicator step={step} className="mt-6 md:mt-8" />

        {/* Content je nach Schritt */}
        {step === 'roster' && (
          <RosterSection round={round} dispatch={dispatch} />
        )}
        {step === 'assign' && (
          <AssignSection round={round} dispatch={dispatch} />
        )}
        {step === 'ready' && (
          <ReadySection
            round={round}
            readyIds={readyIds}
            togglePlayerReady={togglePlayerReady}
            setAllReady={setAllReady}
            totalMinutes={totalMinutes}
            onEditRound={() => dispatch({ type: 'BACK_TO_SETUP' })}
          />
        )}

        {/* Footer mit den Navigations-CTAs */}
        <div className="mt-10 md:mt-12">
          {step === 'ready' ? (
            <ReadyFooter
              readyCount={readyCount}
              totalPlayers={totalPlayers}
              allReady={allReady}
              onStart={() => {
                dispatch({ type: 'START_PLAYING' })
                navigate('/game')
              }}
            />
          ) : (
            <StepFooter
              step={step}
              canAdvance={canAdvance}
              poolCount={poolCount}
              onAdvance={() => dispatch({ type: 'LOBBY_ADVANCE' })}
              onBack={() =>
                step === 'roster'
                  ? dispatch({ type: 'BACK_TO_SETUP' })
                  : dispatch({ type: 'LOBBY_BACK' })
              }
            />
          )}
        </div>
      </div>
    </ScreenLayout>
  )
}

// ---------- Room-Code-Hero (kompakt/expanded) --------------------------------

interface RoomCodeHeroProps {
  code: string
  compact: boolean
}

function RoomCodeHero({ code, compact }: RoomCodeHeroProps) {
  if (compact) {
    // Kompakte Version: Pill-artige Zeile oben — Show bleibt, spart Platz für Content.
    return (
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-brand-purple/50 bg-navy-900/70 px-4 py-1.5 animate-breathe">
          <div className="text-[10px] uppercase tracking-[0.22em] text-brand-purple-soft">
            Room Code
          </div>
          <div className="font-display font-extrabold text-white text-xl md:text-2xl tabular-nums text-neon-purple tracking-wide">
            {code}
          </div>
        </div>
      </div>
    )
  }

  // Expanded: großer Show-Anker (wie bisher).
  return (
    <div className="flex justify-center">
      <div
        className={cn(
          'relative rounded-3xl px-8 md:px-14 py-6 md:py-8',
          'border-2 border-brand-purple/60 bg-navy-900/70',
          'animate-breathe',
        )}
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 chip-neon">
          Room Code
        </div>
        <div className="flex items-center gap-3 md:gap-5">
          {code.split('').map((char, i) => (
            <span
              key={i}
              className="font-display font-extrabold text-white text-6xl md:text-8xl leading-none tracking-tight text-neon-purple tabular-nums"
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Step-Indicator ---------------------------------------------------

interface LobbyStepIndicatorProps {
  step: 'roster' | 'assign' | 'ready'
  className?: string
}

const STEP_ORDER: LobbyStepIndicatorProps['step'][] = ['roster', 'assign', 'ready']
const STEP_LABELS: Record<LobbyStepIndicatorProps['step'], string> = {
  roster: 'Spieler',
  assign: 'Teams',
  ready:  'Bereit',
}

function LobbyStepIndicator({ step, className }: LobbyStepIndicatorProps) {
  const currentIdx = STEP_ORDER.indexOf(step)
  return (
    <div className={cn('flex justify-center', className)}>
      <div className="inline-flex items-center gap-3 md:gap-4">
        {STEP_ORDER.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={s} className="flex items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 md:h-8 md:w-8 rounded-full items-center justify-center',
                    'font-display font-bold text-xs md:text-sm border-2 transition-all',
                    done && 'border-correct/60 bg-correct/15 text-correct',
                    active && 'border-brand-purple/70 bg-brand-purple/25 text-brand-purple-soft shadow-glow-purple',
                    !done && !active && 'border-white/10 bg-navy-800/60 text-ink-faint',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-[11px] md:text-xs uppercase tracking-[0.22em]',
                    active ? 'text-ink font-semibold' : 'text-ink-muted',
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEP_ORDER.length - 1 && (
                <span
                  className={cn(
                    'inline-block h-px w-8 md:w-12',
                    done ? 'bg-correct/50' : 'bg-white/10',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Step-Footer / Ready-Footer --------------------------------------

interface StepFooterProps {
  step: 'roster' | 'assign'
  canAdvance: boolean
  poolCount: number
  onAdvance: () => void
  onBack: () => void
}

function StepFooter({ step, canAdvance, poolCount, onAdvance, onBack }: StepFooterProps) {
  const hint =
    step === 'assign' && !canAdvance
      ? `${poolCount} Spieler ${poolCount === 1 ? 'wartet' : 'warten'} noch — bitte in ein Team ziehen oder Zufall!`
      : step === 'roster'
      ? 'Spieler und Interessen können später noch angepasst werden.'
      : 'Alle sind zugeordnet — weiter geht\'s!'

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <p className="text-sm text-ink-muted md:max-w-md">{hint}</p>
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="ghost"
          size="md"
          leading={<ArrowLeft className="h-4 w-4" />}
          onClick={onBack}
        >
          Zurück
        </Button>
        <button
          type="button"
          disabled={!canAdvance}
          onClick={onAdvance}
          className={cn(
            'inline-flex items-center gap-3 h-12 md:h-14 px-6 md:px-7 rounded-full',
            'font-display font-bold uppercase tracking-widest text-white text-sm',
            'bg-cta shadow-neon-purple hover:brightness-110',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
            'transition-all',
          )}
        >
          {step === 'roster' ? 'Weiter' : 'Bereitmachen'}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

interface ReadyFooterProps {
  readyCount: number
  totalPlayers: number
  allReady: boolean
  onStart: () => void
}

function ReadyFooter({ readyCount, totalPlayers, allReady, onStart }: ReadyFooterProps) {
  return (
    <>
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-center gap-3 text-sm mb-3">
          <span className="font-display font-bold text-brand-purple-soft text-lg tabular-nums">
            {readyCount}
          </span>
          <span className="text-ink-faint">/</span>
          <span className="font-display font-bold text-ink text-lg tabular-nums">
            {totalPlayers}
          </span>
          <span className="text-ink-muted uppercase tracking-[0.22em] text-xs">
            Spieler bereit
          </span>
        </div>
        <div className="mx-auto max-w-md h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(readyCount / Math.max(1, totalPlayers)) * 100}%`,
              background: 'linear-gradient(90deg, #7C5CFF 0%, #27D8FF 100%)',
              boxShadow: '0 0 20px rgba(124,92,255,0.65)',
            }}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          disabled={!allReady}
          onClick={onStart}
          className={cn(
            'inline-flex items-center gap-4 h-16 px-10 rounded-full',
            'font-display font-bold uppercase tracking-widest text-white text-sm',
            'bg-cta shadow-neon-purple hover:brightness-110',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
            'transition-all',
          )}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <Play className="h-5 w-5 fill-current" />
          </span>
          Spiel starten
        </button>
      </div>
    </>
  )
}

// ---------- Roster-Section ---------------------------------------------------

interface RosterSectionProps {
  round: RoundConfig
  dispatch: (action: GameAction) => void
}

function RosterSection({ round, dispatch }: RosterSectionProps) {
  return (
    <section className="mt-8 md:mt-10">
      <div className="text-center mb-6 md:mb-8">
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          <Sparkles className="h-3.5 w-3.5 text-brand-purple-soft" />
          Wer spielt mit — und worauf steht ihr?
        </div>
        <h2 className="mt-3 font-display font-bold uppercase text-white text-3xl md:text-5xl tracking-tight leading-tight">
          Erstmal die <span className="text-neon-purple">Menschen</span>
        </h2>
        <p className="mt-3 text-ink-muted text-sm max-w-2xl mx-auto leading-relaxed">
          Namen, Avatare, Interessen. Teams kommen im nächsten Schritt — dann kannst du
          per Zufall oder Drag-and-Drop verteilen.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        {round.players.map((player, i) => (
          <RosterPlayerRow
            key={player.id}
            player={player}
            placeholderIndex={i + 1}
            dispatch={dispatch}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => dispatch({ type: 'ADD_PLAYER', teamId: null })}
          className={cn(
            'inline-flex items-center gap-2 h-10 rounded-full px-4',
            'border border-brand-purple/40 bg-brand-purple/10 text-brand-purple-soft',
            'text-xs uppercase tracking-[0.22em] font-semibold',
            'hover:bg-brand-purple/20 hover:border-brand-purple/60 transition-colors',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Spieler hinzufügen
        </button>
        <span className="text-xs text-ink-faint">
          {round.players.length} {round.players.length === 1 ? 'Person' : 'Personen'} im Raster
        </span>
      </div>

      <PlayerLibraryPanel round={round} dispatch={dispatch} />
    </section>
  )
}

// ---------- Roster: einzelne Player-Zeile (flach, ohne Team-Farbe) ----------

interface RosterPlayerRowProps {
  player: Player
  placeholderIndex: number
  dispatch: (action: GameAction) => void
}

function RosterPlayerRow({ player, placeholderIndex, dispatch }: RosterPlayerRowProps) {
  const [avatarOpen, setAvatarOpen] = useState(false)
  const levelByTopic = new Map<string, SkillLevel>()
  for (const { topic, level } of player.interests) levelByTopic.set(topic, level)

  return (
    <div className="rounded-card border border-white/[0.08] bg-navy-800/60 p-4">
      <div className="flex items-center gap-2 relative">
        <button
          type="button"
          onClick={() => setAvatarOpen((v) => !v)}
          aria-label="Avatar bearbeiten"
          className="shrink-0 relative"
        >
          <AvatarBadge avatar={player.avatar} size="md" name={player.name} />
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-navy-800 border border-white/20"
          >
            <Pencil className="h-2.5 w-2.5 text-ink-muted" />
          </span>
        </button>
        <input
          type="text"
          value={player.name}
          maxLength={24}
          placeholder={`Spieler ${placeholderIndex}`}
          onChange={(e) =>
            dispatch({ type: 'SET_PLAYER_NAME', playerId: player.id, name: e.target.value })
          }
          className={cn(
            'flex-1 bg-transparent text-sm font-medium text-ink',
            'placeholder:text-ink-faint focus:outline-none',
          )}
        />
        <button
          type="button"
          aria-label="Spieler entfernen"
          onClick={() => dispatch({ type: 'REMOVE_PLAYER', playerId: player.id })}
          className="text-ink-muted hover:text-wrong transition-colors p-1"
        >
          <UserMinus className="h-4 w-4" />
        </button>
        {avatarOpen && (
          <AvatarEditor
            avatar={player.avatar}
            onChange={(next) =>
              dispatch({ type: 'SET_PLAYER_AVATAR', playerId: player.id, avatar: next })
            }
            onClose={() => setAvatarOpen(false)}
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TOPICS.map((topic) => {
          const level = levelByTopic.get(topic.id)
          return (
            <InterestChip
              key={topic.id}
              emoji={topic.emoji}
              label={topic.label}
              level={level}
              onClick={() => {
                const nextLvl = nextLevel(level)
                let interests = player.interests
                if (nextLvl === null) {
                  interests = interests.filter((i) => i.topic !== topic.id)
                } else if (level) {
                  interests = interests.map((i) =>
                    i.topic === topic.id ? { topic: topic.id, level: nextLvl } : i,
                  )
                } else {
                  interests = [...interests, { topic: topic.id, level: nextLvl }]
                }
                dispatch({
                  type: 'SET_PLAYER_INTERESTS',
                  playerId: player.id,
                  interests,
                })
              }}
            />
          )
        })}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Tippen zyklt: aus → bisschen → gut → nerd → aus.
      </div>
    </div>
  )
}

// ---------- Assign-Section (Wartebereich + Team-Slots + D&D) ----------------

interface AssignSectionProps {
  round: RoundConfig
  dispatch: (action: GameAction) => void
}

function AssignSection({ round, dispatch }: AssignSectionProps) {
  const poolPlayers = round.players.filter((p) => p.teamId === null)
  const poolEmpty = poolPlayers.length === 0

  return (
    <section className="mt-8 md:mt-10">
      <div className="text-center mb-6 md:mb-8">
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          <Users className="h-3.5 w-3.5 text-brand-cyan-soft" />
          Wer spielt mit wem?
        </div>
        <h2 className="mt-3 font-display font-bold uppercase text-white text-3xl md:text-5xl tracking-tight leading-tight">
          Jetzt <span className="text-neon-cyan">verteilen</span>
        </h2>
        <p className="mt-3 text-ink-muted text-sm max-w-2xl mx-auto leading-relaxed">
          Ziehe Spieler aus dem Wartebereich in ein Team — oder überlass den Zufall die
          Arbeit. Jederzeit umsortieren geht.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SHUFFLE_PLAYERS' })}
            className={cn(
              'inline-flex items-center gap-2 h-10 rounded-full px-4',
              'border border-brand-cyan/50 bg-brand-cyan/15 text-brand-cyan-soft',
              'text-xs uppercase tracking-[0.22em] font-semibold',
              'hover:bg-brand-cyan/25 hover:border-brand-cyan/70 transition-colors',
            )}
          >
            <Shuffle className="h-3.5 w-3.5" />
            Zufall!
          </button>
        </div>
      </div>

      {/* Wartebereich (Pool) */}
      <PoolDropZone
        players={poolPlayers}
        onDropPlayer={(playerId) =>
          dispatch({ type: 'MOVE_PLAYER_TO_TEAM', playerId, teamId: null })
        }
      >
        {poolEmpty ? (
          <div className="text-center py-6 text-sm text-ink-faint">
            Alle Spieler sind einem Team zugeordnet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {poolPlayers.map((p) => (
              <DraggablePlayerCard
                key={p.id}
                player={p}
                placeholderName={`Spieler ${round.players.indexOf(p) + 1}`}
                onDoubleClick={() => {
                  // Doppelklick als Touch-Fallback: ins erste noch nicht volle Team schieben.
                  const target = round.teams.find(
                    (t) =>
                      round.players.filter((pp) => pp.teamId === t.id).length < 4,
                  )
                  if (target)
                    dispatch({
                      type: 'MOVE_PLAYER_TO_TEAM',
                      playerId: p.id,
                      teamId: target.id,
                    })
                }}
              />
            ))}
          </div>
        )}
      </PoolDropZone>

      {/* Team-Slots */}
      <div
        className={cn(
          'mt-6 grid gap-4',
          round.teams.length === 2 && 'md:grid-cols-2',
          round.teams.length === 3 && 'md:grid-cols-3',
          round.teams.length === 4 && 'md:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {round.teams.map((team) => {
          const teamPlayers = round.players.filter((p) => p.teamId === team.id)
          return (
            <TeamAssignSlot
              key={team.id}
              team={team}
              players={teamPlayers}
              onDropPlayer={(playerId) =>
                dispatch({
                  type: 'MOVE_PLAYER_TO_TEAM',
                  playerId,
                  teamId: team.id,
                })
              }
              onSendToPool={(playerId) =>
                dispatch({
                  type: 'MOVE_PLAYER_TO_TEAM',
                  playerId,
                  teamId: null,
                })
              }
            />
          )
        })}
      </div>

      <p className="mt-4 text-center text-[11px] uppercase tracking-[0.22em] text-ink-faint">
        Tipp: Doppelklick auf einen Spieler im Wartebereich als Touch-Alternative
      </p>
    </section>
  )
}

// ---------- Pool-Drop-Zone (Wartebereich) -----------------------------------

interface PoolDropZoneProps {
  players: Player[]
  onDropPlayer: (playerId: string) => void
  children: React.ReactNode
}

function PoolDropZone({ players, onDropPlayer, children }: PoolDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        // Nur akzeptieren, wenn unser MIME-Type dabei ist.
        if (e.dataTransfer.types.includes(DND_PLAYER_MIME)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!dragOver) setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const playerId = e.dataTransfer.getData(DND_PLAYER_MIME)
        if (playerId) onDropPlayer(playerId)
      }}
      className={cn(
        'rounded-card border-2 border-dashed p-4 md:p-5 transition-colors',
        dragOver
          ? 'border-brand-purple/70 bg-brand-purple/10'
          : 'border-white/15 bg-navy-800/40',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Wartebereich</div>
        <div className="text-[11px] text-ink-muted tabular-nums">
          {players.length} {players.length === 1 ? 'Spieler' : 'Spieler'} übrig
        </div>
      </div>
      {children}
    </div>
  )
}

// ---------- Team-Slot (Drop-Ziel) --------------------------------------------

interface TeamAssignSlotProps {
  team: Team
  players: Player[]
  onDropPlayer: (playerId: string) => void
  onSendToPool: (playerId: string) => void
}

function TeamAssignSlot({ team, players, onDropPlayer, onSendToPool }: TeamAssignSlotProps) {
  const tokens = getTeamColorTokens(team.color)
  const hex = tokens.hex
  const [dragOver, setDragOver] = useState(false)
  const isFull = players.length >= 4

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_PLAYER_MIME) && !isFull) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!dragOver) setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (isFull) return
        const playerId = e.dataTransfer.getData(DND_PLAYER_MIME)
        if (playerId) onDropPlayer(playerId)
      }}
      className="rounded-card border p-4 md:p-5 min-h-[180px] transition-all"
      style={{
        borderColor: dragOver ? `${hex}CC` : `${hex}55`,
        background: 'rgba(11,16,32,0.55)',
        boxShadow: dragOver
          ? `0 0 0 2px ${hex}66, 0 0 24px -4px ${hex}88`
          : `inset 0 0 0 1px ${hex}22`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center font-display font-bold text-xs border-2',
            tokens.chipStrong,
          )}
        >
          {team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow" style={{ color: hex }}>
            {team.name}
          </div>
          <div className="text-[11px] text-ink-muted tabular-nums">
            {players.length}/4 Spieler
          </div>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="text-center py-8 text-sm text-ink-faint">
          Spieler hierher ziehen
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {players.map((p, i) => (
            <DraggablePlayerCard
              key={p.id}
              player={p}
              placeholderName={`Spieler ${i + 1}`}
              teamHex={hex}
              onDoubleClick={() => onSendToPool(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Draggable Player-Chip -------------------------------------------

interface DraggablePlayerCardProps {
  player: Player
  placeholderName: string
  teamHex?: string
  onDoubleClick?: () => void
}

function DraggablePlayerCard({
  player,
  placeholderName,
  teamHex,
  onDoubleClick,
}: DraggablePlayerCardProps) {
  const [dragging, setDragging] = useState(false)
  const displayName = player.name.trim() || placeholderName

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_PLAYER_MIME, player.id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDoubleClick={onDoubleClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full pl-1 pr-3 h-9',
        'border border-white/10 bg-navy-900/70 text-sm font-medium text-ink',
        'cursor-grab active:cursor-grabbing select-none',
        'hover:border-white/25 transition-all',
        dragging && 'opacity-40',
      )}
      style={
        teamHex
          ? {
              borderColor: `${teamHex}66`,
              boxShadow: `inset 0 0 0 1px ${teamHex}25`,
            }
          : undefined
      }
      title="Ziehen zum Verschieben, Doppelklick zum Umschieben"
    >
      <AvatarBadge avatar={player.avatar} size="sm" teamHex={teamHex} name={player.name} />
      <span className="truncate max-w-[10rem]">{displayName}</span>
      {player.interests.length > 0 && (
        <span className="text-[10px] text-ink-faint tabular-nums">
          {player.interests.length}★
        </span>
      )}
    </div>
  )
}

// ---------- Ready-Section (Team-Karten + Interessen-Preview) ---------------

interface ReadySectionProps {
  round: RoundConfig
  readyIds: Set<string>
  togglePlayerReady: (playerId: string) => void
  setAllReady: () => void
  totalMinutes: number
  onEditRound: () => void
}

function ReadySection({
  round,
  readyIds,
  togglePlayerReady,
  setAllReady,
  totalMinutes,
  onEditRound,
}: ReadySectionProps) {
  return (
    <div className="mt-8 md:mt-10">
      <div className="text-center">
        <div className="eyebrow">Game Night</div>
        <h1 className="mt-3 font-display font-bold uppercase text-white leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Raum <span className="text-neon-purple">Beitreten</span>
        </h1>
        <p className="mt-3 text-ink-muted max-w-lg mx-auto text-sm md:text-base">
          Alle einmal auf „bereit" — dann geht der Abend los.
        </p>
      </div>

      {/* Spieler-Ready-Karten — Portrait-Style ähnlich dem Mockup.
          Layout: horizontales Grid mit einem „bereit / nicht bereit"-Badge pro Karte. */}
      <div className="mt-8 md:mt-10 flex flex-wrap justify-center gap-3 md:gap-4">
        {round.players.map((player) => (
          <PlayerReadyCard
            key={player.id}
            player={player}
            teamColorHex={
              player.teamId
                ? getTeamColorTokens(
                    round.teams.find((t) => t.id === player.teamId)!.color,
                  ).hex
                : '#5A6485'
            }
            isReady={readyIds.has(player.id)}
            onToggle={() => togglePlayerReady(player.id)}
          />
        ))}
      </div>

      {/* Team-Zusammenfassung — dezente Zeile darunter, damit die Teams sichtbar bleiben. */}
      <div className="mt-6 md:mt-8">
        <TeamSummaryRow round={round} />
      </div>

      {/* „Alle bereit"-Shortcut, wenn noch nicht alle bestätigt haben. */}
      {round.players.length > 0 && round.players.some((p) => !readyIds.has(p.id)) && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={setAllReady}
            className="inline-flex items-center gap-2 h-9 rounded-full px-4 border border-white/10 bg-navy-800/70 text-xs uppercase tracking-[0.22em] text-ink-muted hover:text-ink hover:border-white/25 transition-colors"
          >
            <Check className="h-3 w-3" />
            Alle sind bereit
          </button>
        </div>
      )}

      {/* Euer Mix — Interessen-Preview */}
      <InterestsPreviewPanel round={round} />

      {/* Meta-Zeile */}
      <div className="mt-8 flex justify-center">
        <div className="inline-flex flex-wrap items-center gap-3 md:gap-6 rounded-full bg-navy-800/70 border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <Gamepad2 className="h-3.5 w-3.5" />
            <span className="text-ink font-semibold normal-case tracking-normal">
              Heute: {round.gameModes.length} Modi
            </span>
          </span>
          <span className="text-ink-faint">·</span>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            {totalMinutes} Min
          </span>
          <span className="text-ink-faint">·</span>
          <span className="inline-flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" />
            Best of {round.bestOf}
          </span>
          <span className="text-ink-faint">·</span>
          <button
            className="text-brand-cyan-soft hover:text-brand-cyan transition-colors tracking-widest"
            onClick={onEditRound}
          >
            Ändern →
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Player-Ready-Card (Portrait-Style) ------------------------------

interface PlayerReadyCardProps {
  player: Player
  teamColorHex: string
  isReady: boolean
  onToggle: () => void
}

function PlayerReadyCard({
  player,
  teamColorHex,
  isReady,
  onToggle,
}: PlayerReadyCardProps) {
  const displayName = player.name.trim() || 'Spieler'
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'group relative rounded-card border w-32 md:w-36 p-3 md:p-4 text-center transition-all',
        'bg-navy-800/70 border-white/10',
        'hover:border-white/25 hover:bg-navy-700',
      )}
      style={
        isReady
          ? {
              borderColor: `${teamColorHex}66`,
              boxShadow: `0 0 0 2px ${teamColorHex}55, 0 0 28px -4px ${teamColorHex}80`,
            }
          : undefined
      }
      aria-pressed={isReady}
    >
      <div className="flex justify-center">
        <AvatarBadge
          avatar={player.avatar}
          size="xl"
          teamHex={teamColorHex}
          name={displayName}
        />
      </div>
      <div className="mt-3 font-display font-bold text-ink text-base md:text-lg truncate">
        {displayName}
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs">
        {isReady ? (
          <>
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: '#3FD98B' }}
            >
              <Check className="h-3 w-3 text-navy-900" />
            </span>
            <span className="text-correct font-medium">Bereit</span>
          </>
        ) : (
          <>
            <span
              className="inline-flex h-3 w-3 rounded-full"
              style={{ background: `${teamColorHex}80` }}
            />
            <span className="text-ink-muted">Nicht bereit</span>
          </>
        )}
      </div>
    </button>
  )
}

// ---------- Team-Zusammenfassung im Ready-Screen -----------------------------

interface TeamSummaryRowProps {
  round: RoundConfig
}

function TeamSummaryRow({ round }: TeamSummaryRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
      {round.teams.map((team) => {
        const tokens = getTeamColorTokens(team.color)
        const teamPlayers = round.players.filter((p) => p.teamId === team.id)
        return (
          <div
            key={team.id}
            className="inline-flex items-center gap-2 h-9 rounded-full pl-1.5 pr-4 border"
            style={{
              borderColor: `${tokens.hex}44`,
              background: `${tokens.hex}14`,
            }}
          >
            <span
              className="inline-block h-6 w-6 rounded-full"
              style={{
                background: tokens.hex,
                boxShadow: `0 0 8px ${tokens.hex}80`,
              }}
              aria-hidden
            />
            <span className="font-display font-semibold text-sm text-ink">
              {team.name}
            </span>
            <span className="text-[11px] text-ink-muted tabular-nums">
              {teamPlayers.length}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Interest-Chip mit Level-Cycle ------------------------------------

/**
 * SkillLevel ist intern numerisch (1-5, siehe Session X). Die UI nutzt aktuell
 * drei Werte:
 *   2 = „bisschen"  (Einstieg)
 *   3 = „gut"       (solide)
 *   5 = „nerd"      (Spezialwissen)
 *
 * Der Cycle geht: aus → 2 → 3 → 5 → aus (wieder).
 * Der interne Store erlaubt auch 1 und 4, das UI wählt aber bewusst nur die drei
 * Stufen aus, um die Auswahl schnell zu halten.
 */
const UI_LEVELS: readonly SkillLevel[] = [2, 3, 5]

const LEVEL_LABEL: Record<SkillLevel, string> = {
  1: 'keine Ahnung',
  2: 'bisschen',
  3: 'gut',
  4: 'sehr gut',
  5: 'nerd',
}

const LEVEL_STYLE: Record<SkillLevel, string> = {
  1: 'bg-brand-purple/5 border-brand-purple/25 text-brand-purple-soft',
  2: 'bg-brand-purple/10 border-brand-purple/40 text-brand-purple-soft',
  3: 'bg-brand-purple/25 border-brand-purple/70 text-brand-purple-soft',
  4: 'bg-brand-purple/35 border-brand-purple/80 text-brand-purple-soft',
  5: 'bg-brand-purple/40 border-brand-purple/90 text-white shadow-[0_0_18px_-4px_rgba(124,92,255,0.9)]',
}

/** Wieviele Punkte sichtbar sind (visueller Fortschritt in der Chip-Pille). */
const LEVEL_DOTS: Record<SkillLevel, number> = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 }

function nextLevel(current: SkillLevel | undefined): SkillLevel | null {
  const idx = current ? UI_LEVELS.indexOf(current) : -1
  if (idx < 0) return UI_LEVELS[0] ?? null
  return UI_LEVELS[idx + 1] ?? null
}

interface InterestChipProps {
  emoji: string
  label: string
  level: SkillLevel | undefined
  onClick: () => void
}

function InterestChip({ emoji, label, level, onClick }: InterestChipProps) {
  const off = !level
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!off}
      title={level ? `${label} · ${LEVEL_LABEL[level]}` : label}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 rounded-full px-2.5',
        'text-[11px] font-medium transition-all border',
        off
          ? 'bg-navy-800/70 border-white/10 text-ink-muted hover:border-white/25 hover:text-ink'
          : LEVEL_STYLE[level],
      )}
    >
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
      {level && <LevelDots count={LEVEL_DOTS[level]} />}
    </button>
  )
}

function LevelDots({ count }: { count: number }) {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1 w-1 rounded-full',
            i < count ? 'bg-current opacity-90' : 'bg-current opacity-25',
          )}
        />
      ))}
    </span>
  )
}

// ---------- „Euer Mix"-Panel -------------------------------------------------

interface PreviewPanelProps {
  round: RoundConfig
}

function InterestsPreviewPanel({ round }: PreviewPanelProps) {
  const profile = computeInterestProfile(round.players)
  const shared: Topic[] = Array.from(profile.shared)
  const individual: Topic[] = Array.from(profile.individual)
  const totalInterests = shared.length + individual.length
  const playersWithInterests = round.players.filter((p) => p.interests.length > 0).length

  if (totalInterests === 0) {
    return (
      <div className="mt-6 rounded-card border border-dashed border-white/10 bg-navy-800/40 p-4 md:p-5 text-center">
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          <Users className="h-3.5 w-3.5" />
          Euer Mix
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Noch keine Interessen gewählt. Ohne Auswahl spielt ihr das breite Programm —
          alle Topics gleich gewichtet.
        </p>
      </div>
    )
  }

  return (
    <div
      className="mt-6 rounded-card border border-brand-purple/25 bg-navy-800/60 p-4 md:p-5"
      style={{ boxShadow: '0 0 24px -8px rgba(124,92,255,0.55)' }}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <div className="eyebrow inline-flex items-center gap-2 text-brand-purple-soft">
            <Sparkles className="h-3.5 w-3.5" />
            Euer Mix für heute
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Gemeinsame Interessen tragen die Blitzrunde (60%), individuelle bekommen 30%,
            Wildcards 10%.
          </p>
        </div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted whitespace-nowrap">
          <span className="text-ink font-semibold tabular-nums">{playersWithInterests}</span>
          {' / '}
          <span className="tabular-nums">{round.players.length}</span> mit Präferenz
        </div>
      </div>

      {shared.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-brand-cyan-soft mb-1.5">
            Gemeinsam
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shared.map((t) => (
              <ProfileTopicChip
                key={t}
                topicId={t}
                level={profile.levelPerTopic.get(t)}
                tone="shared"
              />
            ))}
          </div>
        </div>
      )}

      {individual.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted mb-1.5">
            Von einzelnen
          </div>
          <div className="flex flex-wrap gap-1.5">
            {individual.map((t) => (
              <ProfileTopicChip
                key={t}
                topicId={t}
                level={profile.levelPerTopic.get(t)}
                tone="individual"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface ProfileTopicChipProps {
  topicId: Topic
  level: SkillLevel | undefined
  tone: 'shared' | 'individual'
}

function ProfileTopicChip({ topicId, level, tone }: ProfileTopicChipProps) {
  const topic = TOPICS_BY_ID[topicId]
  const tint =
    tone === 'shared'
      ? 'border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan-soft'
      : 'border-white/10 bg-navy-900/60 text-ink-muted'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-7 rounded-full px-2.5 text-[11px] font-medium border',
        tint,
      )}
      title={level ? `${topic.label} · ${LEVEL_LABEL[level]}` : topic.label}
    >
      <span aria-hidden>{topic.emoji}</span>
      <span>{topic.label}</span>
      {level && <LevelDots count={LEVEL_DOTS[level]} />}
    </span>
  )
}

// ---------- Avatar-Editor (Popover) -----------------------------------------

interface AvatarEditorProps {
  avatar: Avatar
  onChange: (next: Avatar) => void
  onClose: () => void
}

function AvatarEditor({ avatar, onChange, onClose }: AvatarEditorProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const dataUrl = await downscaleImageToDataUrl(file)
      onChange({ ...avatar, photoDataUrl: dataUrl })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="absolute top-full left-0 mt-2 z-20 w-72 rounded-card border border-white/10 bg-navy-800 p-3 shadow-neon-purple"
      role="dialog"
      aria-label="Avatar bearbeiten"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Avatar</div>
        <button
          type="button"
          aria-label="Schließen"
          onClick={onClose}
          className="text-ink-muted hover:text-ink p-1"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Preview + Foto-Aktionen */}
      <div className="flex items-center gap-3 mb-3">
        <AvatarBadge avatar={avatar} size="lg" />
        <div className="flex-1 flex flex-col gap-1.5">
          <label
            className={cn(
              'inline-flex items-center justify-center gap-1.5 h-8 rounded-lg px-3 cursor-pointer',
              'border border-brand-purple/40 bg-brand-purple/15 text-brand-purple-soft',
              'text-[11px] uppercase tracking-[0.16em] font-semibold',
              'hover:bg-brand-purple/25 transition-colors',
              uploading && 'opacity-60 cursor-wait',
            )}
          >
            <Camera className="h-3 w-3" />
            <span>{uploading ? 'Wird geladen…' : avatar.photoDataUrl ? 'Anderes Foto' : 'Foto wählen'}</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                void handleFile(file)
                // Reset, damit dasselbe File erneut wählbar ist.
                e.target.value = ''
              }}
            />
          </label>
          {avatar.photoDataUrl && (
            <button
              type="button"
              onClick={() => onChange({ ...avatar, photoDataUrl: null })}
              className="inline-flex items-center gap-1 h-7 rounded-lg px-2 text-[11px] uppercase tracking-[0.16em] text-ink-muted hover:text-wrong transition-colors"
            >
              <XIcon className="h-3 w-3" />
              Foto entfernen
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 text-[11px] text-wrong bg-wrong/10 border border-wrong/30 rounded-md px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Farb-Ring
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {AVATAR_COLORS.map((colorHex) => {
          const isOn = colorHex === avatar.colorHex
          return (
            <button
              key={colorHex}
              type="button"
              onClick={() => onChange({ ...avatar, colorHex })}
              aria-label={`Farbe ${colorHex}`}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-all',
                isOn ? 'scale-110' : 'hover:scale-105',
              )}
              style={{
                borderColor: isOn ? '#fff' : `${colorHex}80`,
                background: colorHex,
                boxShadow: isOn ? `0 0 12px ${colorHex}CC` : undefined,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---------- Player-Library-Panel --------------------------------------------

interface PlayerLibraryPanelProps {
  round: RoundConfig
  dispatch: (action: GameAction) => void
}

function PlayerLibraryPanel({ round, dispatch }: PlayerLibraryPanelProps) {
  // Wir lesen die Bibliothek beim ersten Render und bei jeder Player-Änderung —
  // damit bereits geladene Profile aus der Auswahl verschwinden.
  const activeIds = new Set(round.players.map((p) => p.id))
  const [profiles, setProfiles] = useState<PlayerProfile[]>(() =>
    readPlayerLibrary().filter((p) => !activeIds.has(p.id)),
  )

  useEffect(() => {
    setProfiles(readPlayerLibrary().filter((p) => !activeIds.has(p.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.players.length])

  if (profiles.length === 0) return null

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="eyebrow inline-flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-brand-cyan-soft" />
            Bekannte Spieler
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Profile aus vergangenen Abenden. Klick fügt sie zum Roster hinzu — Team-
            Zuordnung kommt im nächsten Schritt.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {profiles.slice(0, 10).map((profile) => (
          <LibraryChip
            key={profile.id}
            profile={profile}
            onAdd={() =>
              dispatch({ type: 'ADD_PLAYER_FROM_LIBRARY', teamId: null, profile })
            }
            onForget={() => {
              removeFromPlayerLibrary(profile.id)
              setProfiles(readPlayerLibrary().filter((p) => !activeIds.has(p.id)))
            }}
          />
        ))}
      </div>
    </section>
  )
}

interface LibraryChipProps {
  profile: PlayerProfile
  onAdd: () => void
  onForget: () => void
}

function LibraryChip({ profile, onAdd, onForget }: LibraryChipProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 h-9 rounded-full pl-1 pr-3',
          'border border-white/10 bg-navy-800/70 text-sm',
          'hover:border-white/25 transition-colors',
        )}
      >
        <AvatarBadge avatar={profile.avatar} size="sm" name={profile.name} />
        <span className="text-ink font-medium truncate max-w-[8rem]">
          {profile.name}
        </span>
        {profile.interests.length > 0 && (
          <span className="text-[10px] text-ink-faint tabular-nums">
            {profile.interests.length}★
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-20 rounded-card border border-white/10 bg-navy-800 p-2 shadow-neon-purple"
          role="dialog"
        >
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-faint mb-2">
            Aktion
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <button
              type="button"
              onClick={() => {
                onAdd()
                setOpen(false)
              }}
              className="h-8 rounded-lg px-2 flex items-center gap-2 text-sm text-ink hover:bg-white/[0.06]"
            >
              <Plus className="h-3.5 w-3.5 text-brand-purple-soft" />
              <span>Ins Roster</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onForget()
                setOpen(false)
              }}
              className="mt-1 h-8 rounded-lg px-2 flex items-center gap-2 text-xs text-ink-muted hover:bg-wrong/10 hover:text-wrong"
            >
              <XIcon className="h-3 w-3" />
              Aus Bibliothek löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
