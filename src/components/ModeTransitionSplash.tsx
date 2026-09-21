/**
 * Full-Overlay-Splash für Modus-Übergänge.
 *
 * Wird ~1.6 s eingeblendet, sobald sich `state.live.kind` ändert
 * (nächster Modus im Match). Der Splash zeigt:
 *   - „Modus X / Y" als Fortschritts-Label
 *   - `chipLabel` (KLASSIKER / SPEED / …) in Accent-Farbe
 *   - `name` groß
 *   - `tagline` als dezenter Ein-Satz-Untertitel
 *
 * Nach Ablauf ruft die Komponente `onDone` auf, was den Splash-State
 * im Parent zurücksetzt und den normalen Content wieder sichtbar macht.
 *
 * Respektiert `prefers-reduced-motion`: statisch angezeigt, kein Skaling,
 * gleiche Dauer aber ohne Bewegungs-Animation.
 */

import { useEffect } from 'react'
import type { GameMode } from '@quizapp/shared'
import { ACCENT_HEX } from '@quizapp/shared'
import { cn } from '@/lib/classnames'

interface Props {
  mode: GameMode
  modeIndex: number
  totalModes: number
  /** Wird nach ~1.6 s aufgerufen — Parent setzt Splash-State zurück. */
  onDone: () => void
  /**
   * Beliebiger Wert, dessen Änderung ein neues Splash-Fenster startet.
   * Muss beim Trigger ein frischer Wert sein (z. B. Timestamp).
   */
  token: number
}

const DURATION_MS = 1600

export function ModeTransitionSplash({
  mode,
  modeIndex,
  totalModes,
  onDone,
  token,
}: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, DURATION_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const accent = ACCENT_HEX[mode.accent] ?? '#7C5CFF'

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex items-center justify-center',
        'backdrop-blur-md bg-navy-900/75',
        'animate-splash-fade',
      )}
      aria-live="polite"
      role="status"
    >
      <div className="max-w-3xl px-6 text-center animate-splash-content">
        <div className="text-xs md:text-sm uppercase tracking-[0.32em] text-white/40">
          Modus {modeIndex + 1} / {totalModes}
        </div>
        <div
          className="mt-3 text-sm md:text-base uppercase font-bold tracking-[0.4em]"
          style={{ color: accent, textShadow: `0 0 24px ${accent}80` }}
        >
          {mode.chipLabel}
        </div>
        <div
          className="mt-4 text-5xl md:text-7xl lg:text-8xl font-bold leading-tight text-white"
          style={{ textShadow: `0 0 40px ${accent}55` }}
        >
          {mode.name}
        </div>
        <div className="mt-6 text-base md:text-xl text-white/70 italic">
          {mode.tagline}
        </div>
      </div>
    </div>
  )
}
