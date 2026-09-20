/**
 * Setup-Screen — Teams benennen + Modi wählen.
 *
 * Zwei Sektionen:
 *  1. Teams: 2 Teams mit fest zugewiesenen Marken-Farben (Purple/Cyan). Nur die Namen sind
 *     editierbar. Farb-Wechsel wäre für v0.1 unnötige Komplexität.
 *  2. Modi: Grid der Modus-Karten. Nur `ready`-Modi sind auswählbar; die anderen sind
 *     bewusst mit sichtbar, damit die Roadmap gleich mitkommuniziert wird.
 */

import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ModeCard } from '@/components/ModeCard'
import { MODES } from '@/data/modes'
import { useGame } from '@/context/GameContext'
import { cn } from '@/lib/classnames'

export default function SetupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { state, dispatch } = useGame()

  const flow = searchParams.get('flow') === 'free' ? 'free' : 'night'

  // Wenn schon eine Runde läuft, zurück in den passenden Screen springen.
  useEffect(() => {
    if (state.phase === 'lobby')      navigate('/lobby', { replace: true })
    if (state.phase === 'playing')    navigate('/game', { replace: true })
    if (state.phase === 'scoreboard') navigate('/scoreboard', { replace: true })
  }, [state.phase, navigate])

  const canProceed = state.draft.selectedModes.length > 0

  return (
    <ScreenLayout
      variant="dim"
      navActions={
        <Button variant="ghost" size="md" leading={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/')}>
          Zurück
        </Button>
      }
      headerMeta={flow === 'free' ? 'Freies Spiel · Setup' : 'Kuratierter Abend · Setup'}
    >
      <div className="mx-auto max-w-6xl space-y-8 pt-2 md:pt-6 pb-28">
        {/* Kopfzeile */}
        <div>
          <div className="eyebrow">Schritt 1 von 2</div>
          <h1 className="mt-3 font-display font-bold uppercase leading-[0.95] tracking-tight text-white text-4xl md:text-6xl">
            Wer spielt <span className="text-neon-purple">heute Abend</span>?
          </h1>
          <p className="mt-4 text-ink-muted text-base max-w-2xl leading-relaxed">
            Zwei Teams treten gegeneinander an. Namen anpassen, Modi wählen, dann geht's in die Lobby.
          </p>
        </div>

        {/* Teams */}
        <Card className="p-5 md:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="eyebrow">Teams</div>
              <div className="mt-1 font-display font-semibold text-xl">Zwei Seiten, ein Abend</div>
            </div>
            <Badge tone="muted">Farben fest</Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {state.draft.teams.map((team) => (
              <TeamInput
                key={team.id}
                teamId={team.id}
                color={team.color}
                value={team.name}
                onChange={(name) => dispatch({ type: 'SET_TEAM_NAME', teamId: team.id, name })}
              />
            ))}
          </div>
        </Card>

        {/* Modi */}
        <div>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="eyebrow">Schritt 2 von 2 · Modi</div>
              <h2 className="mt-2 font-display font-semibold text-2xl md:text-3xl">
                {flow === 'free' ? 'Wähle einen Modus' : 'Stelle deinen Abend zusammen'}
              </h2>
              <p className="mt-2 text-ink-muted text-sm max-w-2xl">
                {flow === 'free'
                  ? 'Ein Modus, direkte Runde. Genau ein Format wählen — zweimal tippen wechselt oder deaktiviert.'
                  : 'Mehrere Modi hintereinander. Pro Modus gibt es einen Sieg — wer die meisten Modi gewinnt, gewinnt den Abend.'}
              </p>
            </div>
            <div className="text-right text-sm text-ink-muted">
              <span className="text-ink font-semibold">
                {state.draft.selectedModes.length}
              </span>{' '}
              gewählt
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODES.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                selected={state.draft.selectedModes.includes(mode.id)}
                onToggle={() => {
                  // Freies Spiel = genau ein Modus. Klick auf denselben leert die Auswahl,
                  // Klick auf anderen ersetzt. Kuratierter Abend behält die Multi-Toggle-
                  // Semantik für den Match-Tracker.
                  if (flow === 'free') {
                    const isAlreadyOnly =
                      state.draft.selectedModes.length === 1 &&
                      state.draft.selectedModes[0] === mode.id
                    dispatch({
                      type: 'SET_MODE_SELECTION',
                      modeIds: isAlreadyOnly ? [] : [mode.id],
                    })
                  } else {
                    dispatch({ type: 'TOGGLE_MODE', modeId: mode.id })
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sticky-Footer mit dem Weiter-CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/5 bg-navy-900/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-4 flex items-center justify-between gap-4">
          <div className="text-sm uppercase tracking-[0.2em] text-ink-muted">
            {canProceed
              ? 'Bereit? Ab in die Lobby.'
              : 'Wähle mindestens einen Modus, um weiterzumachen.'}
          </div>
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => {
              dispatch({ type: 'GO_TO_LOBBY' })
              navigate('/lobby')
            }}
            className={cn(
              'inline-flex items-center gap-3 h-14 px-7 rounded-full',
              'font-display font-bold uppercase tracking-widest text-white text-sm',
              'bg-cta shadow-neon-purple hover:brightness-110',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
              'transition-all',
            )}
          >
            Weiter zur Lobby
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </ScreenLayout>
  )
}

interface TeamInputProps {
  teamId: string
  color: 'purple' | 'cyan'
  value: string
  onChange: (v: string) => void
}

function TeamInput({ teamId, color, value, onChange }: TeamInputProps) {
  const chipClass =
    color === 'purple'
      ? 'bg-brand-purple/25 text-brand-purple-soft'
      : 'bg-brand-cyan/25 text-brand-cyan-soft'
  const borderClass =
    color === 'purple' ? 'focus-within:border-brand-purple/60' : 'focus-within:border-brand-cyan/60'

  return (
    <label
      htmlFor={`team-${teamId}`}
      className={`flex items-center gap-3 rounded-card border border-white/10 bg-navy-800 px-4 py-3 transition-colors ${borderClass}`}
    >
      <span className={`h-9 w-9 rounded-full flex items-center justify-center font-display font-bold text-sm ${chipClass}`}>
        {value.slice(0, 2).toUpperCase() || (color === 'purple' ? 'TN' : 'TP')}
      </span>
      <div className="flex-1">
        <div className="eyebrow">Team · {color === 'purple' ? 'Purple' : 'Cyan'}</div>
        <input
          id={`team-${teamId}`}
          type="text"
          value={value}
          maxLength={24}
          onChange={(e) => onChange(e.target.value)}
          placeholder={color === 'purple' ? 'Team Nova' : 'Team Pulsar'}
          className="mt-0.5 w-full bg-transparent font-display text-lg font-semibold text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>
    </label>
  )
}
