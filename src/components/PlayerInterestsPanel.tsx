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
import { ChevronDown, Search, X } from 'lucide-react'
import type {
  GameAction,
  Player,
  PlayerInterest,
  SkillLevel,
  Topic,
} from '@quizapp/shared'
import {
  TOPICS,
  TOPICS_BY_ID,
  getInterestSuggestionsForTopic,
  getCatalogTagsByTopic,
  buildInterestSearchIndex,
  searchInterests,
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
  defaultCollapsed = false,
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

  const hasInterests = activeCount > 0
  const activeInterests = me.interests

  return (
    <Card
      className={cn(
        'space-y-3 p-4',
        hasInterests
          ? 'border-brand-purple/40 bg-brand-purple/[0.06]'
          : 'border-brand-cyan/40 bg-brand-cyan/[0.06]',
      )}
    >
      {/* Prominenter Kopf: Titel + kompakter Collapse-Toggle */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'flex items-center gap-2 text-[10px] uppercase tracking-[0.32em]',
              hasInterests ? 'text-brand-purple-soft' : 'text-brand-cyan-soft',
            )}
          >
            <span aria-hidden>🎯</span>
            <span>{hasInterests ? 'Deine Interessen' : 'Personalisierung'}</span>
          </div>
          <div className="mt-0.5 text-lg font-semibold text-white">
            {hasInterests
              ? `${activeCount} ${activeCount === 1 ? 'Interesse' : 'Interessen'} aktiv`
              : 'Was interessiert dich?'}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {hasInterests
              ? 'Die Fragen orientieren sich an deinem Profil. Klick auf eine Kachel unten zykelt bisschen → gut → nerd → aus.'
              : 'Such nach einem Thema oder wähle eine Kategorie. Die Fragen passen sich an dich an.'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Panel öffnen' : 'Panel einklappen'}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 hover:text-white"
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')}
          />
        </button>
      </div>

      {/* Cross-Topic-Suche: immer sichtbar, auch wenn Rest eingeklappt. */}
      <InterestSearchInput me={me} send={send} disabled={disabled} />

      {/* Aktive Interessen als Chips (kompakt, klickbar): immer sichtbar,
          damit der Player sein Profil auf einen Blick sieht. Klick zykelt
          das Level; die kleine „+"-Zahl ruft den Sub-Tag-Editor auf. */}
      {activeInterests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeInterests.map((interest) => {
            const topicDef = TOPICS_BY_ID[interest.topic]
            if (!topicDef) return null
            const tone =
              interest.level === 2 || interest.level === 3 || interest.level === 5
                ? LEVEL_TONE[interest.level]
                : 'bg-white/[0.04] text-white/70 border-white/10'
            const tagCount = interest.tags?.length ?? 0
            return (
              <div
                key={interest.topic}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
                  tone,
                )}
              >
                <span aria-hidden>{topicDef.emoji}</span>
                <button
                  type="button"
                  onClick={() => toggleLevel(interest.topic)}
                  disabled={disabled}
                  title={`Level: ${LEVEL_LABEL[interest.level]} — klicken zum Zykeln`}
                  className="font-medium disabled:opacity-60"
                >
                  {topicDef.label}
                </button>
                <span className="rounded bg-white/20 px-1 text-[9px] font-bold uppercase tracking-wider">
                  {LEVEL_LABEL[interest.level].slice(0, 3)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedTopic(
                      expandedTopic === interest.topic ? null : interest.topic,
                    )
                  }
                  disabled={disabled}
                  title="Sub-Interessen"
                  className="text-[10px] opacity-70 hover:opacity-100 disabled:opacity-40"
                >
                  {tagCount > 0 ? `+${tagCount}` : '+'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Inline Sub-Tag-Editor für das expandierte Topic */}
      {expandedTopic && (
        <SubTagEditor
          topic={expandedTopic}
          currentTags={interestByTopic.get(expandedTopic)?.tags ?? []}
          onChange={(tags) => setTags(expandedTopic, tags)}
          onClose={() => setExpandedTopic(null)}
          disabled={disabled}
        />
      )}

      {/* Kategorien-Grid: der zweite Weg, wenn man schnell scannen will.
          Bei collapsed=true blenden wir den Grid aus, Suche + aktive Chips
          bleiben aber greifbar. */}
      {!collapsed && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Kategorien direkt wählen
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {TOPICS.map((topic) => {
              const level = interestByTopic.get(topic.id)?.level
              const isActive = !!level
              const tone =
                level === 2 || level === 3 || level === 5
                  ? LEVEL_TONE[level]
                  : 'bg-white/[0.04] text-white/50 border-white/10'
              const isExpandedTopic = expandedTopic === topic.id
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => toggleLevel(topic.id)}
                  disabled={disabled}
                  title={
                    level ? `${topic.label} · ${LEVEL_LABEL[level]}` : topic.label
                  }
                  className={cn(
                    'flex w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-all disabled:opacity-40',
                    tone,
                    isExpandedTopic && 'ring-1 ring-white/30',
                  )}
                >
                  <span aria-hidden className="text-sm">
                    {topic.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{topic.label}</span>
                  {isActive && (
                    <span className="rounded-full bg-white/20 px-1 text-[9px] font-bold uppercase tracking-wider">
                      {LEVEL_LABEL[level!].slice(0, 3)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------- Cross-Topic-Suche ----------------------------------------------

/**
 * Suchfeld über alle 12 Topics + Katalog-Tags + Interest-Suggestions.
 *
 * Klick auf ein Ergebnis-Chip:
 *   1. Falls das Ziel-Topic nicht aktiv, aktivieren wir es mit Level 3 („gut").
 *      Der Spieler kann das Level danach über die Kachel weiter zykeln.
 *   2. Der Tag wird zum Sub-Interesse-Set dieses Topics hinzugefügt.
 *
 * Die zwei Dispatches laufen sequentiell — im server-authoritativen Modell
 * kommen zwei STATE-Broadcasts zurück; für ein Party-Party-Setup unkritisch.
 */
function InterestSearchInput({
  me,
  send,
  disabled,
}: {
  me: Player
  send: (a: GameAction) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')

  const index = useMemo(() => buildInterestSearchIndex(), [])

  // Set der bereits gewählten Tags (case-insensitive), damit die Suche keine
  // Chips für schon gesetzte Interessen wirft.
  const alreadyChosen = useMemo(() => {
    const s = new Set<string>()
    for (const i of me.interests) {
      for (const t of i.tags ?? []) s.add(t.trim().toLowerCase())
    }
    return s
  }, [me.interests])

  const results = useMemo(
    () => searchInterests(index, query, alreadyChosen, 8),
    [index, query, alreadyChosen],
  )

  const handlePick = (label: string, topic: Topic) => {
    if (disabled) return
    // 1) Topic aktivieren, falls noch nicht in den Interessen.
    const has = me.interests.some((i) => i.topic === topic)
    if (!has) {
      const newInterests: PlayerInterest[] = [
        ...me.interests,
        { topic, level: 3, tags: [label] },
      ]
      send({
        type: 'SET_PLAYER_INTERESTS',
        playerId: me.id,
        interests: newInterests,
      })
    } else {
      // 2) Topic hatten wir schon → nur den Tag anhängen (dedup case-insensitive).
      const currentTags = me.interests.find((i) => i.topic === topic)?.tags ?? []
      const lower = label.toLowerCase()
      if (currentTags.some((t) => t.toLowerCase() === lower)) {
        setQuery('')
        return
      }
      send({
        type: 'SET_PLAYER_INTEREST_TAGS',
        playerId: me.id,
        topic,
        tags: [...currentTags, label],
      })
    }
    setQuery('')
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Was interessiert dich? z. B. Marvel, Formel 1, Beatles"
          className="w-full rounded-lg bg-white/10 py-2 pl-8 pr-8 text-sm text-white placeholder-white/40 disabled:opacity-50"
          maxLength={40}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Leeren"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-white/50 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {query.trim().length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {results.length === 0 ? (
            <div className="rounded border border-dashed border-white/10 px-2 py-1.5 text-[11px] text-ink-muted">
              Kein passender Vorschlag. Öffne unten eine Kategorie, um freien
              Text als Sub-Interesse zu erfassen.
            </div>
          ) : (
            results.map((r) => {
              const topicDef = TOPICS_BY_ID[r.topic]
              return (
                <button
                  key={`${r.topic}:${r.label}`}
                  type="button"
                  onClick={() => handlePick(r.label, r.topic)}
                  disabled={disabled}
                  title={`Wird ${topicDef?.label} zugeordnet`}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-all disabled:opacity-40',
                    r.source === 'tag'
                      ? 'border-brand-purple/40 bg-brand-purple/[0.08] text-white hover:border-brand-purple/70 hover:bg-brand-purple/15'
                      : 'border-white/15 bg-white/[0.04] text-white/85 hover:border-white/30 hover:bg-white/10',
                  )}
                >
                  <span aria-hidden>{topicDef?.emoji}</span>
                  <span>{r.label}</span>
                </button>
              )
            })
          )}
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
