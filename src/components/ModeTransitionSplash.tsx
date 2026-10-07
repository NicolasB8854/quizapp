/**
 * Full-Overlay-Splash für Modus-Übergänge.
 *
 * Ab dem zweiten Modus läuft er in zwei Akten:
 *   1. Zwischenstand (~2.8 s): Teams stehen erst in der alten Reihenfolge, dann
 *      rutschen sie auf ihre neuen Plätze; der Modus-Sieger bekommt ein „+1"
 *      (im Finale „+2"), wer überholt hat, ein „↑".
 *   2. Intro (~3 s): „Modus X / Y", Chip-Label, Name, Moderation, 3-2-1.
 *
 * Nach Ablauf ruft die Komponente `onDone` auf, was den Splash-State
 * im Parent zurücksetzt und den normalen Content wieder sichtbar macht.
 *
 * Respektiert `prefers-reduced-motion`: keine Rutsch-Animation, gleiche Dauer.
 */
import { useEffect, useMemo, useState } from 'react'
import type { GameMode } from '@quizapp/shared'
import { ACCENT_HEX, FINALE_MIN_MODES } from '@quizapp/shared'
import { cn } from '@/lib/classnames'
import { modeImage } from '@/lib/modeImage'
import { playSound } from '@/lib/audio'

export interface SplashStanding {
  id: string
  name: string
  colorHex: string
  points: number
}

interface Props {
  mode: GameMode
  modeIndex: number
  totalModes: number
  /** Wird nach Ablauf aufgerufen — Parent setzt Splash-State zurück. */
  onDone: () => void
  /**
   * Beliebiger Wert, dessen Änderung ein neues Splash-Fenster startet.
   * Muss beim Trigger ein frischer Wert sein (z. B. Timestamp).
   */
  token: number
  /** Zwischenstand (Match-Punkte) — ab dem zweiten Modus eingeblendet. */
  standings?: SplashStanding[]
  /** Sieger des gerade beendeten Modus (für das „+N"), `null` bei Gleichstand. */
  lastWinnerId?: string | null
  /** Match-Punkte, die der letzte Modus-Sieger bekommen hat. */
  lastAward?: number
}

/** Dauer des Zwischenstand-Akts. */
export const STANDINGS_MS = 2800
/** Dauer des Intro-Akts inkl. 3-2-1-Countdown. */
const INTRO_MS = 3000
/** Nach so vielen ms rutschen die Teams auf ihre neuen Plätze. */
const SHUFFLE_AT_MS = 650

export function splashDurationMs(withStandings: boolean): number {
  return (withStandings ? STANDINGS_MS : 0) + INTRO_MS
}

/** Moderations-Zeilen: ein Satz wie von einer Show-Moderation. */
export function hostLine(modeIndex: number, totalModes: number, modeName: string): string {
  if (totalModes > 1 && modeIndex === totalModes - 1) {
    return totalModes >= FINALE_MIN_MODES
      ? `Das große Finale: ${modeName}! Der Sieg zählt doppelt.`
      : `Das große Finale: ${modeName}! Jetzt zählt jeder Punkt.`
  }
  if (modeIndex === 0) return `Willkommen zum Spieleabend! Wir starten mit ${modeName}.`
  const lines = [
    `Weiter geht's mit ${modeName}. Wer holt sich den nächsten Punkt?`,
    `Bühne frei für ${modeName}!`,
    `Kurz durchatmen — gleich kommt ${modeName}.`,
    `Noch ist alles drin. Auf zu ${modeName}!`,
  ]
  return lines[(modeIndex - 1) % lines.length]
}

/**
 * Reihenfolge vor und nach dem letzten Modus. Stabil bei Gleichstand
 * (Eingangsreihenfolge), damit niemand ohne Grund den Platz wechselt.
 */
export function rankStandings(
  standings: readonly SplashStanding[],
  lastWinnerId: string | null | undefined,
  lastAward: number,
): { before: string[]; after: string[]; overtook: Set<string> } {
  const prevPoints = (t: SplashStanding) => t.points - (t.id === lastWinnerId ? lastAward : 0)
  const order = (score: (t: SplashStanding) => number) =>
    standings
      .map((t, i) => ({ t, i }))
      .sort((a, b) => score(b.t) - score(a.t) || a.i - b.i)
      .map(({ t }) => t.id)
  const before = order(prevPoints)
  const after = order((t) => t.points)
  const overtook = new Set(after.filter((id) => after.indexOf(id) < before.indexOf(id)))
  return { before, after, overtook }
}

