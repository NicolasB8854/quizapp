/**
 * Marken-Logo „QUIZO" nach Designkonzept v1 (Mockups):
 * Das Q ist Teil der Wortmarke — violetter Verlaufsring mit weißem,
 * diagonalem Schweif — gefolgt von „UIZO" in Montserrat Black, weiß.
 */
import { cn } from '@/lib/classnames'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Nur das Q-Zeichen (z. B. für enge Header). */
  markOnly?: boolean
  className?: string
}

const sizes = {
  sm: { mark: 22, text: 'text-xl' },
  md: { mark: 28, text: 'text-2xl' },
  lg: { mark: 40, text: 'text-4xl' },
  xl: { mark: 64, text: 'text-6xl md:text-7xl' },
} as const

export function BrandLogo({ size = 'md', markOnly = false, className }: Props) {
  const s = sizes[size]
  return (
    <span
      role="img"
      aria-label="QUIZO"
      className={cn('inline-flex items-center gap-[0.06em] leading-none', s.text, className)}
    >
      <BrandMark size={s.mark} />
      {!markOnly && (
        <span
          aria-hidden
          className="font-display font-black uppercase tracking-[-0.01em] text-white"
          style={{ textShadow: '0 0 18px rgba(139,61,255,0.45)' }}
        >
          UIZO
        </span>
      )}
    </span>
  )
}

/** Das Q: Verlaufsring + Schweif. Auch Grundlage für Favicon und App-Icon. */
export function BrandMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className="drop-shadow-[0_0_12px_rgba(139,61,255,0.7)]"
    >
      <defs>
        <linearGradient id="quizo-q" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B565FF" />
          <stop offset="50%" stopColor="#A24BFF" />
          <stop offset="100%" stopColor="#7A2CFF" />
        </linearGradient>
      </defs>
      <circle cx="46" cy="46" r="29.5" fill="none" stroke="url(#quizo-q)" strokeWidth="24" />
      <line x1="64.4" y1="62.8" x2="83" y2="85" stroke="#F2EEFF" strokeWidth="18" strokeLinecap="round" />
    </svg>
  )
}
