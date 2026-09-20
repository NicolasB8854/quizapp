/**
 * Kleines Pillen-Label (Uppercase, tight-tracking) — für „Runde 1 von 3", „Bald verfügbar",
 * Kategorie-Chips im Frage-Modal etc. Bewusst zurückhaltend, damit es die Show-Elemente
 * nicht überlagert.
 */

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/classnames'

type Tone = 'muted' | 'purple' | 'cyan' | 'orange' | 'pink' | 'correct' | 'wrong' | 'gold'

const tones: Record<Tone, string> = {
  muted:   'bg-white/5 text-ink-muted border-white/10',
  purple:  'bg-brand-purple/15 text-brand-purple-soft border-brand-purple/30',
  cyan:    'bg-brand-cyan/15 text-brand-cyan-soft border-brand-cyan/30',
  orange:  'bg-brand-orange/15 text-brand-orange-soft border-brand-orange/30',
  pink:    'bg-brand-pink/15 text-brand-pink-soft border-brand-pink/30',
  correct: 'bg-correct/15 text-correct border-correct/30',
  wrong:   'bg-wrong/15 text-wrong border-wrong/30',
  gold:    'bg-mode-ladder/15 text-mode-ladder border-mode-ladder/30',
}

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  leading?: ReactNode
}

export function Badge({ tone = 'muted', leading, className, children, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ' +
          'text-[11px] font-medium uppercase tracking-[0.16em]',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
    </span>
  )
}
