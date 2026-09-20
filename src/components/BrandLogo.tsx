/**
 * Marken-Logo: stilisiertes Kreis-Zeichen + Wortmarke „Quizo".
 *
 * Das Zeichen ist ein eigenständiges geometrisches Element (Kreis mit ausgesparter Ecke +
 * kleinem inneren Play-Dreieck) — nachempfunden dem stilisierten „Q" der PDF-Mockups. Die
 * Wortmarke steht in Bricolage-Grotesque-Uppercase daneben.
 */

import { cn } from '@/lib/classnames'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

const sizes = {
  sm: { mark: 32, text: 'text-base' },
  md: { mark: 44, text: 'text-lg md:text-xl' },
  lg: { mark: 64, text: 'text-2xl md:text-3xl' },
} as const

export function BrandLogo({ size = 'md', showWordmark = true, className }: Props) {
  const s = sizes[size]
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <BrandMark size={s.mark} />
      {showWordmark && (
        <span
          className={cn(
            'font-display font-bold uppercase tracking-[0.24em] text-white',
            s.text,
          )}
          style={{
            textShadow: '0 0 8px rgba(124,92,255,0.55), 0 0 22px rgba(124,92,255,0.35)',
          }}
        >
          Quizo
        </span>
      )}
    </div>
  )
}

interface MarkProps {
  size: number
}

function BrandMark({ size }: MarkProps) {
  const strokeInner = size * 0.09
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Quizo Marke"
      className="drop-shadow-[0_0_16px_rgba(124,92,255,0.75)]"
    >
      <defs>
        <linearGradient id="bg-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B6DFF" />
          <stop offset="55%" stopColor="#5A3EE0" />
          <stop offset="100%" stopColor="#1E1E4E" />
        </linearGradient>
        <linearGradient id="bg-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B7A2FF" />
          <stop offset="100%" stopColor="#27D8FF" />
        </linearGradient>
      </defs>
      {/* Grundkreis (Cutout unten-rechts wie ein „Q") */}
      <path
        d="M32 4 A28 28 0 1 1 55.6 46.4 L55.6 60 L46 60 L46 55.5 A28 28 0 0 1 32 4 Z"
        fill="url(#bg-fill)"
        stroke="url(#bg-stroke)"
        strokeWidth={strokeInner}
        strokeLinejoin="round"
      />
      {/* Inneres kleines Play-Dreieck, dezent — als Wiedererkennungsmerkmal */}
      <path
        d="M28 24 L44 32 L28 40 Z"
        fill="#F5F1FF"
        opacity="0.92"
      />
    </svg>
  )
}
