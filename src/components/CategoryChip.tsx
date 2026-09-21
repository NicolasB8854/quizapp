/**
 * CategoryChip — prominenter Kategorien-Header über der Frage (Session U).
 *
 * Angelehnt an das TV-Show-Mockup: großer Neon-Rahmen mit
 *  - Kategorie-Name (uppercase, Show-Grotesk)
 *  - Großer Punktewert (extrafett)
 *  - Topic-Emoji rechts als „Trophäe" — bei den echten Studio-Sendern ein 3D-
 *    Rendering (Basketball, Filmklappe etc.); wir nutzen das Topic-Emoji als
 *    leichtgewichtigen Prototyp-Platzhalter.
 *
 * Der Chip liegt bewusst frei über dem Frage-Panel und trägt seinen eigenen
 * Neon-Glow — er ist der Anker für das „aktuelle Feld".
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/classnames'

interface Props {
  categoryLabel: ReactNode
  points: number
  emoji?: string
  /** Farbtoken (Hex) für den Neon-Rahmen. Default: brand-purple. */
  accentHex?: string
  className?: string
}

export function CategoryChip({
  categoryLabel,
  points,
  emoji,
  accentHex = '#7C5CFF',
  className,
}: Props) {
  return (
    <div className={cn('flex justify-center', className)}>
      <div
        className={cn(
          'relative inline-flex items-center gap-4 md:gap-6',
          'rounded-2xl px-6 md:px-8 py-3 md:py-4',
          'border-2',
        )}
        style={{
          borderColor: `${accentHex}A0`,
          background: 'rgba(11,16,32,0.75)',
          boxShadow:
            `0 0 0 1px ${accentHex}55, ` +
            `0 0 22px ${accentHex}80, ` +
            `0 0 60px -8px ${accentHex}66`,
        }}
      >
        {/* Text-Block */}
        <div className="text-center">
          <div className="font-display font-bold uppercase tracking-[0.28em] text-white/95 text-sm md:text-base leading-none">
            {categoryLabel}
          </div>
          <div
            className="mt-1 font-display font-extrabold tabular-nums text-4xl md:text-5xl leading-none text-white"
            style={{
              textShadow: `0 0 10px ${accentHex}CC, 0 0 24px ${accentHex}66`,
            }}
          >
            {points}
          </div>
        </div>

        {/* Emoji-Trophäe rechts, wenn vorhanden */}
        {emoji && (
          <div
            className="shrink-0 h-14 w-14 md:h-16 md:w-16 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(11,16,32,0.6)',
              border: `1px solid ${accentHex}66`,
              boxShadow: `inset 0 0 24px ${accentHex}33`,
            }}
          >
            <span className="text-3xl md:text-4xl" aria-hidden>
              {emoji}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
