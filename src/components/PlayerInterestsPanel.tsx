/**
 * Kompaktes Interest-Panel für das Multi-Device-Roster.
 *
 * Zeigt dem Spieler auf seinem Handy alle 12 Topics zur Auswahl. Ein Klick
 * zyklt das Level (aus → bisschen → gut → nerd → aus). Aktivierte Topics
 * lassen sich aufklappen, um Sub-Interessen-Tags per Freitext oder aus
 * Vorschlägen zu ergänzen — genau die Chips, die der Server für den
 * Tag-Match-Bonus in `pickQuestion` nutzt.
 *
 * Bewusst schlanker als der Offline-Lobby-Editor (der ein Modal-Popover
 * benutzt): Auf dem Handy klappt alles inline auf, kein extra Modal-Kontext.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type {
  GameAction,
  Player,
  PlayerInterest,
  SkillLevel,
  Topic,
} from '@quizapp/shared'
import {
  TOPICS,
  getInterestSuggestionsForTopic,
  getCatalogTagsByTopic,
} from '@quizapp/shared'
import { Card } from './Card'
import { Button } from './Button'
import { cn } from '@/lib/classnames'

const LEVEL_LABEL: Record<SkillLevel, string> = {
  1: 'keine Ahnung',
  2: 'bisschen',
  3: 'gut',
  4: 'sehr gut',
  5: 'nerd',
}

/**
 * Ein-Klick-Zyklus für Handy-UI: aus → bisschen → gut → nerd → aus.
 * Level 1 und 4 tauchen im UI nicht auf (siehe Konzept: drei Stufen genügen).
 */
function nextLevel(current: SkillLevel | undefined): SkillLevel | undefined {
  if (!current) return 2
  if (current === 2) return 3
  if (current === 3) return 5
  return undefined
}

const LEVEL_TONE: Record<2 | 3 | 5, string> = {
  2: 'bg-brand-cyan/15 text-brand-cyan-soft border-brand-cyan/40',
  3: 'bg-brand-purple/15 text-brand-purple-soft border-brand-purple/40',
  5: 'bg-mode-ladder/15 text-mode-ladder border-mode-ladder/40',
}

export interface PlayerInterestsPanelProps {
  me: Player
  send: (a: GameAction) => void
  disabled?: boolean
  /** Startet expanded (auf großem Bildschirm) oder eingeklappt (auf Handy). */
  defaultCollapsed?: boolean
}

