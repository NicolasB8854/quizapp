/**
 * Button-System — genau ein Komponenten-Set für alle Screens (MVP-Regel im PDF:
 * „Ein Button-System"). Drei Varianten reichen für den Prototyp:
 *
 * - primary  → Purple-CTA, dominant, für Haupt-Aktionen
 * - secondary→ dunkle Outline auf Navy, für Neben-Aktionen
 * - ghost    → transparent, für tertiäre Aktionen (Zurück, Abbrechen)
 *
 * Größen: `md` für den Regelfall, `lg` für die zentrale Show-CTA im Home/Lobby.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/classnames'

type Variant = 'primary' | 'secondary' | 'ghost' | 'cyan'
type Size = 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leading?: ReactNode
  trailing?: ReactNode
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-btn font-semibold ' +
  'transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-navy-900 active:scale-[0.985]'

const sizes: Record<Size, string> = {
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-14 px-8 text-base tracking-wide',
}

const variants: Record<Variant, string> = {
  primary:
    'text-white bg-cta shadow-glow-purple hover:brightness-110',
  cyan:
    'text-navy-900 bg-cta-cyan shadow-glow-cyan hover:brightness-110',
  secondary:
    'text-ink bg-navy-700 border border-white/10 hover:border-white/25 hover:bg-navy-600',
  ghost:
    'text-ink-muted hover:text-ink hover:bg-white/5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  fullWidth,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={cn(base, sizes[size], variants[variant], fullWidth && 'w-full', className)}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
}
