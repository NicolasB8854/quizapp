/**
 * AvatarBadge — rendert die Spieler-Identität (Emoji + Farb-Ring).
 *
 * Bewusst simpel: farbiger Kreis mit Emoji darin. Der Rand-Ring nimmt die
 * Avatar-Farbe auf, der Innenraum ist dezent getönt. In `size="lg"` mit
 * subtilem Glow — für die Bühne. In `size="sm"`/`md` klar für Listen und
 * Chips.
 */

import type { Avatar } from '@/types/round'
import { cn } from '@/lib/classnames'

type Size = 'sm' | 'md' | 'lg'

interface Props {
  avatar: Avatar
  size?: Size
  /** Zusätzlicher Ring in Team-Farbe (Sidebar-Kontext). */
  teamHex?: string
  className?: string
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-7 w-7 text-sm',
  md: 'h-10 w-10 text-lg',
  lg: 'h-14 w-14 md:h-16 md:w-16 text-2xl md:text-3xl',
}

export function AvatarBadge({ avatar, size = 'md', teamHex, className }: Props) {
  const ringHex = teamHex ?? avatar.colorHex
  return (
    <span
      role="img"
      aria-label="Avatar"
      className={cn(
        'inline-flex items-center justify-center rounded-full border-2 leading-none',
        'select-none',
        SIZE_CLASSES[size],
        className,
      )}
      style={{
        borderColor: `${ringHex}CC`,
        background: `${avatar.colorHex}22`,
        boxShadow:
          size === 'lg'
            ? `0 0 0 1px ${ringHex}55, 0 0 22px -6px ${avatar.colorHex}CC`
            : `0 0 0 1px ${ringHex}40`,
      }}
    >
      <span aria-hidden>{avatar.emoji}</span>
    </span>
  )
}
