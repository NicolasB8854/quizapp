/**
 * Fragen-Review — Prototyp-Tool zum Katalog-Durchsuchen.
 *
 * Erreichbar über das Zahnrad-Menü im TopNav. Read-only in v1: keine Bearbeitung,
 * kein Status-Wechsel. Ziel ist Übersicht + Sanity-Check über den aktuellen Bestand.
 *
 * Layout:
 *  - Statistik-Zeile: Total + Verteilungen (Difficulty, Type, Status).
 *  - Filter-Zeile: Topic-Chips, Difficulty-Chips, Type-Buttons, Freitext-Suche.
 *  - Ergebnis-Liste: Karten mit Kontext-Snippet und Tags.
 *  - Detail-Overlay: alle Felder inkl. richtiger Antwort und Meta-Daten.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, X as XIcon, Check, Tag, Calendar, ExternalLink, Sparkles,
} from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { getAllQuestions } from '@/lib/questions'
import { TOPICS_BY_ID } from '@/data/topics'
import type { Difficulty, Question, QuestionType, Topic } from '@/types/question'
import { cn } from '@/lib/classnames'

// UI-Helper: alle möglichen Difficulty-Stufen (1-5) und Frage-Typen
const ALL_DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5]
const ALL_TYPES: readonly QuestionType[] = ['multiple-choice', 'true-false', 'warmup-riddle', 'open']

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: 'kinderleicht',
  2: 'leicht',
  3: 'mittel',
  4: 'schwer',
  5: 'experte',
}

const TYPE_LABEL: Record<QuestionType, string> = {
  'multiple-choice': 'Multiple Choice',
  'true-false':      'Wahr / Falsch',
  'warmup-riddle':   'Klick-Rätsel',
  'open':            'Offen',
}

const TYPE_SHORT: Record<QuestionType, string> = {
  'multiple-choice': 'MC',
  'true-false':      'TF',
  'warmup-riddle':   'WR',
  'open':            'OP',
}

export default function ReviewPage() {
  const navigate = useNavigate()
  const catalog = useMemo(() => getAllQuestions(), [])

  const [topicFilter,      setTopicFilter]      = useState<Topic | 'all'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all')
  const [typeFilter,       setTypeFilter]       = useState<QuestionType | 'all'>('all')
  const [statusFilter,     setStatusFilter]     = useState<string>('all')
  const [search,           setSearch]           = useState('')
  const [detailId,         setDetailId]         = useState<string | null>(null)

  // Alle vorkommenden Status-Werte für den Filter
  const statusesInCatalog = useMemo(() => {
    const set = new Set<string>()
    for (const q of catalog) if (q.status) set.add(q.status)
    return Array.from(set).sort()
  }, [catalog])

  // Gefilterte Liste
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((entry) => {
      if (topicFilter !== 'all' && entry.topic !== topicFilter) return false
      if (difficultyFilter !== 'all' && entry.difficulty !== difficultyFilter) return false
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false
      if (q) {
        const hay = [
          entry.id,
          entry.question,
          entry.gmNote ?? '',
          entry.explanation ?? '',
          ...(entry.tags ?? []),
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [catalog, topicFilter, difficultyFilter, typeFilter, statusFilter, search])

  const detail = detailId ? catalog.find((q) => q.id === detailId) ?? null : null

  const totalStats = useMemo(() => computeStats(catalog), [catalog])
  const filteredStats = useMemo(() => computeStats(filtered), [filtered])

  return (
    <ScreenLayout
      variant="dim"
      navActions={
        <Button
          variant="ghost"
          size="md"
          leading={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/')}
        >
          Zurück
        </Button>
      }
      headerMeta="Prototyp-Tools · Fragen-Review"
    >
      <div className="mx-auto max-w-6xl pt-2 md:pt-6 pb-14 animate-titleIn">
        {/* Kopfzeile */}
        <div>
          <div className="eyebrow">Fragen-Katalog</div>
          <h1 className="mt-3 font-display font-bold uppercase text-white leading-[0.9] tracking-tight text-4xl md:text-6xl">
            Review &amp; <span className="text-neon-purple">Sichtung</span>
          </h1>
          <p className="mt-4 text-ink-muted text-sm md:text-base max-w-2xl leading-relaxed">
            Der komplette Katalog auf einen Blick — Filter für Topic, Schwierigkeit,
            Typ und Status. Klick auf eine Frage öffnet die volle Ansicht mit
            Antwort, Erklärung und Meta-Daten.
          </p>
        </div>

        {/* Statistik-Zeile */}
        <StatsBar total={totalStats} filtered={filteredStats} />

        {/* Filter-Zeile */}
        <FilterBar
          topicFilter={topicFilter}
          setTopicFilter={setTopicFilter}
          difficultyFilter={difficultyFilter}
          setDifficultyFilter={setDifficultyFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusesInCatalog={statusesInCatalog}
          search={search}
          setSearch={setSearch}
        />

        {/* Ergebnis-Liste */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-ink-muted uppercase tracking-[0.22em]">
            <span>
              <span className="text-ink font-bold">{filtered.length}</span> von{' '}
              <span className="text-ink font-bold">{catalog.length}</span> Fragen
            </span>
            {filtered.length !== catalog.length && (
              <button
                type="button"
                onClick={() => {
                  setTopicFilter('all')
                  setDifficultyFilter('all')
                  setTypeFilter('all')
                  setStatusFilter('all')
                  setSearch('')
                }}
                className="text-brand-cyan-soft hover:text-brand-cyan transition-colors"
              >
                Filter zurücksetzen →
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-ink-muted">Keine Fragen passen zum Filter.</div>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((q) => (
                <QuestionListCard
                  key={q.id}
                  question={q}
                  onOpen={() => setDetailId(q.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail-Overlay */}
      {detail && (
        <QuestionDetail
          question={detail}
          onClose={() => setDetailId(null)}
        />
      )}
    </ScreenLayout>
  )
}

// ---------- Statistik-Zeile ---------------------------------------------------

interface Stats {
  total: number
  byDifficulty: Record<number, number>
  byType: Record<string, number>
  byTopic: Record<string, number>
  withTags: number
  withoutTags: number
}

function computeStats(list: readonly Question[]): Stats {
  const s: Stats = {
    total: list.length,
    byDifficulty: {},
    byType: {},
    byTopic: {},
    withTags: 0,
    withoutTags: 0,
  }
  for (const q of list) {
    if (q.difficulty !== undefined) {
      s.byDifficulty[q.difficulty] = (s.byDifficulty[q.difficulty] ?? 0) + 1
    }
    s.byType[q.type] = (s.byType[q.type] ?? 0) + 1
    s.byTopic[q.topic] = (s.byTopic[q.topic] ?? 0) + 1
    if (q.tags && q.tags.length > 0) s.withTags++
    else s.withoutTags++
  }
  return s
}

interface StatsBarProps {
  total: Stats
  filtered: Stats
}

function StatsBar({ total, filtered }: StatsBarProps) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total"
        value={total.total.toString()}
        hint={`${filtered.total} nach Filter`}
      />
      <StatCard
        label="Difficulty"
        value={ALL_DIFFICULTIES.map((d) => `${total.byDifficulty[d] ?? 0}`).join(' · ')}
        hint="1 · 2 · 3 · 4 · 5"
      />
      <StatCard
        label="Typen"
        value={Object.entries(total.byType)
          .map(([t, n]) => `${TYPE_SHORT[t as QuestionType]} ${n}`)
          .join(' · ')}
        hint="MC · TF · WR"
      />
      <StatCard
        label="Tags gepflegt"
        value={`${total.withTags} / ${total.total}`}
        hint={`${total.withoutTags} ohne Tags`}
        accent={total.withTags === 0 ? 'muted' : 'ok'}
      />
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
  accent?: 'muted' | 'ok'
}

function StatCard({ label, value, hint, accent }: StatCardProps) {
  return (
    <div className="rounded-card border border-white/10 bg-navy-800/60 p-4">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          'mt-1 font-display font-bold text-lg tabular-nums leading-tight truncate',
          accent === 'ok' && 'text-correct',
          accent === 'muted' && 'text-ink-muted',
          !accent && 'text-ink',
        )}
        title={value}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          {hint}
        </div>
      )}
    </div>
  )
}

