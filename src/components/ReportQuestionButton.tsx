/**
 * „Frage melden" — kleiner Link unter der Auflösung. Öffnet eine Auswahl
 * mit Gründen; die Meldung landet anonym in der Review-Liste (/review).
 */
import { useState } from 'react'
import { Flag, Check } from 'lucide-react'
import { REPORT_REASON_LABELS, reportQuestion, type ReportReason } from '@/lib/insightsApi'
import { cn } from '@/lib/classnames'

export function ReportQuestionButton({
  questionId,
  source,
  className,
}: {
  questionId: string
  source: 'room' | 'solo'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const send = async (reason: ReportReason) => {
    setState('sending')
    const ok = await reportQuestion({ questionId, reason, source })
    setState(ok ? 'done' : 'error')
    setOpen(false)
  }

  if (state === 'done') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-correct', className)}>
        <Check className="h-3.5 w-3.5" aria-hidden /> Danke, wir schauen uns die Frage an
      </span>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs text-ink-muted underline-offset-2 hover:text-white hover:underline"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        {state === 'error' ? 'Melden fehlgeschlagen — nochmal?' : 'Frage melden'}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-64 space-y-1 rounded-2xl border border-white/15 bg-navy-900/95 p-2 shadow-card backdrop-blur"
        >
          {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
            <button
              key={r}
              type="button"
              role="menuitem"
              disabled={state === 'sending'}
              onClick={() => void send(r)}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
            >
              {REPORT_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
