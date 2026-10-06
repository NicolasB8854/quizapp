/**
 * Show-Bausteine für alle Modi (Multi-Device + Bühne).
 *
 * Ein Look für Frage, Antworten, Buzzer, Timer und Auflösung — vorher hatte
 * jeder Modus seine eigene Variante. `stage` = großer Master-Screen, sonst
 * Handy-Größe (mobile first).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Timer as TimerIcon, Zap } from 'lucide-react'
import type { TeamColor } from '@quizapp/shared'
import { getTeamColorHex } from '@quizapp/shared'
import { AnswerOption, type AnswerStatus } from '@/components/AnswerOption'
import { cn } from '@/lib/classnames'
import { ReportQuestionButton } from '@/components/ReportQuestionButton'
import { suspenseMs } from '@/lib/reveal'
import { playSound } from '@/lib/audio'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// ---------- Frage ------------------------------------------------------------

export function ShowQuestion({
  text,
  stage = false,
  eyebrow,
  tone = null,
  explanation,
  questionId,
}: {
  text: string
  stage?: boolean
  /** Kleine Zeile über der Frage, z. B. „Chemie · 300 Punkte". */
  eyebrow?: ReactNode
  tone?: 'correct' | 'wrong' | 'neutral' | null
  /** Wird angezeigt, sobald `tone` gesetzt ist (Auflösung). */
  explanation?: string | null
  /** Gesetzt = „Frage melden" unter der Auflösung. */
  questionId?: string
}) {
  const glow =
    tone === 'correct'
      ? 'border-correct/70 shadow-glow-correct animate-reveal-correct'
      : tone === 'wrong'
        ? 'border-wrong/70 shadow-glow-wrong animate-reveal-wrong'
        : 'border-brand-purple/45 shadow-[0_0_0_1px_rgba(124,92,255,0.25),0_0_32px_-6px_rgba(124,92,255,0.45)]'
  return (
    <div className="space-y-2">
      <div
        key={tone ?? 'open'}
        className={cn(
          'rounded-card border-2 bg-navy-900/80 text-center backdrop-blur',
          stage ? 'px-8 py-10 md:px-12 md:py-14' : 'px-5 py-6',
          glow,
        )}
      >
        {eyebrow && (
          <div className={cn('eyebrow mb-2 text-brand-purple-soft', stage && 'text-sm')}>{eyebrow}</div>
        )}
        <h2
          className={cn(
            'font-display font-bold leading-tight text-white',
            stage ? 'text-3xl md:text-5xl' : 'text-xl sm:text-2xl',
          )}
        >
          {text}
        </h2>
      </div>
      {tone && explanation && <ExplanationCard text={explanation} stage={stage} />}
      {tone && questionId && !stage && <ReportQuestionButton questionId={questionId} source="room" />}
    </div>
  )
}

export function ExplanationCard({ text, stage = false }: { text: string; stage?: boolean }) {
  return (
    <div
      className={cn(
        'animate-titleIn rounded-2xl border border-white/10 bg-navy-800/80 text-left',
        stage ? 'p-5 text-lg' : 'p-4 text-sm',
      )}
    >
      <div className="eyebrow mb-1 text-ink-muted">Erklärung</div>
      <p className="leading-relaxed text-white/85">{text}</p>
    </div>
  )
}

// ---------- Antworten --------------------------------------------------------

export interface AnswerTeamRef {
  id: string
  color: TeamColor
  name: string
}

/**
 * Antwort-Liste im Show-Look. `picksByIndex` markiert, welche Teams welche
 * Option gewählt haben (Punkte in Teamfarbe); falsche Picks werden rot.
 */