// ---------- Filter-Bar --------------------------------------------------------

interface FilterBarProps {
  topicFilter: Topic | 'all'
  setTopicFilter: (v: Topic | 'all') => void
  difficultyFilter: Difficulty | 'all'
  setDifficultyFilter: (v: Difficulty | 'all') => void
  typeFilter: QuestionType | 'all'
  setTypeFilter: (v: QuestionType | 'all') => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  statusesInCatalog: string[]
  search: string
  setSearch: (v: string) => void
}

function FilterBar(props: FilterBarProps) {
  return (
    <Card className="mt-6 p-4 md:p-5 space-y-4">
      {/* Suchfeld */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
        <input
          type="search"
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
          placeholder="Suche in Frage, gmNote, Tags oder ID…"
          className={cn(
            'w-full h-10 rounded-lg pl-10 pr-9 text-sm',
            'bg-navy-900/60 border border-white/10 text-ink',
            'placeholder:text-ink-faint focus:outline-none focus:border-brand-purple/60',
          )}
        />
        {props.search && (
          <button
            type="button"
            onClick={() => props.setSearch('')}
            aria-label="Suche löschen"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Topic-Chips */}
      <div>
        <div className="eyebrow mb-2">Topic</div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={props.topicFilter === 'all'}
            onClick={() => props.setTopicFilter('all')}
          >
            Alle
          </FilterChip>
          {Object.entries(TOPICS_BY_ID).map(([id, t]) => (
            <FilterChip
              key={id}
              active={props.topicFilter === id}
              onClick={() => props.setTopicFilter(id as Topic)}
            >
              <span className="mr-1" aria-hidden>{t.emoji}</span>
              {t.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Difficulty + Type + Status in einer Reihe */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="eyebrow mb-2">Schwierigkeit</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={props.difficultyFilter === 'all'}
              onClick={() => props.setDifficultyFilter('all')}
            >
              Alle
            </FilterChip>
            {ALL_DIFFICULTIES.map((d) => (
              <FilterChip
                key={d}
                active={props.difficultyFilter === d}
                onClick={() => props.setDifficultyFilter(d)}
              >
                {d} · {DIFFICULTY_LABEL[d]}
              </FilterChip>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow mb-2">Typ</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={props.typeFilter === 'all'}
              onClick={() => props.setTypeFilter('all')}
            >
              Alle
            </FilterChip>
            {ALL_TYPES.map((t) => (
              <FilterChip
                key={t}
                active={props.typeFilter === t}
                onClick={() => props.setTypeFilter(t)}
              >
                {TYPE_LABEL[t]}
              </FilterChip>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow mb-2">Status</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={props.statusFilter === 'all'}
              onClick={() => props.setStatusFilter('all')}
            >
              Alle
            </FilterChip>
            {props.statusesInCatalog.map((s) => (
              <FilterChip
                key={s}
                active={props.statusFilter === s}
                onClick={() => props.setStatusFilter(s)}
              >
                {s}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

interface FilterChipProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center h-7 rounded-full px-3',
        'text-[11px] font-medium border transition-all',
        active
          ? 'bg-brand-purple/25 border-brand-purple/70 text-white'
          : 'bg-navy-900/60 border-white/10 text-ink-muted hover:border-white/25 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

// ---------- Frage-Karte in der Liste ------------------------------------------

interface QuestionListCardProps {
  question: Question
  onOpen: () => void
}

function QuestionListCard({ question, onOpen }: QuestionListCardProps) {
  const topic = TOPICS_BY_ID[question.topic]
  const diffBadge = question.difficulty !== undefined
    ? <DifficultyBadge difficulty={question.difficulty} />
    : null

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full text-left rounded-card border border-white/10 bg-navy-800/60 p-4 md:p-5',
        'hover:border-brand-purple/50 hover:bg-navy-800/80 transition-colors',
        'focus-visible:outline-none focus-visible:border-brand-purple',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-2xl leading-none mt-0.5" aria-hidden>
          {topic?.emoji ?? '❓'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-xs uppercase tracking-[0.22em] text-brand-purple-soft">
              {topic?.label ?? question.topic}
            </span>
            <span className="text-ink-faint">·</span>
            <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              {TYPE_SHORT[question.type]}
            </span>
            {diffBadge}
            <span className="text-ink-faint">·</span>
            <span className="text-[10px] font-mono text-ink-faint">{question.id}</span>
          </div>
          <div className="mt-1.5 font-display font-medium text-ink text-sm md:text-base leading-snug">
            {question.question}
          </div>

          <QuestionAnswerLine question={question} />

          {question.tags && question.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {question.tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 h-5 rounded-full px-2 text-[10px] bg-white/[0.04] border border-white/10 text-ink-muted"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {t}
                </span>
              ))}
              {question.tags.length > 6 && (
                <span className="text-[10px] text-ink-faint">
                  +{question.tags.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

/** Kompakte Zeile mit „richtige Antwort" — bei MC/TF/WR unterschiedlich. */
function QuestionAnswerLine({ question }: { question: Question }) {
  if (question.type === 'multiple-choice') {
    const ans = question.options[question.correctIndex]
    return (
      <div className="mt-1.5 text-[11px] text-correct">
        <Check className="inline-block h-3 w-3 mr-1" />
        <span className="font-medium">{ans}</span>
      </div>
    )
  }
  if (question.type === 'true-false') {
    return (
      <div className="mt-1.5 text-[11px] text-correct">
        <Check className="inline-block h-3 w-3 mr-1" />
        <span className="font-medium">
          {question.correctAnswer ? 'Wahr' : 'Falsch'}
        </span>
      </div>
    )
  }
  if (question.type === 'warmup-riddle') {
    return (
      <div className="mt-1.5 text-[11px] text-ink-muted line-clamp-2">
        <span className="text-brand-cyan-soft">Auflösung: </span>
        {question.solution}
      </div>
    )
  }
  if (question.type === 'open') {
    return (
      <div className="mt-1.5 text-[11px] text-correct">
        <Check className="inline-block h-3 w-3 mr-1" />
        <span className="font-medium">{question.answer}</span>
      </div>
    )
  }
  return null
}

// ---------- Difficulty-Badge --------------------------------------------------

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const tone = difficultyTone(difficulty)
  return (
    <Badge tone={tone} className="!py-0.5 !px-2 !text-[10px]">
      D{difficulty} · {DIFFICULTY_LABEL[difficulty]}
    </Badge>
  )
}

function difficultyTone(d: Difficulty): 'correct' | 'cyan' | 'purple' | 'orange' | 'wrong' {
  if (d === 1) return 'correct'
  if (d === 2) return 'cyan'
  if (d === 3) return 'purple'
  if (d === 4) return 'orange'
  return 'wrong'
}

// ---------- Detail-Overlay ----------------------------------------------------

interface QuestionDetailProps {
  question: Question
  onClose: () => void
}

function QuestionDetail({ question, onClose }: QuestionDetailProps) {
  const topic = TOPICS_BY_ID[question.topic]

  return (
    <div
      className="fixed inset-0 z-40 flex items-start md:items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-label="Fragen-Detail"
    >
      {/* Dimmer */}
      <button
        type="button"
        aria-label="Detail schließen"
        onClick={onClose}
        className="absolute inset-0 bg-navy-900/85 backdrop-blur-sm cursor-default"
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-card border border-brand-purple/30 bg-navy-800 shadow-neon-purple">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5 md:p-6 border-b border-white/10 bg-navy-800/95 backdrop-blur">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-3xl leading-none mt-1" aria-hidden>
              {topic?.emoji ?? '❓'}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-semibold text-xs uppercase tracking-[0.22em] text-brand-purple-soft">
                  {topic?.label ?? question.topic}
                </span>
                <span className="text-ink-faint">·</span>
                <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                  {TYPE_LABEL[question.type]}
                </span>
                {question.difficulty !== undefined && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <DifficultyBadge difficulty={question.difficulty} />
                  </>
                )}
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-faint break-all">
                {question.id}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="shrink-0 h-8 w-8 rounded-full inline-flex items-center justify-center text-ink-muted hover:text-ink hover:bg-white/10"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-5">
          {/* Frage */}
          <section>
            <div className="eyebrow mb-2">Frage</div>
            <p className="font-display font-medium text-ink text-lg md:text-xl leading-relaxed">
              {question.question}
            </p>
          </section>

          {/* Antwort — je nach Type */}
          <AnswerSection question={question} />

          {/* Meta-Infos: Kategorie, Tags */}
          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">Kategorie</div>
              <div className="text-sm text-ink">{question.category}</div>
              {question.subCategory && (
                <div className="text-xs text-ink-muted mt-0.5">
                  Sub: {question.subCategory}
                </div>
              )}
            </div>
            <div>
              <div className="eyebrow mb-2">Status</div>
              <div className="text-sm text-ink">
                {question.status ?? '—'}
                {question.aiGenerated && (
                  <Badge tone="purple" className="ml-2 !py-0.5 !px-2 !text-[10px]">
                    <Sparkles className="h-2.5 w-2.5 mr-1 inline-block" />
                    KI-generiert
                  </Badge>
                )}
              </div>
            </div>
          </section>

          {/* Tags */}
          <section>
            <div className="eyebrow mb-2">
              Tags {question.tags && `(${question.tags.length})`}
            </div>
            {question.tags && question.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {question.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 h-6 rounded-full px-2.5 text-[11px] bg-white/[0.05] border border-white/10 text-ink"
                  >
                    <Tag className="h-3 w-3 text-brand-purple-soft" />
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-ink-faint italic">
                Noch keine Tags — in <span className="font-mono">docs/content/questions-tags.json</span> pflegen.
              </div>
            )}
          </section>

          {/* Kompatible Modi */}
          {question.compatibleModes && question.compatibleModes.length > 0 && (
            <section>
              <div className="eyebrow mb-2">
                Kompatible Modi ({question.compatibleModes.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {question.compatibleModes.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center h-6 rounded-full px-2.5 text-[11px] bg-navy-900/60 border border-white/10 text-ink-muted"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* gmNote / Explanation */}
          {question.gmNote && (
            <section>
              <div className="eyebrow mb-2">Quizmaster-Notiz</div>
              <p className="text-sm text-ink-muted leading-relaxed">
                {question.gmNote}
              </p>
            </section>
          )}
          {question.explanation && question.explanation !== question.gmNote && (
            <section>
              <div className="eyebrow mb-2">Öffentliche Erklärung</div>
              <p className="text-sm text-ink leading-relaxed">
                {question.explanation}
              </p>
            </section>
          )}

          {/* Zeitbezug */}
          {(question.timeScope || question.referenceDate || question.expiresAt || question.verifiedAt) && (
            <section>
              <div className="eyebrow mb-2 inline-flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Zeitbezug
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {question.timeScope && (
                  <>
                    <dt className="text-ink-muted">Scope</dt>
                    <dd className="text-ink font-medium">{question.timeScope}</dd>
                  </>
                )}
                {question.referenceDate && (
                  <>
                    <dt className="text-ink-muted">Referenz</dt>
                    <dd className="text-ink">{question.referenceDate}</dd>
                  </>
                )}
                {question.expiresAt && (
                  <>
                    <dt className="text-ink-muted">Läuft ab</dt>
                    <dd className="text-ink">{question.expiresAt}</dd>
                  </>
                )}
                {question.verifiedAt && (
                  <>
                    <dt className="text-ink-muted">Zuletzt geprüft</dt>
                    <dd className="text-ink">{question.verifiedAt}</dd>
                  </>
                )}
              </dl>
            </section>
          )}

          {/* Quelle */}
          {question.source && (
            <section>
              <div className="eyebrow mb-2">Quelle</div>
              <a
                href={question.source}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-cyan-soft hover:text-brand-cyan transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {question.source}
              </a>
            </section>
          )}

          {/* Audit */}
          <section className="border-t border-white/5 pt-4 text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            {question.createdAt && (
              <span>Erstellt {question.createdAt.slice(0, 10)}</span>
            )}
            {question.updatedAt && (
              <span className="ml-4">Zuletzt {question.updatedAt.slice(0, 10)}</span>
            )}
            {question.author && <span className="ml-4">von {question.author}</span>}
          </section>
        </div>
      </div>
    </div>
  )
}

/** Antwort-Sektion — Rendering hängt vom question.type ab. */
function AnswerSection({ question }: { question: Question }) {
  if (question.type === 'multiple-choice') {
    return (
      <section>
        <div className="eyebrow mb-2">Optionen</div>
        <ol className="space-y-1.5">
          {question.options.map((opt, i) => {
            const isCorrect = i === question.correctIndex
            return (
              <li
                key={i}
                className={cn(
                  'flex items-start gap-3 rounded-lg px-3 py-2 border',
                  isCorrect
                    ? 'border-correct/60 bg-correct/10 text-ink'
                    : 'border-white/10 bg-navy-900/40 text-ink-muted',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-display font-bold',
                    isCorrect
                      ? 'bg-correct/25 text-correct'
                      : 'bg-white/[0.06] text-ink-muted',
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-snug">{opt}</span>
                {isCorrect && (
                  <span className="text-[10px] uppercase tracking-[0.22em] text-correct font-bold mt-1">
                    Richtig
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    )
  }
  if (question.type === 'true-false') {
    return (
      <section>
        <div className="eyebrow mb-2">Antwort</div>
        <div className="flex gap-3">
          <div
            className={cn(
              'flex-1 rounded-lg border-2 p-3 text-center',
              question.correctAnswer
                ? 'border-correct bg-correct/15 text-correct font-bold'
                : 'border-white/10 bg-navy-900/40 text-ink-muted',
            )}
          >
            Wahr
          </div>
          <div
            className={cn(
              'flex-1 rounded-lg border-2 p-3 text-center',
              !question.correctAnswer
                ? 'border-correct bg-correct/15 text-correct font-bold'
                : 'border-white/10 bg-navy-900/40 text-ink-muted',
            )}
          >
            Falsch
          </div>
        </div>
      </section>
    )
  }
  if (question.type === 'warmup-riddle') {
    return (
      <>
        <section>
          <div className="eyebrow mb-2">Hinweise ({question.hints.length})</div>
          <ol className="space-y-1.5">
            {question.hints.map((h, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-lg px-3 py-2 border border-white/10 bg-navy-900/40"
              >
                <span className="shrink-0 h-6 w-6 rounded-full bg-brand-cyan/20 text-brand-cyan-soft flex items-center justify-center text-[11px] font-display font-bold">
                  {i + 1}
                </span>
                <span className="text-sm text-ink leading-snug">{h}</span>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <div className="eyebrow mb-2">Auflösung</div>
          <p className="text-sm text-ink leading-relaxed">
            {question.solution}
          </p>
        </section>
      </>
    )
  }
  if (question.type === 'open') {
    return (
      <section>
        <div className="eyebrow mb-2">Antwort</div>
        <div className="rounded-lg border-2 border-correct bg-correct/15 p-3 text-correct font-bold text-sm">
          {question.answer}
        </div>
        {question.acceptableVariants && question.acceptableVariants.length > 0 && (
          <div className="mt-2 text-xs text-ink-muted">
            Akzeptierte Varianten:{' '}
            {question.acceptableVariants.join(', ')}
          </div>
        )}
      </section>
    )
  }
  return null
}
