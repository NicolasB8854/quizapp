/**
 * A/B/C/D-Antwort-Fläche im Show-Look aus dem Gameplay-Mockup.
 *
 * Zentrales visuelles Element ist der KREIS-Chip mit dem Buchstaben — als leuchtende
 * Neon-Kontur (Purple im Idle, Cyan im Selected, Green/Red nach Reveal). Der Textkörper
 * daneben bleibt zurückhaltend.
 *
 * Statuslogik:
 *  - `idle`     → dezenter Purple-Outline-Kreis, weiche Card-Border
 *  - `selected` → Cyan-Kreis + Card-Neon-Ring in Cyan
 *  - `correct`  → grüner Kreis + grüne Card-Border, kurzer Flash-Effekt
 *  - `wrong`    → roter Kreis + roter Card-Pulse (nur die falsch getippte Option)
 *  - `dimmed`   → nach Reveal die restlichen Optionen leicht zurückgenommen
 */

import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/classnames'

export type AnswerStatus = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  letter: string
  status?: AnswerStatus
}

const wrapperByStatus: Record<AnswerStatus, string> = {
  idle:
    'bg-navy-800/70 border-white/10 hover:border-brand-purple/50 hover:bg-navy-700/80',
  selected:
    'bg-navy-700 border-brand-cyan/60 shadow-neon-cyan',
  correct:
    'bg-navy-700 border-correct/60 shadow-glow-correct animate-flashOk',
  wrong:
    'bg-navy-700 border-wrong/60 shadow-glow-wrong animate-pulseWrong',
  dimmed:
    'bg-navy-800/50 border-white/5 opacity-55',
}

const circleByStatus: Record<AnswerStatus, string> = {
  idle:
    'border-brand-purple/60 text-brand-purple-soft ' +
    'shadow-[0_0_0_1px_rgba(124,92,255,0.35),0_0_22px_-4px_rgba(124,92,255,0.75)]',
  selected:
    'border-brand-cyan text-brand-cyan-soft ' +
    'shadow-[0_0_0_1px_rgba(39,216,255,0.5),0_0_24px_-4px_rgba(39,216,255,0.85)]',
  correct:
    'border-correct text-correct ' +
    'shadow-[0_0_0_1px_rgba(63,217,139,0.5),0_0_24px_-4px_rgba(63,217,139,0.85)]',
  wrong:
    'border-wrong text-wrong ' +
    'shadow-[0_0_0_1px_rgba(255,92,122,0.5),0_0_24px_-4px_rgba(255,92,122,0.85)]',
  dimmed:
    'border-white/15 text-ink-muted',
}

export function AnswerOption({ letter, status = 'idle', className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={status === 'selected'}
      className={cn(
        'group w-full text-left rounded-card border transition-all duration-200',
        'flex items-center gap-4 md:gap-5 p-4 md:p-5',
        'disabled:cursor-default',
        wrapperByStatus[status],
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          'shrink-0 h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center',
          'border-2 bg-navy-900/60',
          'font-display font-bold text-lg md:text-xl transition-all',
          circleByStatus[status],
        )}
      >
        {letter}
      </span>
      <span className="text-ink text-base md:text-lg leading-snug font-medium">
        {children}
      </span>
    </button>
  )
}
