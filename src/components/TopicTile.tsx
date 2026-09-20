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
}

export function TopicTile({ topic, points, used, onSelect, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={used || disabled}
      aria-label={`${topic.label}, ${points} Punkte${used ? ', bereits gespielt' : ''}`}
      className={cn(
        'group aspect-[4/3] rounded-card border p-4 md:p-5 flex flex-col justify-between',
        'transition-all duration-200 select-none text-left',
        'bg-navy-700 border-white/[0.08]',
        !used && !disabled && 'hover:border-brand-cyan/40 hover:-translate-y-0.5 hover:bg-navy-600',
        used && 'opacity-35 grayscale cursor-not-allowed',
        disabled && !used && 'opacity-60 cursor-not-allowed',
      )}
    >
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
