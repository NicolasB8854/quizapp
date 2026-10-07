/**
 * Schmale Match-Leiste während des Spiels (alle Geräte): Modus X / Y, Match-Stand
 * und — ab 3 Modi — der Hinweis, dass der Sieg im Finale doppelt zählt.
 * Ohne den Hinweis wirkt ein Remis nach 2:1 wie ein Fehler.
 */
import type { GameState } from '@quizapp/shared'
import { FINALE_MIN_MODES, getTeamColorHex, matchPointsForMode } from '@quizapp/shared'
import { cn } from '@/lib/classnames'

export function finaleHint(modeIndex: number, totalModes: number): string | null {
  if (totalModes < FINALE_MIN_MODES) return null
  if (modeIndex === totalModes - 1) return 'Finale: Sieg zählt doppelt (2 Punkte)'
  return `Finale (Modus ${totalModes}) zählt doppelt`
}

export function MatchProgress({ state, stage }: { state: GameState; stage: boolean }) {
  const round = state.round
  if (!round || round.gameModes.length < 2) return null
  const total = round.gameModes.length
  const idx = state.currentModeIndex
  const isFinale = matchPointsForMode(idx, total) === 2
  const hint = finaleHint(idx, total)
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2',
        isFinale ? 'border-amber-300/60 bg-amber-300/10' : 'border-white/10 bg-white/[0.03]',
        stage ? 'text-base' : 'text-xs',
      )}
      role="status"
    >
      <span className="font-semibold uppercase tracking-[0.2em] text-white/60">
        Modus {idx + 1} / {total}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {round.teams.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5 text-white/85">
            <span className="h-2 w-2 rounded-full" style={{ background: getTeamColorHex(t.color) }} />
            {t.name} <span className="font-mono font-bold text-white">{state.matchPoints[t.id] ?? 0}</span>
          </span>
        ))}
      </span>
      {hint && (
        <span className={cn('ml-auto font-semibold', isFinale ? 'text-amber-200' : 'text-white/55')}>
          {isFinale ? '×2 ' : ''}
          {hint}
        </span>
      )}
    </div>
  )
}
