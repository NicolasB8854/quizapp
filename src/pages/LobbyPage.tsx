/**
 * Lobby — vor dem Spielstart.
 *
 * Angelehnt an das PDF-Mockup „Room-Code, Spielerstatus und Startmoment":
 *  - Micro-Label „GAME NIGHT" oben (klein, uppercase)
 *  - Riesige Show-Headline mit hervorgehobenem zweitem Wort (Purple)
 *  - Ambient-Bühne (aus ScreenLayout)
 *  - Zentraler Room-Code mit mehrschichtigem Neon-Glow („atmet" leicht)
 *  - Team-Ready-Karten mit Initial-Avatar und Ready-Indikator
 *  - Progress-Zeile „X / N bereit" mit Neon-Balken
 *  - Großer Show-CTA „Spiel starten"
 *  - Meta-Chip-Zeile mit Ablauf-Kurzform + „Ändern"-Link zurück ins Setup
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Check, Gamepad2, Clock, Trophy, Sparkles, Plus, UserMinus, Users, Pencil, BookOpen, X as XIcon } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { AvatarBadge } from '@/components/AvatarBadge'
import { useGame, type GameAction } from '@/context/GameContext'
import { MODES_BY_ID } from '@/data/modes'
import { TOPICS, TOPICS_BY_ID } from '@/data/topics'
import { AVATAR_COLORS, AVATAR_EMOJIS } from '@/data/avatars'
import type { Topic } from '@/types/question'
import type { Avatar, Player, RoundConfig, SkillLevel, Team } from '@/types/round'
import { computeInterestProfile } from '@/lib/interestProfile'
import {
  readPlayerLibrary,
  removeFromPlayerLibrary,
  type PlayerProfile,
} from '@/lib/playerLibrary'
import { cn } from '@/lib/classnames'

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

  const allReady = state.round.teams.every((t) => readyIds.has(t.id))
  const readyCount = state.round.teams.filter((t) => readyIds.has(t.id)).length
  const totalTeams = state.round.teams.length

  const toggleReady = (teamId: string) => {
    setReadyIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  return (
    <ScreenLayout
      variant="home"
      navActions={
        <Button
          variant="ghost"
          size="md"
          leading={<ArrowLeft className="h-4 w-4" />}
          onClick={() => dispatch({ type: 'BACK_TO_SETUP' })}
        >
          Zurück zum Setup
        </Button>
      }
      headerMeta="Lobby · Bereitmachen"
    >
      <div className="mx-auto max-w-5xl pt-2 md:pt-8 pb-10 animate-titleIn">
        {/* Show-Headline */}
        <div className="text-center">
          <div className="eyebrow">Game Night</div>
          <h1 className="mt-4 font-display font-bold uppercase text-white leading-[0.9] tracking-tight text-5xl md:text-7xl">
            Raum{' '}
            <span className="text-neon-purple">Beitreten</span>
          </h1>
          <p className="mt-4 text-ink-muted max-w-lg mx-auto">
            Wenn deine Teams am Tisch sitzen, sind alle drin.
            <br className="hidden md:block" />
            Der Code bleibt für den Abend gleich.
          </p>
        </div>

        {/* Room-Code — großes leuchtendes Anker-Element */}
        <div className="mt-10 flex justify-center">
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
              {state.round.roomCode.split('').map((char, i) => (
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

        {/* Team-Ready-Karten */}
        <div className="mt-10 md:mt-14 grid grid-cols-2 gap-3 md:gap-5">
          {state.round.teams.map((team) => {
            const isReady = readyIds.has(team.id)
            const ringHex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => toggleReady(team.id)}
                className={cn(
                  'group relative rounded-card border p-5 md:p-6 text-left transition-all',
                  'bg-navy-800/70 border-white/10',
                  'hover:border-white/25 hover:bg-navy-700',
                )}
                style={
                  isReady
                    ? {
                        borderColor: `${ringHex}66`,
                        boxShadow:
                          `0 0 0 2px ${ringHex}55, 0 0 28px -4px ${ringHex}80`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'shrink-0 h-14 w-14 md:h-16 md:w-16 rounded-full flex items-center justify-center font-display font-bold text-xl border-2',
                      team.color === 'purple'
                        ? 'text-brand-purple-soft border-brand-purple/60 bg-brand-purple/15'
                        : 'text-brand-cyan-soft border-brand-cyan/60 bg-brand-cyan/15',
                    )}
                    style={{
                      boxShadow: `0 0 0 1px ${ringHex}40, 0 0 22px -6px ${ringHex}80`,
                    }}
                  >
                    {team.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="eyebrow">
                      Team · {team.color === 'purple' ? 'Purple' : 'Cyan'}
                    </div>
                    <div className="mt-0.5 font-display font-bold text-xl md:text-2xl truncate">
                      {team.name}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
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
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink-muted" />
                          <span className="text-ink-muted">Tippe zum Bereitmachen</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Personalisierungs-Layer — pro Spieler Interessen erfassen.
            Aggregation fließt automatisch in round.interests → beeinflusst die
            Blitzrunde und markiert Themen im Battle-Grid. */}
        <PlayerSetupSection round={state.round} dispatch={dispatch} />

        {/* „Euer Mix" — sichtbarer Feedback-Layer aus dem v2-Konzept
            („Magic Moment" nach Interessen-Setup). */}
        <InterestsPreviewPanel round={state.round} />

        {/* Progress + CTA */}
        <div className="mt-8 md:mt-10">
          <div className="flex items-center justify-center gap-3 text-sm mb-3">
            <span className="font-display font-bold text-brand-purple-soft text-lg tabular-nums">
              {readyCount}
            </span>
            <span className="text-ink-faint">/</span>
            <span className="font-display font-bold text-ink text-lg tabular-nums">
              {totalTeams}
            </span>
            <span className="text-ink-muted uppercase tracking-[0.22em] text-xs">
              Teams bereit
            </span>
          </div>
          <div className="mx-auto max-w-md h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(readyCount / totalTeams) * 100}%`,
                background: 'linear-gradient(90deg, #7C5CFF 0%, #27D8FF 100%)',
                boxShadow: '0 0 20px rgba(124,92,255,0.65)',
              }}
            />
          </div>
        </div>

        <div className="mt-8 md:mt-10 flex justify-center">
          <button
            type="button"
            disabled={!allReady}
            onClick={() => {
              dispatch({ type: 'START_PLAYING' })
              navigate('/game')
            }}
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

        {/* Meta-Zeile */}
        <div className="mt-10 md:mt-12 flex justify-center">
          <div className="inline-flex items-center gap-4 md:gap-6 rounded-full bg-navy-800/70 border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-ink-muted">
            <span className="inline-flex items-center gap-2">
              <Gamepad2 className="h-3.5 w-3.5" />
              <span className="text-ink font-semibold normal-case tracking-normal">
                Heute: {state.round.gameModes.length} Modi
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
              Best of {state.round.bestOf}
            </span>
            <span className="text-ink-faint">·</span>
            <button
              className="text-brand-cyan-soft hover:text-brand-cyan transition-colors tracking-widest"
              onClick={() => dispatch({ type: 'BACK_TO_SETUP' })}
            >
              Ändern →
            </button>
          </div>
        </div>
      </div>
    </ScreenLayout>
  )
}

// ---------- Player-Setup -----------------------------------------------------

interface PlayerSetupSectionProps {
  round: RoundConfig
  dispatch: (action: GameAction) => void
}

function PlayerSetupSection({ round, dispatch }: PlayerSetupSectionProps) {
  return (
    <section className="mt-10 md:mt-14">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <div className="eyebrow inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-purple-soft" />
            Wer spielt mit — und worauf steht ihr?
          </div>
          <p className="mt-2 text-ink-muted text-sm max-w-2xl leading-relaxed">
            Namen und Interessen sind optional. Die App zieht daraus eure Runde:
            gemeinsame Interessen bekommen mehr Gewicht in der Blitzrunde, im
            Kategorien-Grid leuchten sie auf.
          </p>
        </div>
        <div className="text-right text-xs uppercase tracking-[0.22em] text-ink-muted whitespace-nowrap">
          <span className="text-ink font-semibold tabular-nums">{round.players.length}</span>{' '}
          Spieler
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {round.teams.map((team) => {
          const teamPlayers = round.players.filter((p) => p.teamId === team.id)
          return (
            <TeamPlayerCard
              key={team.id}
              team={team}
              players={teamPlayers}
              dispatch={dispatch}
            />
          )
        })}
      </div>

      <PlayerLibraryPanel round={round} dispatch={dispatch} />
    </section>
  )
}

interface TeamPlayerCardProps {
  team: Team
  players: Player[]
  dispatch: (action: GameAction) => void
}

function TeamPlayerCard({ team, players, dispatch }: TeamPlayerCardProps) {
  const hex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
  const canRemove = players.length > 1
  const canAdd = players.length < 4

  return (
    <div
      className="rounded-card border border-white/[0.08] bg-navy-800/60 p-4 md:p-5"
      style={{ boxShadow: `inset 0 0 0 1px ${hex}22` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center font-display font-bold text-xs border-2',
            team.color === 'purple'
              ? 'text-brand-purple-soft border-brand-purple/60 bg-brand-purple/15'
              : 'text-brand-cyan-soft border-brand-cyan/60 bg-brand-cyan/15',
          )}
        >
          {team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow" style={{ color: hex }}>
            {team.name}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {players.map((player, idx) => (
          <PlayerRow
            key={player.id}
            player={player}
            placeholderIndex={idx + 1}
            canRemove={canRemove}
            teamAccentHex={hex}
            dispatch={dispatch}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_PLAYER', teamId: team.id })}
        disabled={!canAdd}
        className={cn(
          'mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em]',
          'text-ink-muted hover:text-ink transition-colors',
          !canAdd && 'opacity-40 cursor-not-allowed',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Spieler hinzufügen
      </button>
    </div>
  )
}

interface PlayerRowProps {
  player: Player
  placeholderIndex: number
  canRemove: boolean
  teamAccentHex: string
  dispatch: (action: GameAction) => void
}

function PlayerRow({ player, placeholderIndex, canRemove, teamAccentHex, dispatch }: PlayerRowProps) {
  const [avatarOpen, setAvatarOpen] = useState(false)
  const levelByTopic = new Map<string, SkillLevel>()
  for (const { topic, level } of player.interests) levelByTopic.set(topic, level)

  return (
    <div className="rounded-lg border border-white/[0.06] bg-navy-900/60 p-3">
      <div className="flex items-center gap-2 relative">
        <button
          type="button"
          onClick={() => setAvatarOpen((v) => !v)}
          aria-label="Avatar bearbeiten"
          className="shrink-0 relative"
        >
          <AvatarBadge avatar={player.avatar} size="md" teamHex={teamAccentHex} />
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
          style={{ caretColor: teamAccentHex }}
        />
        {canRemove && (
          <button
            type="button"
            aria-label="Spieler entfernen"
            onClick={() => dispatch({ type: 'REMOVE_PLAYER', playerId: player.id })}
            className="text-ink-muted hover:text-wrong transition-colors p-1"
          >
            <UserMinus className="h-4 w-4" />
          </button>
        )}
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
      <div className="mt-2 flex flex-wrap gap-1.5">
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

// ---------- Interest-Chip mit Level-Cycle ------------------------------------

const LEVEL_LABEL: Record<SkillLevel, string> = {
  bisschen: 'bisschen',
  gut: 'gut',
  nerd: 'nerd',
}

const LEVEL_STYLE: Record<SkillLevel, string> = {
  bisschen: 'bg-brand-purple/10 border-brand-purple/40 text-brand-purple-soft',
  gut: 'bg-brand-purple/25 border-brand-purple/70 text-brand-purple-soft',
  nerd:
    'bg-brand-purple/40 border-brand-purple/90 text-white shadow-[0_0_18px_-4px_rgba(124,92,255,0.9)]',
}

const LEVEL_DOTS: Record<SkillLevel, number> = { bisschen: 1, gut: 2, nerd: 3 }

function nextLevel(current: SkillLevel | undefined): SkillLevel | null {
  if (!current) return 'bisschen'
  if (current === 'bisschen') return 'gut'
  if (current === 'gut') return 'nerd'
  return null
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
  return (
    <div
      className="absolute top-full left-0 mt-2 z-20 w-72 rounded-card border border-white/10 bg-navy-800 p-3 shadow-neon-purple"
      role="dialog"
      aria-label="Avatar wählen"
    >
      <div className="flex items-center justify-between mb-2">
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
      <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Symbol
      </div>
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {AVATAR_EMOJIS.map((emoji) => {
          const isOn = emoji === avatar.emoji
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange({ ...avatar, emoji })}
              className={cn(
                'h-9 w-9 rounded-lg border flex items-center justify-center text-lg leading-none',
                'transition-colors',
                isOn
                  ? 'border-brand-purple/80 bg-brand-purple/25'
                  : 'border-white/10 bg-navy-900/60 hover:border-white/25',
              )}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          )
        })}
      </div>
      <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Farbe
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

  // Bibliothek neu einlesen wenn sich die Menge aktiver Player ändert.
  useEffect(() => {
    setProfiles(readPlayerLibrary().filter((p) => !activeIds.has(p.id)))
    // Zwar würde ein direkter Read reichen; useEffect entkoppelt gegen doppelte
    // Renders und macht das Verhalten deterministischer.
    // Wir hängen an round.players über die Länge, um Endlos-Loops zu vermeiden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.players.length])

  if (profiles.length === 0) return null

  const teamOptions = round.teams

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="eyebrow inline-flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-brand-cyan-soft" />
            Bekannte Spieler
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Profile aus vergangenen Abenden. Klick fügt sie zu einem Team hinzu.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {profiles.slice(0, 10).map((profile) => (
          <LibraryChip
            key={profile.id}
            profile={profile}
            teamOptions={teamOptions}
            onAdd={(teamId) =>
              dispatch({ type: 'ADD_PLAYER_FROM_LIBRARY', teamId, profile })
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
  teamOptions: Team[]
  onAdd: (teamId: string) => void
  onForget: () => void
}

function LibraryChip({ profile, teamOptions, onAdd, onForget }: LibraryChipProps) {
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
        <AvatarBadge avatar={profile.avatar} size="sm" />
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
            zu Team hinzufügen
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            {teamOptions.map((team) => {
              const hex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => {
                    onAdd(team.id)
                    setOpen(false)
                  }}
                  className="h-8 rounded-lg px-2 flex items-center gap-2 text-sm text-ink hover:bg-white/[0.06]"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: hex, boxShadow: `0 0 8px ${hex}80` }}
                  />
                  <span>{team.name}</span>
                </button>
              )
            })}
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
