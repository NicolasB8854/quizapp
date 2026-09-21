/**
 * Kompakter Verbindungs-Toast am oberen Bildschirmrand.
 *
 * Ersetzt große rote Fehler-Karten im Content-Bereich durch einen dezenten
 * Streifen unter dem Team-Farb-Balken. So bleibt der Content während einer
 * kurzen Verbindungsstörung sichtbar — das Reconnect wirkt weniger dramatisch
 * und die Bühne muss nicht komplett neu aufgebaut werden.
 *
 * Drei Töne:
 *  - `info` (blau)  — Verbindungsversuche laufen, kein Nutzer-Eingriff nötig.
 *  - `warn` (bernstein) — Konfig-Warnung wie fehlende WS-URL.
 *  - `error` (rot) — Server hat einen Fehler zurückgemeldet.
 *
 * Der Toast rendert ausschließlich per `fixed`-Position, damit er über
 * beliebigem Content schwebt. Enter-Animation via Tailwind-Keyframes
 * (siehe `index.css` → `toast-slide-in`).
 */

import type { ReactNode } from 'react'
import { AlertTriangle, Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/classnames'

export type ToastTone = 'info' | 'warn' | 'error'

interface Props {
  tone: ToastTone
  message: string
  /** Optionaler Reiter-Text („Reconnect", „Fehler", …). */
  label?: string
  /** Zeigt einen animierten Spinner links neben dem Text. Für Info-Ton sinnvoll. */
  showSpinner?: boolean
  /** Falls gesetzt, wird ein Close-X eingeblendet. */
  onDismiss?: () => void
  /** Zusätzlicher Inhalt rechts, z. B. ein Retry-Button. */
  action?: ReactNode
}

const TONE_STYLES: Record<ToastTone, string> = {
  info: 'border-blue-400/40 bg-blue-500/15 text-blue-100',
  warn: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
  error: 'border-red-500/40 bg-red-500/20 text-red-100',
}

export function ConnectionToast({
  tone,
  message,
  label,
  showSpinner,
  onDismiss,
  action,
}: Props) {
  return (
    <div
      role="status"
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto fixed inset-x-0 top-[3px] z-40 mx-auto flex max-w-md items-center gap-3',
        'rounded-b-xl border border-t-0 px-4 py-2.5 text-sm shadow-lg backdrop-blur-md',
        'animate-toast-slide-in',
        TONE_STYLES[tone],
      )}
    >
      {showSpinner ? (
        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
      ) : tone === 'warn' ? (
        <WifiOff className="h-4 w-4 flex-shrink-0" />
      ) : tone === 'error' ? (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      ) : null}
      <div className="min-w-0 flex-1">
        {label && (
          <div className="text-[10px] uppercase tracking-[0.28em] opacity-80">
            {label}
          </div>
        )}
        <div className="truncate leading-snug">{message}</div>
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Schließen"
          className="ml-1 text-current/80 hover:text-current"
        >
          ×
        </button>
      )}
    </div>
  )
}
