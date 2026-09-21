/**
 * Fullscreen-Modal zum Bearbeiten oder Neu-Anlegen einer Frage.
 *
 * Wird von der Review-Page geöffnet. Speichert per HTTP-API
 * (`createQuestion` oder `updateQuestion`) und ruft `onSaved` mit der
 * vom Server bestätigten Frage zurück — die enthält die finale ID +
 * aktualisierte `updatedAt`-Zeitstempel.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Save, Trash2, X } from 'lucide-react'
import type {
  Difficulty,
  Question,
  QuestionType,
  Topic,
} from '@quizapp/shared'
import { TOPICS } from '@quizapp/shared'
import { Button } from './Button'
import { Card } from './Card'
import {
  createQuestion,
  deleteQuestion,
  updateQuestion,
} from '@/lib/questionsApi'
import { cn } from '@/lib/classnames'

const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5]
const TYPES: readonly QuestionType[] = [
  'multiple-choice',
  'true-false',
  'warmup-riddle',
  'open',
]

const TYPE_LABEL: Record<QuestionType, string> = {
  'multiple-choice': 'Multiple Choice',
  'true-false': 'Wahr / Falsch',
  'warmup-riddle': 'Klick-Rätsel',
  'open': 'Offen',
}

export interface QuestionEditorModalProps {
  initial: Question
  /** true wenn die Frage neu ist (Create), false wenn Update. */
  isNew: boolean
  onSaved: (saved: Question) => void
  onDeleted?: (id: string) => void
  onClose: () => void
}