export function PlayerInterestsPanel({
  me,
  send,
  disabled,
  defaultCollapsed = true,
}: PlayerInterestsPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [expandedTopic, setExpandedTopic] = useState<Topic | null>(null)

  const interestByTopic = useMemo(() => {
    const m = new Map<Topic, PlayerInterest>()
    for (const i of me.interests) m.set(i.topic, i)
    return m
  }, [me.interests])

  const activeCount = me.interests.length

  const toggleLevel = (topic: Topic) => {
    if (disabled) return
    const current = interestByTopic.get(topic)?.level
    const next = nextLevel(current)
    // Neue Interessen-Liste bauen: existierendes Topic ersetzen, sonst hinzufügen.
    const others = me.interests.filter((i) => i.topic !== topic)
    const newInterests: PlayerInterest[] = next
      ? [
          ...others,
          {
            topic,
            level: next,
            tags: interestByTopic.get(topic)?.tags,
          },
        ]
      : others
    send({
      type: 'SET_PLAYER_INTERESTS',
      playerId: me.id,
      interests: newInterests,
    })
  }

  const setTags = (topic: Topic, tags: string[]) => {
    if (disabled) return
    send({
      type: 'SET_PLAYER_INTEREST_TAGS',
      playerId: me.id,
      topic,
      tags,
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 text-xs text-white/70 hover:text-white"
      >
        <span className="uppercase tracking-[0.22em]">
          Interessen ({activeCount}/12)
        </span>
        <div className="flex-1" />
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            collapsed && '-rotate-90',
          )}
        />
      </button>

      {!collapsed && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {TOPICS.map((topic) => {
              const level = interestByTopic.get(topic.id)?.level
              const tags = interestByTopic.get(topic.id)?.tags ?? []
              const isActive = !!level
              const tone =
                level === 2 || level === 3 || level === 5
                  ? LEVEL_TONE[level]
                  : 'bg-white/[0.04] text-white/50 border-white/10'
              const isExpanded = expandedTopic === topic.id
              return (
                <div key={topic.id} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleLevel(topic.id)}
                    disabled={disabled}
                    title={
                      level
                        ? `${topic.label} · ${LEVEL_LABEL[level]}`
                        : topic.label
                    }
                    className={cn(
                      'flex w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-all disabled:opacity-40',
                      tone,
                      isExpanded && 'ring-1 ring-white/30',
                    )}
                  >
                    <span aria-hidden className="text-sm">
                      {topic.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {topic.label}
                    </span>
                    {isActive && (
                      <span className="rounded-full bg-white/20 px-1 text-[9px] font-bold uppercase tracking-wider">
                        {LEVEL_LABEL[level!].slice(0, 3)}
                      </span>
                    )}
                  </button>
                  {isActive && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTopic(isExpanded ? null : topic.id)
                      }
                      disabled={disabled}
                      className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-navy-800 text-white/80 hover:border-white/40 disabled:opacity-40"
                      title="Sub-Interessen"
                    >
                      <span className="text-[10px] font-bold">
                        {tags.length > 0 ? tags.length : '+'}
                      </span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Inline Sub-Tag-Editor für das gerade expandierte Topic */}
          {expandedTopic && (
            <SubTagEditor
              topic={expandedTopic}
              currentTags={interestByTopic.get(expandedTopic)?.tags ?? []}
              onChange={(tags) => setTags(expandedTopic, tags)}
              onClose={() => setExpandedTopic(null)}
              disabled={disabled}
            />
          )}

          <p className="text-[10px] text-ink-muted">
            Tipp: Klick durchzykelt das Level (bisschen → gut → nerd → aus).
            Klick auf die Zahl unten rechts öffnet Sub-Interessen.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------- Sub-Tag-Editor ---------------------------------------------------

function SubTagEditor({
  topic,
  currentTags,
  onChange,
  onClose,
  disabled,
}: {
  topic: Topic
  currentTags: readonly string[]
  onChange: (tags: string[]) => void
  onClose: () => void
  disabled?: boolean
}) {
  const [input, setInput] = useState('')

  const catalogTags = useMemo(() => {
    const map = getCatalogTagsByTopic()
    return map[topic] ?? []
  }, [topic])

  const suggestions = useMemo(
    () => getInterestSuggestionsForTopic(topic, catalogTags, currentTags),
    [topic, catalogTags, currentTags],
  )

  const addTag = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    const lower = t.toLowerCase()
    if (currentTags.some((x) => x.toLowerCase() === lower)) return
    onChange([...currentTags, t])
    setInput('')
  }

  const removeTag = (tag: string) => {
    onChange(currentTags.filter((x) => x !== tag))
  }

  const filteredSuggestions = useMemo(() => {
    if (!input.trim()) return suggestions.slice(0, 12)
    const q = input.toLowerCase()
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 12)
  }, [suggestions, input])

  return (
    <Card className="space-y-2 border-white/15 bg-navy-800/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/70">
          Sub-Interessen · {topic}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/50 hover:text-white"
          title="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Gewählte Tags */}
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-2 py-0.5 text-xs text-brand-purple-soft hover:bg-brand-purple/30 disabled:opacity-40"
            >
              {tag}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(input)
            }
          }}
          disabled={disabled}
          placeholder="z. B. Basketball, Marvel …"
          className="flex-1 rounded bg-white/10 px-2 py-1.5 text-sm text-white placeholder-white/30 disabled:opacity-40"
          maxLength={40}
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => addTag(input)}
          disabled={disabled || !input.trim()}
        >
          +
        </Button>
      </div>

      {/* Vorschläge */}
      {filteredSuggestions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/50">
            Vorschläge
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {filteredSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                disabled={disabled}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-white/80 hover:border-white/30 hover:bg-white/10 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
