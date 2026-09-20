/**
 * Kachel im 12-Kategorien-Grid des Themen-Battles.
 *
 * Drei visuelle Zustände:
 *  - default     → auswählbar
 *  - active-team → hebt visuell hervor, dass das aktuelle Team dran ist
 *  - used        → schon gespielt, ausgegraut, nicht wählbar
 *
 * Die Emoji-Ankertypografie ist bewusst dezent gehalten (Guardrail: „keine Clipart").
 */

import type { TopicDef } from '@/data/topics'
import { cn } from '@/lib/classnames'

interface Props {
  topic: TopicDef
  points: number
  used: boolean
  onSelect: () => void
  disabled?: boolean
  /** Wenn true: Kachel zeigt einen dezenten „Euer Thema"-Marker (Lobby-Personalisierung). */
  isInterest?: boolean
}

export function TopicTile({ topic, points, used, onSelect, disabled, isInterest }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={used || disabled}
      aria-label={`${topic.label}, ${points} Punkte${used ? ', bereits gespielt' : ''}${isInterest ? ', gewähltes Interesse' : ''}`}
      className={cn(
        'group relative aspect-[4/3] rounded-card border p-4 md:p-5 flex flex-col justify-between',
        'transition-all duration-200 select-none text-left',
        'bg-navy-700',
        // Interessen-Kacheln bekommen einen leicht purple durchschienenen Rand
        // — Marker, kein Zwangsfilter.
        isInterest && !used
          ? 'border-brand-purple/50 shadow-[0_0_20px_-8px_rgba(124,92,255,0.75)]'
          : 'border-white/[0.08]',
        !used && !disabled && 'hover:border-brand-cyan/40 hover:-translate-y-0.5 hover:bg-navy-600',
        used && 'opacity-35 grayscale cursor-not-allowed',
        disabled && !used && 'opacity-60 cursor-not-allowed',
      )}
    >
      {isInterest && !used && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-brand-purple shadow-[0_0_10px_rgba(124,92,255,0.9)]"
          title="Euer Interesse"
        />
      )}
      <div className="flex items-start justify-between">
        <span className="text-2xl md:text-3xl" aria-hidden>
          {topic.emoji}
        </span>
        <span className="font-display font-bold text-mode-ladder text-xl md:text-2xl tabular-nums">
          {points}
        </span>
      </div>
      <div>
        <div className="eyebrow">Kategorie</div>
        <div className="mt-1 font-display font-semibold text-ink text-lg md:text-xl leading-tight">
          {topic.label}
        </div>
      </div>
    </button>
  )
}
