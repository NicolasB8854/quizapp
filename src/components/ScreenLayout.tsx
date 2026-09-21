/**
 * Bühnen-Container für alle Vollbild-Screens.
 *
 * Zwei Rendering-Modi:
 *  - `variant='home'`  → Wohnzimmer-Foto (`/img/home-bg.jpg`) als Hintergrund, dunkler
 *                        Purple-Gradient-Overlay für Text-Lesbarkeit. Für Home + Lobby +
 *                        Scoreboard.
 *  - `variant='stage'` → Bühnen-Foto (`/img/stage-bg.jpg`) als Hintergrund, dunkler
 *                        Verlauf-Overlay. Für Gameplay.
 *  - `variant='dim'`   → nur CSS-Bühne ohne Foto (dezenter, für Setup-Screen).
 *
 * Das Grain- und Vignette-Overlay bleibt, damit Fotos + UI zusammen wirken.
 */

import type { ReactNode } from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/classnames'
import { TopNav } from './TopNav'

export type LayoutVariant = 'home' | 'stage' | 'dim'

interface Props {
  children: ReactNode
  navActions?: ReactNode
  headerMeta?: ReactNode
  hideNav?: boolean
  hideFooter?: boolean
  variant?: LayoutVariant
  className?: string
  contentClassName?: string
}

export function ScreenLayout({
  children,
  navActions,
  headerMeta,
  hideNav,
  hideFooter,
  variant = 'home',
  className,
  contentClassName,
}: Props) {
  return (
    <div className={cn('relative min-h-screen text-ink flex flex-col isolate', className)}>
      <PhotoBackdrop variant={variant} />

      {!hideNav && <TopNav actions={navActions} />}

      {headerMeta && (
        <div className="relative z-10 px-6 md:px-10 pt-2">
          <span className="text-xs uppercase tracking-[0.22em] text-ink-muted">
            {headerMeta}
          </span>
        </div>
      )}

      <main className={cn('relative z-10 flex-1 px-6 md:px-10 pb-10', contentClassName)}>
        {children}
      </main>

      {!hideFooter && <StageFooter />}
    </div>
  )
}

/**
 * Foto-Hintergrund + Dark-Overlay + Grain. Die Overlays sind pro Variante etwas anders
 * ausbalanciert, damit der Content immer lesbar bleibt.
 *
 * Home: dunkler Verlauf von links → Bildmitte, damit die linke Text-Spalte Kontrast hat.
 * Stage: dunkler Verlauf oben+unten, damit Header und Score-Sidebar lesbar bleiben.
 * Dim: kein Foto, nur bg-stage.
 */
function PhotoBackdrop({ variant }: { variant: LayoutVariant }) {
  if (variant === 'dim') {
    return (
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none bg-stage stage-grain stage-vignette"
      />
    )
  }
  const src = variant === 'stage' ? '/img/stage-bg.jpg' : '/img/home-bg.jpg'
  const overlay =
    variant === 'stage'
      ? // Bühne (Session V): sehr leichtes Overlay, damit das Foto durchleuchtet.
        // Nur ganz dezenter dunkler Bogen oben (Header) + unten (Silhouetten-Bereich).
        'linear-gradient(180deg, rgba(4,6,15,0.35) 0%, rgba(4,6,15,0) 15%, rgba(4,6,15,0) 60%, rgba(4,6,15,0.6) 100%)'
      : // Home: linker Bereich stark verdunkelt (Text), rechter Bereich transparent (Ambient bleibt)
        'linear-gradient(90deg, rgba(4,6,15,0.85) 0%, rgba(4,6,15,0.55) 35%, rgba(4,6,15,0.15) 60%, rgba(4,6,15,0.4) 100%),' +
        'linear-gradient(180deg, rgba(4,6,15,0.55) 0%, rgba(4,6,15,0) 25%, rgba(4,6,15,0) 65%, rgba(4,6,15,0.5) 100%)'
  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none">
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        // Stage-Foto: mehr Sättigung damit die Bühnen-Neons zünden.
        style={{
          filter:
            variant === 'stage'
              ? 'saturate(1.25) contrast(1.1) brightness(1.05)'
              : 'saturate(1.05) contrast(1.05)',
        }}
      />
      <div className="absolute inset-0" style={{ background: overlay }} />
      {/* Subtiles Grain oben drüber, damit UI und Foto zusammen wirken */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: '160px 160px',
        }}
      />
    </div>
  )
}

function StageFooter() {
  return (
    <footer className="relative z-10 mt-auto px-6 md:px-10 pb-6 pt-4 flex items-center justify-between text-xs text-ink-muted">
      <div className="flex items-center gap-3">
        <span className="font-display font-bold tracking-widest uppercase text-ink">
          Quizo
        </span>
        <span className="text-ink-faint">|</span>
        <span className="italic">Spielend bessere Abende.</span>
      </div>
      <div className="hidden md:flex items-center gap-4 tracking-widest uppercase">
        <span>Wissen</span>
        <span className="text-ink-faint">·</span>
        <span>Humor</span>
        <span className="text-ink-faint">·</span>
        <span>Menschen</span>
        <span className="text-ink-faint">·</span>
        <span>Momente</span>
        <Heart className="h-3.5 w-3.5 text-ink-muted" />
      </div>
    </footer>
  )
}
