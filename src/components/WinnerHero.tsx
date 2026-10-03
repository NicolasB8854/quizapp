/**
 * Sieger-Moment: Krone über dem Gewinner-Team plus Mitglieder.
 * Wird im Single-Device-Scoreboard und im Multi-Device-Endstand genutzt.
 */
import { Crown } from 'lucide-react'
import type { Player, Team } from '@quizapp/shared'
import { getTeamColorHex } from '@quizapp/shared'
import { AvatarBadge } from '@/components/AvatarBadge'
import { cn } from '@/lib/classnames'

/** Team mit den meisten Match-Punkten; null bei Gleichstand an der Spitze. */
export function findMatchWinner(teams: readonly Team[], matchPoints: Record<string, number>): Team | null {
  if (teams.length === 0) return null
  const sorted = [...teams].sort((a, b) => (matchPoints[b.id] ?? 0) - (matchPoints[a.id] ?? 0))
  const top = matchPoints[sorted[0].id] ?? 0
  const second = sorted[1] ? matchPoints[sorted[1].id] ?? 0 : -1
  return top > second ? sorted[0] : null
}

export function WinnerHero({
  winner,
  players,
  subtitle,
  large = false,
}: {
  winner: Team | null
  players: readonly Player[]
  subtitle?: string
  large?: boolean
}) {
  const hex = winner ? getTeamColorHex(winner.color) : null
  const members = winner ? players.filter((p) => p.teamId === winner.id) : []
  return (
    <div className="text-center">
      <div className="relative mx-auto inline-flex flex-col items-center">
        {winner && (
          <Crown
            aria-hidden
            className={cn(
              'animate-titleIn text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.75)]',
              large ? 'h-16 w-16 md:h-20 md:w-20' : 'h-12 w-12',
            )}
            fill="currentColor"
          />
        )}
        <div className={cn('mt-2 eyebrow', !winner && 'text-ink-muted')}>
          {winner ? 'Sieger des Abends' : 'Unentschieden'}
        </div>
        <h2
          className={cn(
            'mt-2 font-display font-bold uppercase leading-[0.9] tracking-tight',
            large ? 'text-5xl md:text-7xl' : 'text-4xl',
          )}
          style={hex ? { color: hex, textShadow: `0 0 24px ${hex}88` } : undefined}
        >
          {winner ? winner.name : 'Ehrenvolles Remis'}
        </h2>
      </div>
      {members.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {members.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <div className="relative">
                <Crown
                  aria-hidden
                  className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 text-amber-300"
                  fill="currentColor"
                />
                <AvatarBadge avatar={p.avatar} size="sm" teamHex={hex ?? undefined} name={p.name} />
              </div>
              <span className="text-xs text-white/80">{p.name || 'Namenlos'}</span>
            </div>
          ))}
        </div>
      )}
      {subtitle && <p className="mt-3 text-sm text-ink-muted">{subtitle}</p>}
    </div>
  )
}
