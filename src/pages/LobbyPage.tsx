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
import { ArrowLeft, Play, Check, Gamepad2, Clock, Trophy, Sparkles, Plus, UserMinus, Users } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { useGame, type GameAction } from '@/context/GameContext'
import { MODES_BY_ID } from '@/data/modes'
import { TOPICS, TOPICS_BY_ID } from '@/data/topics'
import type { Topic } from '@/types/question'
import type { Player, RoundConfig, Team } from '@/types/round'
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
  const selectedInterests = new Set(player.interests)
  return (
    <div className="rounded-lg border border-white/[0.06] bg-navy-900/60 p-3">
      <div className="flex items-center gap-2">
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
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TOPICS.map((topic) => {
          const isOn = selectedInterests.has(topic.id)
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => {
                const next = isOn
                  ? player.interests.filter((t) => t !== topic.id)
                  : [...player.interests, topic.id]
                dispatch({
                  type: 'SET_PLAYER_INTERESTS',
                  playerId: player.id,
                  interests: next,
                })
              }}
              aria-pressed={isOn}
              title={topic.label}
              className={cn(
                'inline-flex items-center gap-1 h-7 rounded-full px-2.5',
                'text-[11px] font-medium transition-all border',
                isOn
                  ? 'bg-brand-purple/25 border-brand-purple/70 text-brand-purple-soft'
                  : 'bg-navy-800/70 border-white/10 text-ink-muted hover:border-white/25 hover:text-ink',
              )}
            >
              <span aria-hidden>{topic.emoji}</span>
              <span>{topic.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- „Euer Mix"-Panel -------------------------------------------------

interface PreviewPanelProps {
  round: RoundConfig
}

function InterestsPreviewPanel({ round }: PreviewPanelProps) {
  // Zähle, wie oft jedes Topic gewählt wurde. Ab 2 → shared, sonst individual.
  const counts = new Map<Topic, number>()
  for (const p of round.players) {
    for (const t of p.interests) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  const shared: Topic[] = []
  const individual: Topic[] = []
  for (const [t, n] of counts) {
    if (n >= 2) shared.push(t)
    else individual.push(t)
  }
  const totalInterests = counts.size
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
        <div className="eyebrow inline-flex items-center gap-2 text-brand-purple-soft">
          <Sparkles className="h-3.5 w-3.5" />
          Euer Mix für heute
        </div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
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
              <span
                key={t}
                className="inline-flex items-center gap-1 h-7 rounded-full px-2.5 text-[11px] font-medium border border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan-soft"
              >
                <span aria-hidden>{TOPICS_BY_ID[t].emoji}</span>
                <span>{TOPICS_BY_ID[t].label}</span>
              </span>
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
              <span
                key={t}
                className="inline-flex items-center gap-1 h-7 rounded-full px-2.5 text-[11px] font-medium border border-white/10 bg-navy-900/60 text-ink-muted"
              >
                <span aria-hidden>{TOPICS_BY_ID[t].emoji}</span>
                <span>{TOPICS_BY_ID[t].label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