export function ShowAnswers({
  options,
  correctIdx,
  picksByIndex = {},
  teams = [],
  onSelect,
  canClick,
  stage = false,
  myPick,
  disabledIdx,
  suspense = false,
}: {
  options: string[]
  correctIdx: number | null
  picksByIndex?: Record<number, string[]>
  teams?: AnswerTeamRef[]
  onSelect: (idx: number) => void
  canClick: boolean
  stage?: boolean
  myPick?: number
  /** Gesperrte Option (z. B. beim Rebound die schon falsche Antwort). */
  disabledIdx?: number | null
  /**
   * Auflösung mit Spannung: beim Wechsel auf „aufgelöst" erst nur zeigen, wer
   * was getippt hat, die Lösung leuchtet nach `suspenseMs()` auf.
   */
  suspense?: boolean
}) {
  const holding = useRevealHold(suspense, correctIdx !== null)
  const revealed = correctIdx !== null && !holding
  return (
    <div className={cn('grid gap-2.5', stage ? 'md:grid-cols-2 md:gap-4' : 'sm:grid-cols-2')}>
      {options.map((option, idx) => {
        const picks = picksByIndex[idx] ?? []
        let status: AnswerStatus = 'idle'
        if (revealed) {
          status = idx === correctIdx ? 'correct' : picks.length > 0 || idx === myPick ? 'wrong' : 'dimmed'
        } else if (holding) {
          status = picks.length > 0 || idx === myPick ? 'selected' : 'dimmed'
        } else if (idx === myPick) {
          status = 'selected'
        } else if (picks.length > 0 || idx === disabledIdx) {
          status = 'wrong'
        } else if (!canClick) {
          status = 'idle'
        }
        return (
          <AnswerOption
            key={idx}
            letter={LETTERS[idx] ?? String(idx + 1)}
            status={status}
            disabled={!canClick || idx === disabledIdx}
            onClick={() => canClick && idx !== disabledIdx && onSelect(idx)}
            className={cn(
              !canClick && !revealed && 'hover:border-brand-purple/40 hover:bg-navy-900/85',
              holding && picks.length > 0 && 'animate-pulse',
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="flex-1">{option}</span>
              {picks.length > 0 && (
                <span className="flex flex-wrap gap-1" aria-label={`gewählt von ${picks.length} Team(s)`}>
                  {picks.map((teamId) => {
                    const team = teams.find((t) => t.id === teamId)
                    if (!team) return null
                    const hex = getTeamColorHex(team.color)
                    return (
                      <span
                        key={teamId}
                        title={team.name}
                        className={cn(
                          'inline-flex max-w-[9rem] items-center gap-1 truncate rounded-full border font-semibold text-white animate-titleIn',
                          stage ? 'px-2.5 py-0.5 text-sm' : 'px-2 py-px text-[11px]',
                        )}
                        style={{ borderColor: hex, background: `${hex}33` }}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hex }} />
                        <span className="truncate">{team.name}</span>
                      </span>
                    )
                  })}
                </span>
              )}
            </span>
          </AnswerOption>
        )
      })}
    </div>
  )
}

/**
 * `true`, solange nach dem Umschalten auf „aufgelöst" die Spannungs-Pause läuft.
 * Nur der Übergang zählt: wer erst nach der Auflösung einsteigt (Reconnect),
 * sieht die Lösung sofort.
 */
export function useRevealHold(enabled: boolean, revealed: boolean): boolean {
  const [holding, setHolding] = useState(false)
  const prevRef = useRef(revealed)
  // Übergang erkennen (ohne Cleanup, damit StrictMode-Doppelläufe nichts verlieren).
  useEffect(() => {
    const was = prevRef.current
    prevRef.current = revealed
    if (!revealed) setHolding(false)
    else if (enabled && !was && suspenseMs() > 0) setHolding(true)
  }, [enabled, revealed])
  // Pause beenden — eigener Effekt, damit der Timer bei jedem Mount neu steht.
  useEffect(() => {
    if (!holding) return
    const t = window.setTimeout(() => setHolding(false), suspenseMs())
    return () => window.clearTimeout(t)
  }, [holding])
  // Im ersten Render des Übergangs ist der Effekt noch nicht gelaufen —
  // ohne diesen Check blitzte die Lösung einen Frame lang auf.
  return holding || (enabled && revealed && !prevRef.current && suspenseMs() > 0)
}

