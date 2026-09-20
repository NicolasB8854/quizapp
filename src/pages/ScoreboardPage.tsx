/**
 * Abschluss-Screen — der Sieger-Moment.
 *
 * PDF: „Finale / Sieg → größere Animation, Confetti optional". Für den Prototyp genügen
 * dezente Glow-Layer und ein kurzer Titel-In-Animationslauf. Ein echtes Confetti-Rendering
 * kann später ergänzt werden (kein zusätzliches Paket dafür in v0.1).
 *
 * Zwei CTAs am Fuß: „Nochmal mit denselben Teams" (springt zurück in die Lobby, neuer
 * Room-Code) oder „Neuer Abend" (reset auf Startseite).
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, RotateCcw, Home } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { useGame } from '@/context/GameContext'
import { MODES_BY_ID } from '@/data/modes'
import { cn } from '@/lib/classnames'

export default function ScoreboardPage() {
  const navigate = useNavigate()
  const { state, dispatch, matchWinner } = useGame()

  useEffect(() => {
    if (state.phase === 'setup')   navigate('/setup', { replace: true })
    if (state.phase === 'lobby')   navigate('/lobby', { replace: true })
    if (state.phase === 'playing') navigate('/game', { replace: true })
  }, [state.phase, navigate])

  if (!state.round) return null
  const { teams } = state.round

  return (
    <ScreenLayout headerMeta="Ergebnis · Endstand">
      <div className="mx-auto max-w-5xl pt-4 md:pt-10 pb-16 animate-titleIn">
        {/* Sieger-Fläche */}
        <div className="text-center">
          <div
            className="mx-auto h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center border-2"
            style={{
              borderColor: matchWinner
                ? matchWinner.color === 'purple'
                  ? 'rgba(124,92,255,0.7)'
                  : 'rgba(39,216,255,0.7)'
                : 'rgba(255,255,255,0.1)',
              boxShadow: matchWinner
                ? matchWinner.color === 'purple'
                  ? '0 0 0 1px rgba(124,92,255,0.4), 0 0 40px rgba(124,92,255,0.55)'
                  : '0 0 0 1px rgba(39,216,255,0.4), 0 0 40px rgba(39,216,255,0.55)'
                : undefined,
              background: 'rgba(11,16,32,0.6)',
            }}
          >
            <Trophy
              className={cn(
                'h-10 w-10 md:h-12 md:w-12',
                matchWinner
                  ? matchWinner.color === 'purple'
                    ? 'text-brand-purple-soft'
                    : 'text-brand-cyan-soft'
                  : 'text-ink-muted',
              )}
            />
          </div>
          <div className="mt-5 eyebrow">
            {matchWinner ? 'Sieger des Abends' : 'Unentschieden'}
          </div>
          <h1
            className={cn(
              'mt-3 font-display font-bold uppercase leading-[0.9] tracking-tight',
              'text-5xl md:text-7xl',
              matchWinner
                ? matchWinner.color === 'purple'
                  ? 'text-neon-purple'
                  : 'text-neon-cyan'
                : 'text-ink',
            )}
          >
            {matchWinner ? matchWinner.name : 'Ehrenvolles Remis'}
          </h1>
          <p className="mt-4 text-ink-muted max-w-md mx-auto">
            {matchWinner
              ? `${state.matchPoints[matchWinner.id] ?? 0} Match-Punkte in ${state.round.gameModes.length} Modi.`
              : 'Beide Teams haben gleich viele Modi gewonnen. Rematch, sofort.'}
          </p>
        </div>

        {/* Team-Zusammenfassung */}
        <div className="mt-10 md:mt-14 grid md:grid-cols-2 gap-4 md:gap-6">
          {teams.map((team) => {
            const isWinner = matchWinner?.id === team.id
            const totalPoints = state.results.reduce(
              (sum, r) => sum + (r.scores[team.id] ?? 0),
              0,
            )
            return (
              <Card
                key={team.id}
                glow={isWinner ? (team.color === 'purple' ? 'purple' : 'cyan') : null}
                className="p-6"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-11 w-11 rounded-full flex items-center justify-center font-display font-bold text-sm',
                        team.color === 'purple'
                          ? 'bg-brand-purple/25 text-brand-purple-soft'
                          : 'bg-brand-cyan/25 text-brand-cyan-soft',
                      )}
                    >
                      {team.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="eyebrow">Team</div>
                      <div className="font-display font-semibold text-lg">
                        {team.name}
                      </div>
                    </div>
                  </div>
                  {isWinner && <Badge tone={team.color === 'purple' ? 'purple' : 'cyan'}>Sieger</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Match-Punkte" value={state.matchPoints[team.id] ?? 0} />
                  <Stat label="Gesamtpunkte" value={totalPoints.toLocaleString('de-DE')} />
                </div>

                <div className="mt-5 hairline" />

                <div className="mt-4 space-y-2">
                  <div className="eyebrow">Modi-Bilanz</div>
                  {state.results.map((res, i) => {
                    const mode = MODES_BY_ID[res.gameModeId]
                    const wonThis = res.winnerTeamId === team.id
                    return (
                      <div
                        key={`${res.gameModeId}-${i}`}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-ink">{mode?.name ?? res.gameModeId}</span>
                        <span
                          className={cn(
                            'tabular-nums',
                            wonThis ? 'text-correct font-semibold' : 'text-ink-muted',
                          )}
                        >
                          {(res.scores[team.id] ?? 0).toLocaleString('de-DE')} P.
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Actions */}
        <div className="mt-10 md:mt-14 flex flex-col md:flex-row items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="lg"
            leading={<RotateCcw className="h-5 w-5" />}
            onClick={() => {
              dispatch({ type: 'GO_TO_LOBBY' })
              navigate('/lobby')
            }}
          >
            Nochmal mit denselben Teams
          </Button>
          <Button
            variant="primary"
            size="lg"
            leading={<Home className="h-5 w-5" />}
            onClick={() => {
              dispatch({ type: 'RESET_ALL' })
              navigate('/', { replace: true })
            }}
          >
            Neuer Abend
          </Button>
        </div>
      </div>
    </ScreenLayout>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-btn bg-navy-800 border border-white/5 px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-display font-bold text-2xl tabular-nums">{value}</div>
    </div>
  )
}
