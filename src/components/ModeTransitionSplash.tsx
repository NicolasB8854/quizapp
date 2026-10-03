/**
 * Full-Overlay-Splash für Modus-Übergänge.
 *
 * Wird ~3 s eingeblendet (inkl. 3-2-1), sobald sich `state.live.kind` ändert
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

import { useEffect, useState } from 'react'
import type { GameMode } from '@quizapp/shared'
import { ACCENT_HEX } from '@quizapp/shared'
import { cn } from '@/lib/classnames'
import { modeImage } from '@/lib/modeImage'

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
  /** Zwischenstand (Match-Punkte) — ab dem zweiten Modus eingeblendet. */
  standings?: Array<{ id: string; name: string; colorHex: string; points: number }>
}

/** Splash-Dauer inkl. 3-2-1-Countdown. */
const DURATION_MS = 3000

/** Moderations-Zeilen: ein Satz wie von einer Show-Moderation. */
export function hostLine(modeIndex: number, totalModes: number, modeName: string): string {
  if (totalModes > 1 && modeIndex === totalModes - 1) return `Das große Finale: ${modeName}! Jetzt zählt jeder Punkt.`
  if (modeIndex === 0) return `Willkommen zum Spieleabend! Wir starten mit ${modeName}.`
  const lines = [
    `Weiter geht's mit ${modeName}. Wer holt sich den nächsten Punkt?`,
    `Bühne frei für ${modeName}!`,
    `Kurz durchatmen — gleich kommt ${modeName}.`,
    `Noch ist alles drin. Auf zu ${modeName}!`,
  ]
  return lines[(modeIndex - 1) % lines.length]
}

export function ModeTransitionSplash({
  mode,
  modeIndex,
  totalModes,
  onDone,
  token,
  standings,
}: Props) {
  const [count, setCount] = useState(3)
  useEffect(() => {
    setCount(3)
    const t = window.setTimeout(onDone, DURATION_MS)
    // Countdown in der zweiten Hälfte: 3 … 2 … 1
    const ticks = [900, 1600, 2300].map((ms, i) => window.setTimeout(() => setCount(2 - i), ms))
    return () => {
      window.clearTimeout(t)
      ticks.forEach((x) => window.clearTimeout(x))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  const leader = standings && standings.length > 1 ? [...standings].sort((a, b) => b.points - a.points) : null

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
      {/* Studio-Motiv des Modus, stark abgedunkelt — Titel bleibt lesbar. */}
      <img
        src={modeImage(mode.id)}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-60"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-navy-900/80 via-navy-900/55 to-navy-900/85" />
      <div className="relative max-w-3xl px-6 text-center animate-splash-content">
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
        <div className="mt-6 text-base md:text-xl text-white/80">
          {hostLine(modeIndex, totalModes, mode.name)}
        </div>
        <div className="mt-2 text-sm md:text-base text-white/55 italic">{mode.tagline}</div>
        {leader && modeIndex > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {leader.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-2 rounded-full border-2 bg-navy-900/80 px-3 py-1 text-sm font-semibold text-white"
                style={{ borderColor: `${t.colorHex}99` }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.colorHex }} />
                {t.name} · {t.points}
              </span>
            ))}
          </div>
        )}
        <div
          key={count}
          aria-hidden
          className="mt-8 font-display text-6xl font-black text-white animate-titleIn"
          style={{ textShadow: `0 0 30px ${accent}` }}
        >
          {count > 0 ? count : 'Los!'}
        </div>
      </div>
    </div>
  )
}