export function ModeTransitionSplash({
  mode,
  modeIndex,
  totalModes,
  onDone,
  token,
  standings,
  lastWinnerId = null,
  lastAward = 1,
}: Props) {
  const withStandings = !!standings && standings.length > 1 && modeIndex > 0
  const [act, setAct] = useState<'standings' | 'intro'>(withStandings ? 'standings' : 'intro')
  const [shuffled, setShuffled] = useState(false)
  const [count, setCount] = useState(3)

  useEffect(() => {
    const introAt = withStandings ? STANDINGS_MS : 0
    setAct(withStandings ? 'standings' : 'intro')
    setShuffled(false)
    setCount(3)
    const timers = [
      window.setTimeout(onDone, splashDurationMs(withStandings)),
      window.setTimeout(() => setAct('intro'), introAt),
      // Countdown in der zweiten Hälfte des Intros: 3 … 2 … 1
      ...[900, 1600, 2300].map((ms, i) => window.setTimeout(() => setCount(2 - i), introAt + ms)),
    ]
    if (withStandings) {
      timers.push(
        window.setTimeout(() => {
          setShuffled(true)
          if (lastWinnerId) playSound('lockIn')
        }, SHUFFLE_AT_MS),
      )
    }
    return () => timers.forEach((x) => window.clearTimeout(x))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const accent = ACCENT_HEX[mode.accent] ?? '#7C5CFF'
  const totalMs = splashDurationMs(withStandings)

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex items-center justify-center',
        'backdrop-blur-md bg-navy-900/75',
        'animate-splash-fade',
      )}
      // Fade-Kurve über die ganze Dauer strecken (sonst wäre der Countdown unsichtbar).
      style={{ animationDuration: `${totalMs}ms` }}
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

      {act === 'standings' && standings ? (
        <StandingsBoard
          standings={standings}
          lastWinnerId={lastWinnerId}
          lastAward={lastAward}
          shuffled={shuffled}
          modeIndex={modeIndex}
          totalModes={totalModes}
        />
      ) : (
        <div key="intro" className="relative max-w-3xl px-6 text-center animate-titleIn">
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
          {totalModes >= FINALE_MIN_MODES && modeIndex === totalModes - 1 && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-amber-300 bg-amber-300/15 px-5 py-1.5 font-display text-2xl md:text-3xl font-black text-amber-200 animate-pop">
              ×2 · Sieg zählt doppelt
            </div>
          )}
          <div className="mt-6 text-base md:text-xl text-white/80">
            {hostLine(modeIndex, totalModes, mode.name)}
          </div>
          <div className="mt-2 text-sm md:text-base text-white/55 italic">{mode.tagline}</div>
          <div
            key={count}
            aria-hidden
            className="mt-8 font-display text-6xl font-black text-white animate-titleIn"
            style={{ textShadow: `0 0 30px ${accent}` }}
          >
            {count > 0 ? count : 'Los!'}
          </div>
        </div>
      )}
    </div>
  )
}

const ROW_REM = 4.25

function StandingsBoard({
  standings,
  lastWinnerId,
  lastAward,
  shuffled,
  modeIndex,
  totalModes,
}: {
  standings: SplashStanding[]
  lastWinnerId: string | null
  lastAward: number
  shuffled: boolean
  modeIndex: number
  totalModes: number
}) {
  const { before, after, overtook } = useMemo(
    () => rankStandings(standings, lastWinnerId, lastAward),
    [standings, lastWinnerId, lastAward],
  )
  const order = shuffled ? after : before
  const leaderPoints = Math.max(...standings.map((t) => t.points))
  const winner = standings.find((t) => t.id === lastWinnerId)

  return (
    <div className="relative w-full max-w-xl px-6 text-center animate-titleIn">
      <div className="text-xs md:text-sm uppercase tracking-[0.32em] text-white/40">
        Nach Modus {modeIndex} / {totalModes}
      </div>
      <div className="mt-2 font-display text-4xl md:text-6xl font-extrabold text-white">Zwischenstand</div>
      <div className="mt-2 h-6 text-sm md:text-base text-white/70">
        {winner ? `${winner.name} holt den Modus!` : 'Unentschieden — kein Punkt vergeben.'}
      </div>
      {totalModes >= FINALE_MIN_MODES && modeIndex === totalModes - 1 && (
        <div className="mt-1 text-sm md:text-base font-semibold text-amber-200">
          Jetzt kommt das Finale — der Sieg zählt doppelt!
        </div>
      )}
      <div className="relative mt-6" style={{ height: `${standings.length * ROW_REM}rem` }}>
        {standings.map((t) => {
          const rank = order.indexOf(t.id)
          const shownPoints = shuffled || t.id !== lastWinnerId ? t.points : t.points - lastAward
          const isWinner = t.id === lastWinnerId
          return (
            <div
              key={t.id}
              className={cn(
                'absolute inset-x-0 flex h-[3.6rem] items-center gap-3 rounded-2xl border-2 bg-navy-900/85 px-4 text-left',
                'transition-[top,box-shadow] duration-700 ease-[cubic-bezier(.2,.9,.25,1.15)] motion-reduce:transition-none',
              )}
              style={{
                top: `${rank * ROW_REM}rem`,
                borderColor: `${t.colorHex}AA`,
                boxShadow: shuffled && isWinner ? `0 0 36px -4px ${t.colorHex}` : `0 0 16px -8px ${t.colorHex}`,
              }}
            >
              <span className="w-7 font-display text-2xl font-black text-white/50 tabular-nums">{rank + 1}</span>
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: t.colorHex }} />
              <span className="flex-1 truncate text-lg md:text-2xl font-semibold text-white">
                {t.name}
                {shuffled && overtook.has(t.id) && (
                  <span className="ml-2 text-base text-correct animate-titleIn" aria-label="überholt">↑</span>
                )}
              </span>
              {shuffled && isWinner && (
                <span className="rounded-full bg-correct/25 px-2.5 py-0.5 font-mono text-base font-bold text-correct animate-pop">
                  +{lastAward}
                </span>
              )}
              <span
                key={shownPoints}
                className={cn(
                  'w-10 text-right font-display text-3xl font-extrabold tabular-nums',
                  shownPoints === leaderPoints && shuffled ? 'text-amber-200' : 'text-white',
                  shuffled && isWinner && 'animate-pop',
                )}
              >
                {shownPoints}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