// ---------- Buzzer -----------------------------------------------------------

export function BuzzerButton({
  team,
  onBuzz,
  disabled,
  stage = false,
  label,
}: {
  team: AnswerTeamRef
  onBuzz: () => void
  disabled?: boolean
  stage?: boolean
  label?: string
}) {
  const hex = getTeamColorHex(team.color)
  return (
    <button
      type="button"
      onClick={onBuzz}
      disabled={disabled}
      className={cn(
        'group relative flex w-full items-center justify-center gap-3 rounded-full border-4 font-display font-extrabold uppercase tracking-[0.12em] text-white',
        'transition-transform duration-100 active:scale-95 disabled:opacity-40 disabled:active:scale-100',
        stage ? 'h-24 text-2xl md:text-3xl' : 'h-20 text-xl',
      )}
      style={{
        borderColor: hex,
        background: `radial-gradient(circle at 50% 35%, ${hex}66 0%, ${hex}22 60%, rgba(11,16,32,0.9) 100%)`,
        boxShadow: `0 0 0 1px ${hex}55, 0 0 36px -4px ${hex}AA, inset 0 2px 0 ${hex}55`,
      }}
    >
      <Zap className={cn(stage ? 'h-8 w-8' : 'h-6 w-6')} fill="currentColor" aria-hidden />
      {label ?? `${team.name} buzzt`}
    </button>
  )
}

// ---------- Timer ------------------------------------------------------------

export function ShowTimer({
  seconds,
  critical,
  paused = false,
  stage = false,
  label,
  tick = stage,
}: {
  seconds: number
  critical?: boolean
  paused?: boolean
  stage?: boolean
  label?: string
  /**
   * Ticken in den letzten 5 Sekunden. Default nur auf der Bühne — sonst ticken
   * fünf Handys leicht versetzt durcheinander.
   */
  tick?: boolean
}) {
  const whole = Math.max(0, Math.ceil(seconds))
  const lastTickRef = useRef<number | null>(null)
  useEffect(() => {
    if (!tick || paused || whole < 1 || whole > 5) return
    if (lastTickRef.current === whole) return
    lastTickRef.current = whole
    playSound('tick')
  }, [tick, paused, whole])
  const isCritical = critical ?? seconds <= 5
  const hex = paused ? '#8A93B8' : isCritical ? '#FF5C7A' : '#B78BFF'
  return (
    <div
      role="timer"
      aria-label={label ?? 'Verbleibende Zeit'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border-2 bg-navy-900/80 tabular-nums',
        stage ? 'px-5 py-2.5' : 'px-3.5 py-1.5',
        isCritical && !paused && 'animate-timer-pulse',
      )}
      style={{ borderColor: `${hex}99`, boxShadow: `0 0 24px -8px ${hex}CC` }}
    >
      <TimerIcon className={cn(stage ? 'h-5 w-5' : 'h-4 w-4')} style={{ color: hex }} aria-hidden />
      <span className={cn('font-display font-extrabold', stage ? 'text-3xl' : 'text-xl')} style={{ color: hex }}>
        {String(whole).padStart(2, '0')}
        {paused && <span className="ml-1 text-sm">⏸</span>}
      </span>
    </div>
  )
}

// ---------- Status-Zeile -----------------------------------------------------

/** Große, gut lesbare Statuszeile („Rot buzzert", „Du bist dran"). */
export function ShowStatus({
  children,
  tone = 'neutral',
  stage = false,
}: {
  children: ReactNode
  tone?: 'neutral' | 'active' | 'warn'
  stage?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-center font-semibold',
        stage ? 'text-xl' : 'text-base',
        tone === 'active' && 'border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan-soft',
        tone === 'warn' && 'border-wrong/50 bg-wrong/10 text-wrong',
        tone === 'neutral' && 'border-white/10 bg-navy-800/70 text-white/85',
      )}
    >
      {children}
    </div>
  )
}
