/**
 * Lobby-Bausteine im Show-Look: Schritt-Anzeige, Panels, Modus-Kacheln,
 * Team-Karten mit Avataren und eine feste Start-Leiste im Daumenbereich.
 */
import type { ReactNode } from 'react'
import { Check, Clock } from 'lucide-react'
import type { GameMode, Player, TeamColor } from '@quizapp/shared'
import { getTeamColorHex, TOPICS_BY_ID } from '@quizapp/shared'
import { AvatarBadge } from '@/components/AvatarBadge'
import { cn } from '@/lib/classnames'
import { modeImage } from '@/lib/modeImage'

// ---------- Schritte ---------------------------------------------------------

const STEPS = ['Modi', 'Teams & Profil', 'Los geht’s'] as const

export function LobbySteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Fortschritt">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                done && 'border-correct bg-correct/20 text-correct',
                active && 'border-brand-purple bg-brand-purple/25 text-white shadow-neon-purple',
                !done && !active && 'border-white/15 text-ink-muted',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('truncate text-xs font-semibold', active ? 'text-white' : 'text-ink-muted')}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-white/10" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

// ---------- Panel ------------------------------------------------------------

export function ShowPanel({
  eyebrow,
  title,
  action,
  children,
  accent = false,
  className,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'space-y-3 rounded-card border-2 bg-navy-900/80 p-4 backdrop-blur md:p-5',
        accent
          ? 'border-brand-purple/50 shadow-[0_0_0_1px_rgba(124,92,255,0.2),0_0_32px_-8px_rgba(124,92,255,0.5)]'
          : 'border-white/10',
        className,
      )}
    >
      {(eyebrow || title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow text-brand-purple-soft">{eyebrow}</div>}
            {title && <h2 className="mt-0.5 font-display text-lg font-bold text-white">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// ---------- Modus-Kachel -----------------------------------------------------

export function ModeTile({
  mode,
  selected,
  onToggle,
  disabled,
  compact = false,
}: {
  mode: GameMode
  selected: boolean
  onToggle: () => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border-2 text-left transition-all disabled:opacity-40',
        compact ? 'p-3' : 'p-4',
        selected
          ? 'border-brand-purple bg-brand-purple/15 shadow-[0_0_24px_-8px_rgba(124,92,255,0.8)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25',
      )}
    >
      {/* Studio-Motiv als dezenter Hintergrund der Kachel */}
      <img
        src={modeImage(mode.id)}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className={cn('absolute inset-0 h-full w-full object-cover', selected ? 'opacity-35' : 'opacity-20')}
      />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-navy-900/90 via-navy-900/70 to-navy-900/30" />
      <span
        aria-hidden
        className={cn(
          'absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2',
          selected ? 'border-brand-purple bg-brand-purple text-white' : 'border-white/25 text-transparent',
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
      <div className="relative pr-8">
        <div className="text-xs uppercase tracking-[0.2em] text-brand-purple-soft">{mode.chipLabel}</div>
        <div className="mt-0.5 font-display text-base font-bold text-white">{mode.name}</div>
        {!compact && <div className="mt-1 text-sm text-ink-muted">{mode.tagline}</div>}
        <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-muted">
          <Clock className="h-3 w-3" aria-hidden /> ~{mode.estimatedMinutes} min
        </div>
      </div>
    </button>
  )
}

// ---------- Team-Karte -------------------------------------------------------

export function TeamCard({
  team,
  members,
  myPlayerId,
  onJoin,
  joinDisabled,
}: {
  team: { id: string; name: string; color: TeamColor }
  members: readonly Player[]
  myPlayerId: string | null
  /** Gesetzt = „Beitreten"-Knopf (nur für den eigenen Spieler). */
  onJoin?: () => void
  joinDisabled?: boolean
}) {
  const hex = getTeamColorHex(team.color)
  const isMine = members.some((p) => p.id === myPlayerId)
  return (
    <div
      className="space-y-2 rounded-2xl border-2 bg-navy-900/70 p-3"
      style={{
        borderColor: isMine ? hex : `${hex}55`,
        boxShadow: isMine ? `0 0 28px -8px ${hex}` : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: hex, boxShadow: `0 0 10px ${hex}` }} />
        <span className="font-display font-bold text-white">{team.name}</span>
        <span className="text-xs text-ink-muted">· {members.length}</span>
        {onJoin && !isMine && (
          <button
            type="button"
            onClick={onJoin}
            disabled={joinDisabled}
            className="ml-auto rounded-full border px-3 py-1 text-xs font-semibold text-white transition-colors disabled:opacity-40"
            style={{ borderColor: `${hex}AA`, background: `${hex}22` }}
          >
            Beitreten
          </button>
        )}
        {isMine && <span className="ml-auto text-xs font-semibold" style={{ color: hex }}>Dein Team</span>}
      </div>
      {members.length === 0 ? (
        <p className="text-xs text-ink-muted">Noch niemand.</p>
      ) : (
        <ul className="space-y-1.5">
          {members.map((p) => (
            <PlayerLine key={p.id} player={p} isMe={p.id === myPlayerId} teamHex={hex} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function PlayerLine({ player, isMe, teamHex }: { player: Player; isMe: boolean; teamHex?: string }) {
  return (
    <li className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', isMe ? 'bg-white/[0.07]' : 'bg-white/[0.02]')}>
      <AvatarBadge avatar={player.avatar} size="sm" teamHex={teamHex} name={player.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('truncate text-sm', isMe ? 'font-semibold text-white' : 'text-white/85')}>
            {player.name || 'Namenlos'}
          </span>
          {isMe && <span className="text-xs text-brand-purple-soft">du</span>}
        </span>
        {player.avatar.title && <span className="block truncate text-xs text-amber-200">{player.avatar.title}</span>}
      </span>
      {player.interests.length > 0 && (
        <span className="flex gap-0.5" aria-label="Interessen">
          {player.interests.slice(0, 4).map((i) => (
            <span key={i.topic} title={TOPICS_BY_ID[i.topic]?.label} className="text-sm">
              {TOPICS_BY_ID[i.topic]?.emoji}
            </span>
          ))}
        </span>
      )}
    </li>
  )
}

// ---------- Start-Leiste -----------------------------------------------------

/** Feste Aktionsleiste unten (Daumenbereich, Safe-Area). */
export function StickyCta({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 space-y-1.5 bg-gradient-to-t from-navy-900 via-navy-900/95 to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-5 md:-mx-6 md:px-6">
      {hint && <p className="text-center text-xs text-ink-muted">{hint}</p>}
      {children}
    </div>
  )
}
