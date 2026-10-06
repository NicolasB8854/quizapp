/**
 * Emoji-Reaktionen: Spieler tippen am Handy ein Emoji, es schwebt kurz über
 * alle Bildschirme (vor allem die Bühne). Flüchtig — nichts wird gespeichert.
 */
import { useEffect, useRef, useState } from 'react'
import { REACTION_EMOJIS, type ReactionEmoji } from '@quizapp/shared'
import type { LiveReaction } from '@/hooks/useRoomSync'
import { cn } from '@/lib/classnames'

/** Deterministische Pseudo-Position pro Reaktion (5–85 % Breite). */
function laneFor(id: number): number {
  return 5 + ((id * 37) % 80)
}

export function ReactionLayer({ reactions, stage }: { reactions: LiveReaction[]; stage: boolean }) {
  if (reactions.length === 0) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-6 flex flex-col items-center animate-reaction-float"
          style={{ left: `${laneFor(r.id)}%` }}
        >
          <span className={cn('drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]', stage ? 'text-7xl' : 'text-4xl')}>{r.emoji}</span>
          <span
            className={cn(
              'mt-1 max-w-[10rem] truncate rounded-full bg-navy-900/80 px-2 font-semibold text-white/85',
              stage ? 'text-base' : 'text-[11px]',
            )}
          >
            {r.playerName}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Einklappbare Emoji-Leiste unten rechts (nur Spieler-Handys). */
export function ReactionBar({ onReact }: { onReact: (emoji: ReactionEmoji) => boolean }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])
  const keepOpen = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 4000)
  }
  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5">
      {open && (
        <div className="flex gap-1 rounded-full border border-white/10 bg-navy-900/90 p-1 shadow-lg backdrop-blur animate-titleIn">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Reaktion ${e}`}
              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform active:scale-90 hover:bg-white/10"
              onClick={() => {
                onReact(e)
                keepOpen()
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Reaktionen schließen' : 'Reaktion senden'}
        onClick={() => {
          setOpen((o) => !o)
          keepOpen()
        }}
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl shadow-lg backdrop-blur transition-colors',
          open ? 'border-brand-purple bg-brand-purple/30' : 'border-white/15 bg-navy-900/85',
        )}
      >
        {open ? '✕' : '😀'}
      </button>
    </div>
  )
}