export function QuestionEditorModal({
  initial,
  isNew,
  onSaved,
  onDeleted,
  onClose,
}: QuestionEditorModalProps) {
  const [draft, setDraft] = useState<Question>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  // Reset draft wenn initial wechselt (z. B. zwischen zwei Bearbeitungen).
  useEffect(() => setDraft(initial), [initial])

  // ESC schließt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const saved = isNew
        ? await createQuestion(draft)
        : await updateQuestion(draft.id, draft)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!draft.id) return
    if (!window.confirm('Diese Frage wirklich löschen? Nicht rückgängig zu machen.')) {
      return
    }
    setError(null)
    setBusy(true)
    try {
      await deleteQuestion(draft.id)
      onDeleted?.(draft.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  // ---------- Type-spezifische Felder ------------------------------------

  const renderTypeFields = () => {
    switch (draft.type) {
      case 'multiple-choice':
        return (
          <MultipleChoiceFields
            options={draft.options}
            correctIndex={draft.correctIndex}
            onChange={(options, correctIndex) =>
              setDraft({ ...draft, options, correctIndex })
            }
          />
        )
      case 'true-false':
        return (
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
              Richtige Antwort
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, correctAnswer: true })}
                className={cn(
                  'rounded-lg border py-2 text-sm font-semibold',
                  draft.correctAnswer
                    ? 'border-correct/60 bg-correct/15 text-correct'
                    : 'border-white/10 bg-white/[0.03] text-white/70',
                )}
              >
                Stimmt
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, correctAnswer: false })}
                className={cn(
                  'rounded-lg border py-2 text-sm font-semibold',
                  !draft.correctAnswer
                    ? 'border-wrong/60 bg-wrong/15 text-wrong'
                    : 'border-white/10 bg-white/[0.03] text-white/70',
                )}
              >
                Falsch
              </button>
            </div>
          </div>
        )
      case 'warmup-riddle':
        return (
          <>
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                Hinweise (in aufsteigender Deutlichkeit)
              </label>
              <div className="mt-1 space-y-1.5">
                {draft.hints.map((h, i) => (
                  <input
                    key={i}
                    value={h}
                    onChange={(e) => {
                      const hints = [...draft.hints]
                      hints[i] = e.target.value
                      setDraft({ ...draft, hints })
                    }}
                    className="w-full rounded bg-white/10 px-3 py-1.5 text-sm text-white"
                    placeholder={`Hinweis ${i + 1}`}
                  />
                ))}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() =>
                      setDraft({ ...draft, hints: [...draft.hints, ''] })
                    }
                  >
                    + Hinweis
                  </Button>
                  {draft.hints.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() =>
                        setDraft({ ...draft, hints: draft.hints.slice(0, -1) })
                      }
                    >
                      – letzter
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                Lösung
              </label>
              <input
                value={draft.solution}
                onChange={(e) => setDraft({ ...draft, solution: e.target.value })}
                className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-white"
              />
            </div>
          </>
        )
      case 'open':
        return (
          <>
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                Antwort
              </label>
              <input
                value={draft.answer}
                onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
                className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-white"
              />
            </div>
          </>
        )
    }
  }

  const currentTags = draft.tags ?? []
  const addTag = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    if (currentTags.some((x) => x.toLowerCase() === t.toLowerCase())) return
    setDraft({ ...draft, tags: [...currentTags, t] })
    setTagInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur">
      <form
        onSubmit={submit}
        className="my-6 w-full max-w-3xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-brand-purple-soft">
                {isNew ? 'Neue Frage anlegen' : 'Frage bearbeiten'}
              </div>
              {!isNew && (
                <div className="mt-1 font-mono text-xs text-ink-muted">
                  id: {draft.id}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/50 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Topic + Type + Difficulty */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                Topic
              </label>
              <select
                value={draft.topic}
                onChange={(e) =>
                  setDraft({ ...draft, topic: e.target.value as Topic })
                }
                className="mt-1 w-full rounded bg-white/10 px-2 py-2 text-white"
              >
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                Typ
              </label>
              <select
                value={draft.type}
                onChange={(e) => {
                  // Type-Wechsel ist heikel: die Felder unterscheiden sich stark.
                  // Beim Wechsel setzen wir sinnvolle Defaults.
                  const newType = e.target.value as QuestionType
                  if (newType === draft.type) return
                  const base = { ...draft, type: newType } as Record<string, unknown>
                  // Alte type-spezifische Felder wegwerfen.
                  delete base.options
                  delete base.correctIndex
                  delete base.correctAnswer
                  delete base.hints
                  delete base.solution
                  delete base.answer
                  if (newType === 'multiple-choice') {
                    base.options = ['', '', '', '']
                    base.correctIndex = 0
                  } else if (newType === 'true-false') {
                    base.correctAnswer = true
                  } else if (newType === 'warmup-riddle') {
                    base.hints = ['', '', '']
                    base.solution = ''
                  } else if (newType === 'open') {
                    base.answer = ''
                  }
                  setDraft(base as unknown as Question)
                }}
                disabled={!isNew}
                className="mt-1 w-full rounded bg-white/10 px-2 py-2 text-white disabled:opacity-50"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              {!isNew && (
                <div className="mt-1 text-[10px] text-ink-muted">
                  Typ nicht änderbar bei Bearbeitung
                </div>
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                Difficulty
              </label>
              <div className="mt-1 flex gap-1">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDraft({ ...draft, difficulty: d })}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded font-mono text-sm',
                      draft.difficulty === d
                        ? 'bg-brand-purple/25 text-brand-purple-soft ring-1 ring-brand-purple/60'
                        : 'bg-white/10 text-white/70',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fragetext */}
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
              Fragetext
            </label>
            <textarea
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-base text-white"
              rows={3}
              required
            />
          </div>

          {/* Type-spezifische Felder */}
          {renderTypeFields()}

          {/* Erklärung + GM-Notiz */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                Öffentliche Erklärung
              </label>
              <textarea
                value={draft.explanation ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, explanation: e.target.value || undefined })
                }
                className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-sm text-white"
                rows={3}
                placeholder="Wird nach dem Reveal angezeigt"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
                GM-Notiz (intern)
              </label>
              <textarea
                value={draft.gmNote ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, gmNote: e.target.value || undefined })
                }
                className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-sm text-white"
                rows={3}
                placeholder="Nur für den Quizmaster"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
              Tags
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {currentTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      tags: currentTags.filter((t) => t !== tag),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-2 py-0.5 text-xs text-brand-purple-soft"
                >
                  {tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag(tagInput)
                  }
                }}
                placeholder="z. B. Basketball, Marvel …"
                className="flex-1 rounded bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30"
                maxLength={40}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim()}
              >
                +
              </Button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
              Status
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(['draft', 'reviewed', 'approved', 'retired'] as const).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft({ ...draft, status: s })}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs',
                      draft.status === s
                        ? 'border-brand-cyan/60 bg-brand-cyan/10 text-brand-cyan-soft'
                        : 'border-white/10 bg-white/[0.03] text-white/60',
                    )}
                  >
                    {s}
                  </button>
                ),
              )}
              {draft.status && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, status: undefined })}
                  className="text-xs text-ink-muted hover:text-white"
                >
                  löschen
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded bg-red-500/20 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            {!isNew && onDeleted && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={busy}
                leading={<Trash2 className="h-4 w-4" />}
              >
                Löschen
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !draft.question.trim()}
              leading={
                busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )
              }
            >
              {isNew ? 'Anlegen' : 'Speichern'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}

// ---------- Multiple-Choice Sub-Field ---------------------------------------

function MultipleChoiceFields({
  options,
  correctIndex,
  onChange,
}: {
  options: string[]
  correctIndex: number
  onChange: (options: string[], correctIndex: number) => void
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.22em] text-ink-muted">
        Antwort-Optionen (radio = richtig)
      </label>
      <div className="mt-1 space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correctIndex"
              checked={correctIndex === i}
              onChange={() => onChange(options, i)}
              className="h-4 w-4 accent-brand-purple"
            />
            <input
              value={opt}
              onChange={(e) => {
                const next = [...options]
                next[i] = e.target.value
                onChange(next, correctIndex)
              }}
              className={cn(
                'flex-1 rounded bg-white/10 px-3 py-1.5 text-sm text-white',
                correctIndex === i && 'ring-1 ring-brand-purple/40',
              )}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => {
                  const next = options.filter((_, idx) => idx !== i)
                  const newCorrect =
                    correctIndex === i ? 0 : correctIndex > i ? correctIndex - 1 : correctIndex
                  onChange(next, newCorrect)
                }}
                className="text-white/40 hover:text-wrong"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onChange([...options, ''], correctIndex)}
          >
            + Option
          </Button>
        )}
      </div>
    </div>
  )
}
