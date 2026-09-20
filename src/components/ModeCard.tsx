/**
 * Modus-Auswahl-Karte im „Show-Header"-Look aus den PDF-Mockups.
 *
 * Zwei-Zonen-Aufbau:
 *  - Header  → Modus-Farbe als Ambient-Licht, Titel groß in Space-Grotesk-Uppercase,
 *              Kategorie-Chip oben links (KLASSIKER/TEMPO/SPANNUNG/…)
 *  - Body    → Tagline + Meta (Dauer + Match-Beitrag) + Pfeil-Chip
 *
 * Selected-State: Card bekommt Neon-Ring in Modus-Farbe. Planned-State: Card ist optisch
 * präsent, aber nicht anklickbar und bekommt einen „Bald verfügbar"-Chip.
 */

import type { GameMode, ModeAccent } from '@/types/round'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/classnames'
import { ACCENT_HEX } from '@/data/modes'

interface Props {
  mode: GameMode
  selected: boolean
  onToggle: () => void
}

const accentText: Record<ModeAccent, string> = {
  duel:      'text-brand-cyan-soft',
  board:     'text-mode-board',
  sprinter:  'text-mode-sprinter',
  ladder:    'text-mode-ladder',
  corner:    'text-mode-corner',
  experts:   'text-mode-experts',
  flash:     'text-mode-flash',
  spotlight: 'text-mode-spotlight',
}

export function ModeCard({ mode, selected, onToggle }: Props) {
  const disabled = mode.status !== 'ready'
  const hex = ACCENT_HEX[mode.accent]

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group relative w-full text-left rounded-card overflow-hidden',
        'bg-navy-800 border border-white/[0.06] transition-all duration-200',
        !disabled && 'hover:border-white/25 hover:-translate-y-0.5',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
      style={
        selected
          ? {
              boxShadow: `0 0 0 2px ${hex}55, 0 0 24px -4px ${hex}80, 0 0 60px -12px ${hex}40`,
              borderColor: `${hex}66`,
            }
          : undefined
      }
    >
      {/* HEADER: Show-Bühnen-Look mit Modus-Farbe */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* Radial-Glow in Modus-Farbe — stark genug, um auf einer Show-Bühne zu wirken */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(80% 80% at 50% 45%, ${hex}80 0%, ${hex}18 55%, ${hex}00 80%),` +
              `radial-gradient(120% 80% at 50% 100%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 60%),` +
              `linear-gradient(180deg, #171E38 0%, #0B1020 100%)`,
          }}
        />
        {/* Bühnen-Spotlight-Strahlen aus der Mitte */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `conic-gradient(from 180deg at 50% 110%, transparent 0deg, ${hex}30 15deg, transparent 30deg, ${hex}20 60deg, transparent 90deg, ${hex}30 120deg, transparent 150deg, ${hex}20 180deg, transparent 210deg)`,
            mixBlendMode: 'screen',
            opacity: 0.55,
          }}
        />
        {/* Feiner Streifen-Overlay wie „Bühnen-Vorhang" */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 34px)',
          }}
        />
        {/* Vignette am Rand */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* Chip oben links */}
        <span
          className="absolute top-3 left-3 md:top-4 md:left-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{
            borderColor: `${hex}66`,
            color: hex,
            background: 'rgba(11, 16, 32, 0.55)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {mode.chipLabel}
        </span>

        {/* Status-Chip oben rechts */}
        {disabled ? (
          <span className="absolute top-3 right-3 md:top-4 md:right-4 inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 text-ink-muted text-[10px] font-semibold uppercase tracking-[0.2em] px-2 py-0.5 md:px-2.5 md:py-1">
            Bald
          </span>
        ) : selected ? (
          <span
            className="absolute top-3 right-3 md:top-4 md:right-4 inline-flex items-center gap-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] px-2 py-0.5 md:px-2.5 md:py-1"
            style={{
              background: `${hex}22`,
              color: hex,
              border: `1px solid ${hex}66`,
            }}
          >
            <Check className="h-3 w-3" /> Gewählt
          </span>
        ) : null}

        {/* Modus-Titel — bricht nur am Wortende um, keine harten Silbentrennungen */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
          <h3
            className={cn(
              'font-display font-bold uppercase leading-[0.95] tracking-tight',
              // Auto-shrink über clamp; deutlich zurückhaltender als vorher
              'text-[clamp(0.95rem,1.7vw,1.35rem)]',
            )}
            style={{
              color: '#F5F1FF',
              textShadow: `0 0 10px ${hex}90, 0 0 22px ${hex}55, 0 0 44px ${hex}30`,
              overflowWrap: 'normal',
              wordBreak: 'normal',
              hyphens: 'manual',
            }}
          >
            {mode.name}
          </h3>
        </div>
      </div>

      {/* BODY: Tagline + Meta + Pfeil */}
      <div className="relative p-5">
        <p className={cn('text-sm leading-relaxed', accentText[mode.accent])}>
          {mode.tagline}
        </p>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          {mode.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> ~ {mode.estimatedMinutes} Min
            </span>
            {mode.scoresMatchPoint ? <span>zählt fürs Match</span> : <span>ohne Wertung</span>}
          </div>
          {!disabled && (
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-transform group-hover:translate-x-0.5"
              style={{
                borderColor: `${hex}55`,
                color: hex,
                background: `${hex}18`,
              }}
            >
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
