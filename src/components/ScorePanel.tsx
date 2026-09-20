/**
 * Score-Anzeige — permanent verfügbar, aber als kompakte Leiste (PDF: „Score permanent
 * verfügbar, jedoch als Side Panel oder kompakte Leiste"). Zwei Teams stehen sich frontal
 * gegenüber; die Zahl ist visuell dominant, die restlichen Meta-Infos zurücktretend.
 *
 * `highlightTeamId` bekommt einen kurzen Pop-Effekt (Show-Moment aus der PDF-Motion-Liste).
 */

import { useEffect, useRef, useState } from 'react'
import type { Team } from '@/types/round'
import { cn } from '@/lib/classnames'

interface Props {
  teams: Team[]
  scores: Record<string, number>
  matchPoints?: Record<string, number>
  currentTeamId?: string
  highlightTeamId?: string | null
}

const teamColorRing: Record<Team['color'], string> = {
  purple: 'ring-brand-purple/60 bg-brand-purple/10',
  cyan:   'ring-brand-cyan/60 bg-brand-cyan/10',
}

const teamColorAccent: Record<Team['color'], string> = {
  purple: 'text-brand-purple-soft',
  cyan:   'text-brand-cyan-soft',
}

export function ScorePanel({ teams, scores, matchPoints, currentTeamId, highlightTeamId }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      {teams.map((team) => (
        <TeamTile
          key={team.id}
          team={team}
          score={scores[team.id] ?? 0}
          matchPoints={matchPoints?.[team.id]}
          isActive={team.id === currentTeamId}
          highlight={team.id === highlightTeamId}
        />
      ))}
    </div>
  )
}

interface TileProps {
  team: Team
  score: number
  matchPoints?: number
  isActive: boolean
  highlight: boolean
}

function TeamTile({ team, score, matchPoints, isActive, highlight }: TileProps) {
  // Pop-Animation nur einmal pro Highlight-Wechsel — sonst „shimmert" der Score dauerhaft,
  // was Ablenkung erzeugt (Motion-Guardrail aus PDF).
  const [popKey, setPopKey] = useState(0)
  const lastHighlight = useRef(highlight)
  useEffect(() => {
    if (highlight && !lastHighlight.current) setPopKey((k) => k + 1)
    lastHighlight.current = highlight
  }, [highlight])

  return (
    <div
      className={cn(
        'rounded-card border p-4 md:p-5 transition-all',
        'bg-navy-700 border-white/10',
        isActive && `ring-2 ${teamColorRing[team.color]}`,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            aria-hidden
            className={cn(
              'shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-display font-bold text-sm',
              team.color === 'purple'
                ? 'bg-brand-purple/25 text-brand-purple-soft'
                : 'bg-brand-cyan/25 text-brand-cyan-soft',
            )}
          >
            {team.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink text-sm md:text-base">
              {team.name}
            </div>
            {typeof matchPoints === 'number' && (
              <div className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                {matchPoints} Match-Punkt{matchPoints === 1 ? '' : 'e'}
              </div>
            )}
          </div>
        </div>
        {isActive && (
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-[0.2em]',
              teamColorAccent[team.color],
            )}
          >
            Am Zug
          </span>
        )}
      </div>

      <div
        key={popKey}
        className={cn(
          'mt-3 font-display font-bold tabular-nums text-4xl md:text-5xl',
          highlight && 'animate-pop',
          teamColorAccent[team.color],
        )}
      >
        {score.toLocaleString('de-DE')}
      </div>
    </div>
  )
}
