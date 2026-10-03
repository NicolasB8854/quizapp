/**
 * Quiz Director im UI: Dauer wählen → Abend wird zusammengestellt.
 * Im Setup (noch ohne Spieler) mit Schätzwerten, in der Lobby mit der echten Gruppe.
 */
import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { directEvening, MODES_BY_ID, minutesOf, type GameModeId } from '@quizapp/shared'
import { Button } from '@/components/Button'
import { track } from '@/lib/insightsApi'
import { cn } from '@/lib/classnames'

const DURATIONS = [30, 45, 60, 90] as const

export function DirectorPanel({
  playerCount,
  teamCount,
  playersWithInterests,
  disabled,
  onApply,
  hint,
}: {
  playerCount: number
  teamCount: number
  playersWithInterests: number
  disabled?: boolean
  onApply: (modes: GameModeId[]) => void
  hint?: string
}) {
  const [minutes, setMinutes] = useState<(typeof DURATIONS)[number]>(60)
  const [preview, setPreview] = useState<GameModeId[] | null>(null)

  const compose = () => {
    const plan = directEvening({ minutes, playerCount, teamCount, playersWithInterests })
    setPreview(plan)
    onApply(plan)
    track('director_used')
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-brand-purple/50 bg-brand-purple/10 p-4 shadow-[0_0_28px_-10px_rgba(139,61,255,0.8)]">
      <div className="flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-brand-purple-soft" aria-hidden />
        <div>
          <div className="font-display text-base font-bold text-white">Quiz Director</div>
          <div className="text-xs text-ink-muted">{hint ?? 'Wir stellen euren Abend zusammen — mit Warm-up und Finale.'}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dauer des Abends">
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={minutes === m}
            onClick={() => setMinutes(m)}
            className={cn(
              'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
              minutes === m ? 'border-brand-purple bg-brand-purple/30 text-white' : 'border-white/15 text-ink-muted hover:text-white',
            )}
          >
            {m} min
          </button>
        ))}
      </div>
      <Button variant="primary" className="w-full" onClick={compose} disabled={disabled} leading={<Wand2 className="h-4 w-4" />}>
        Abend zusammenstellen
      </Button>
      {preview && (
        <ol className="space-y-1 text-sm">
          {preview.map((id, i) => (
            <li key={id} className="flex items-center gap-2 text-white/85">
              <span className="w-5 text-right font-mono text-xs text-ink-muted">{i + 1}.</span>
              {MODES_BY_ID[id]?.name}
              {i === 0 && <span className="text-xs text-brand-cyan-soft">Warm-up</span>}
              {i === preview.length - 1 && <span className="text-xs text-amber-200">Finale</span>}
            </li>
          ))}
          <li className="pt-1 text-xs text-ink-muted">≈ {minutesOf(preview)} Minuten · du kannst unten noch anpassen</li>
        </ol>
      )}
    </div>
  )
}
