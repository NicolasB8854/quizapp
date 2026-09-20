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
import { ArrowLeft, Play, Check, Gamepad2, Clock, Trophy } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { useGame } from '@/context/GameContext'
import { MODES_BY_ID } from '@/data/modes'
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
