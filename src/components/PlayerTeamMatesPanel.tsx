/**
 * Kompakter Team-Roster-Streifen für den Player während `phase='playing'`.
 *
 * Zeigt dem Player permanent:
 *  - Eigenen Team-Namen (in Team-Farbe, prominent).
 *  - Team-Kollegen als Avatar-Initialen mit „Du"-Markierung.
 *
 * Bewusst schmal gehalten (eine Zeile auf dem Handy), damit der eigentliche
 * Spiel-Content weiter oberste Priorität hat. Wird oberhalb des RoomView-
 * Contents angezeigt und persistiert über alle Modi.
 *
 * Für Master-Rolle nicht sinnvoll — der sieht Team-Roster ohnehin per Score-
 * Chips + Player-Namen in den Modi-Views.
 */

import type { Player, Team } from '@quizapp/shared'
import { getTeamColorHex } from '@quizapp/shared'
import { cn } from '@/lib/classnames'
import { AvatarBadge } from '@/components/AvatarBadge'

interface Props {
  team: Team
  myPlayer: Player
  teamPlayers: Player[]
}

export function PlayerTeamMatesPanel({ team, myPlayer, teamPlayers }: Props) {
  const color = getTeamColorHex(team.color)
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-white/[0.02] px-3 py-2"
      style={{
        borderColor: `${color}55`,
        boxShadow: `inset 0 0 0 1px ${color}22`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.28em] text-ink-muted">
            Dein Team
          </div>
          <div className="truncate text-sm font-semibold text-white">
            {team.name}
          </div>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {teamPlayers.map((p) => {
          const isMe = p.id === myPlayer.id
          return (
            <span key={p.id} title={isMe ? 'Du' : p.name || 'Namenlos'} className={cn('rounded-full', isMe && 'ring-2 ring-white/60')}>
              <AvatarBadge avatar={p.avatar} size="md" teamHex={color} name={p.name} />
            </span>
          )
        })}
      </div>
    </div>
  )
}
