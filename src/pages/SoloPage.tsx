/**
 * Solo-Runde — eine Person spielt allein (mobile first).
 *
 * Ablauf: Themen wählen (optional) → 10 Fragen, Stufe 1 → 5, je 20 s →
 * nach jeder Frage Auflösung mit Erklärung → Ergebnis + lokale Statistik.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Crown, RotateCcw, Timer } from 'lucide-react'
import {
  buildSoloRun,
  shuffleWithMapping,
  soloPointsFor,
  SOLO_SECONDS_PER_QUESTION,
  TOPICS_ALPHABETICAL,
  TOPICS_BY_ID,
  type MultipleChoiceQuestion,
  type Topic,
} from '@quizapp/shared'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { AnswerOption, type AnswerStatus } from '@/components/AnswerOption'
import { readSoloStats, saveSoloRun, type SoloStats } from '@/lib/soloStats'
import { primaryTitle } from '@/lib/titles'
import { ReportQuestionButton } from '@/components/ReportQuestionButton'
import { track } from '@/lib/insightsApi'
import { cn } from '@/lib/classnames'
import { haptic } from '@/lib/haptics'
import { useWakeLock } from '@/hooks/useWakeLock'

const SEEN_KEY = 'quizapp:soloSeen'
const LETTERS = ['A', 'B', 'C', 'D']

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function markSeen(ids: string[]): void {
  try {
    const seen = readSeen()
    ids.forEach((id) => seen.add(id))
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // Silent.
  }
}

interface Answer {
  question: MultipleChoiceQuestion
  pickedRendered: number | null
  correct: boolean
  points: number
}

type Phase = 'setup' | 'question' | 'feedback' | 'done'

export default function SoloPage() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [topics, setTopics] = useState<Topic[]>([])
  const [run, setRun] = useState<MultipleChoiceQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(SOLO_SECONDS_PER_QUESTION)
  const [stats, setStats] = useState<SoloStats>(() => readSoloStats())
  const [previousBest, setPreviousBest] = useState(0)

  const question = run[index] ?? null
  useWakeLock(phase === 'question' || phase === 'feedback')
  const shuffle = useMemo(
    () => (question ? shuffleWithMapping(question.options, `solo:${index}:${question.id}`) : null),
    [question, index],
  )
  const correctRendered = question && shuffle ? shuffle.renderedIndexOf(question.correctIndex) : -1
  const score = answers.reduce((s, a) => s + a.points, 0)

  const start = () => {
    let next = buildSoloRun(topics, readSeen())
    // Pool für die Auswahl erschöpft → Wiederholungen zulassen.
    if (next.length < 10) next = buildSoloRun(topics)
    setRun(next)
    setIndex(0)
    setAnswers([])
    setPreviousBest(readSoloStats().bestScore)
    setPhase('question')
    setStartedAt(Date.now())
  }

  const answer = (rendered: number | null) => {
    if (phase !== 'question' || !question) return
    const correct = rendered === correctRendered
    haptic(rendered === null ? 'timeUp' : correct ? 'correct' : 'wrong')
    setAnswers((prev) => [
      ...prev,
      {
        question,
        pickedRendered: rendered,
        correct,
        points: correct ? soloPointsFor(question.difficulty ?? 1) : 0,
      },
    ])
    setStartedAt(null)
    setPhase('feedback')
  }

  const next = () => {
    if (index + 1 >= run.length) {
      const final = answers.reduce((s, a) => s + a.points, 0)
      markSeen(run.map((q) => q.id))
      setStats(saveSoloRun(answers.map((a) => ({ topic: a.question.topic, correct: a.correct })), final))
      track('solo_finished')
      setPhase('done')
      return
    }
    setIndex(index + 1)
    setPhase('question')
    setStartedAt(Date.now())
  }

  // Countdown pro Frage.
  useEffect(() => {
    if (phase !== 'question' || startedAt === null) return
    const tick = () => {
      const left = Math.max(0, SOLO_SECONDS_PER_QUESTION - (Date.now() - startedAt) / 1000)
      setRemaining(left)
      if (left <= 0) answer(null)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, startedAt])

  return (
    <ScreenLayout variant="stage" hideNav>
      <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4 md:py-8">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="md" leading={<ArrowLeft className="h-4 w-4" />}>
              Start
            </Button>
          </Link>
          <div className="eyebrow">Solo-Runde</div>
        </div>

        {phase === 'setup' && (
          <SetupView
            topics={topics}
            onToggle={(t) =>
              setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
            }
            onClear={() => setTopics([])}
            onStart={start}
            stats={stats}
          />
        )}

        {(phase === 'question' || phase === 'feedback') && question && shuffle && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-white/80">
                Frage {index + 1}/{run.length} · {soloPointsFor(question.difficulty ?? 1)} Punkte
              </span>
              <span className="font-mono font-bold text-white">{score} P</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="Verbleibende Zeit"
              aria-valuemin={0}
              aria-valuemax={SOLO_SECONDS_PER_QUESTION}
              aria-valuenow={Math.ceil(remaining)}
            >
              <div
                className={cn('h-full transition-[width] duration-200', remaining <= 5 ? 'bg-wrong' : 'bg-brand-purple')}
                style={{ width: `${phase === 'question' ? (remaining / SOLO_SECONDS_PER_QUESTION) * 100 : 0}%` }}
              />
            </div>
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                <span>
                  {TOPICS_BY_ID[question.topic]?.emoji} {TOPICS_BY_ID[question.topic]?.label}
                </span>
                {phase === 'question' && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Timer className="h-3.5 w-3.5" /> {Math.ceil(remaining)}s
                  </span>
                )}
              </div>
              <h1 className="font-display text-xl font-bold leading-snug text-white md:text-2xl">
                {question.question}
              </h1>
            </Card>
            <div className="grid gap-2 md:grid-cols-2">
              {shuffle.shuffled.map((option, idx) => {
                const last = answers[answers.length - 1]
                let status: AnswerStatus = 'idle'
                if (phase === 'feedback') {
                  status =
                    idx === correctRendered ? 'correct' : idx === last?.pickedRendered ? 'wrong' : 'dimmed'
                }
                return (
                  <AnswerOption
                    key={`${question.id}-${idx}`}
                    letter={LETTERS[idx]}
                    status={status}
                    disabled={phase !== 'question'}
                    onClick={() => answer(idx)}
                  >
                    {option}
                  </AnswerOption>
                )
              })}
            </div>
            {phase === 'feedback' && (
              <Card className="space-y-2 p-4">
                <div className={cn('font-semibold', answers[answers.length - 1]?.correct ? 'text-correct' : 'text-wrong')}>
                  {answers[answers.length - 1]?.correct
                    ? `Richtig! +${answers[answers.length - 1].points}`
                    : answers[answers.length - 1]?.pickedRendered === null
                      ? 'Zeit abgelaufen'
                      : 'Leider falsch'}
                </div>
                {question.explanation && <p className="text-sm text-white/80">{question.explanation}</p>}
                <ReportQuestionButton questionId={question.id} source="solo" />
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  trailing={<ArrowRight className="h-4 w-4" />}
                  onClick={next}
                >
                  {index + 1 >= run.length ? 'Ergebnis' : 'Nächste Frage'}
                </Button>
              </Card>
            )}
          </div>
        )}

        {phase === 'done' && (
          <ResultView
            answers={answers}
            score={score}
            isNewBest={score > previousBest}
            stats={stats}
            onAgain={() => setPhase('setup')}
          />
        )}
      </div>
    </ScreenLayout>
  )
}

function SetupView({
  topics,
  onToggle,
  onClear,
  onStart,
  stats,
}: {
  topics: Topic[]
  onToggle: (t: Topic) => void
  onClear: () => void
  onStart: () => void
  stats: SoloStats
}) {
  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-white">Allein gegen die Uhr</h1>
        <p className="text-sm text-ink-muted">
          10 Fragen, von leicht bis Experte. 20 Sekunden pro Frage, schwerere Fragen bringen mehr Punkte
          (100–500).
        </p>
        {stats.runs > 0 && (
          <p className="text-xs text-ink-muted">
            Bestwert {stats.bestScore} · {stats.runs} Runden · Serie {stats.streakDays} Tag
            {stats.streakDays === 1 ? '' : 'e'}
          </p>
        )}
      </Card>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
            Themen {topics.length > 0 ? `(${topics.length})` : '· alle'}
          </div>
          {topics.length > 0 && (
            <button type="button" onClick={onClear} className="text-xs text-brand-cyan-soft">
              Alle Themen
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS_ALPHABETICAL.map((t) => {
            const on = topics.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(t.id)}
                className={cn(
                  'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm transition-colors',
                  on
                    ? 'border-brand-purple/80 bg-brand-purple/25 text-white'
                    : 'border-white/10 bg-white/[0.03] text-ink-muted hover:text-white',
                )}
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </button>
            )
          })}
        </div>
      </Card>
      <Button variant="primary" size="lg" className="w-full" onClick={onStart} trailing={<ArrowRight className="h-4 w-4" />}>
        Solo-Runde starten
      </Button>
    </div>
  )
}

function ResultView({
  answers,
  score,
  isNewBest,
  stats,
  onAgain,
}: {
  answers: Answer[]
  score: number
  isNewBest: boolean
  stats: SoloStats
  onAgain: () => void
}) {
  const correct = answers.filter((a) => a.correct).length
  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-6 text-center">
        {isNewBest && (
          <Crown aria-hidden className="mx-auto h-12 w-12 text-amber-300" fill="currentColor" />
        )}
        <div className="eyebrow">{isNewBest ? 'Neuer Bestwert' : 'Ergebnis'}</div>
        <div className="font-display text-5xl font-extrabold text-white">{score}</div>
        <div className="text-sm text-ink-muted">
          {correct} von {answers.length} richtig · Bestwert {stats.bestScore}
        </div>
        {primaryTitle(stats) && (
          <Link to="/profil" className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-3 py-1 text-sm font-semibold text-amber-200">
            <Crown className="h-3.5 w-3.5" fill="currentColor" aria-hidden /> {primaryTitle(stats)}
          </Link>
        )}
      </Card>
      <Card className="space-y-2 p-4">
        {answers.map((a, i) => (
          <div key={a.question.id} className="flex items-start gap-3 text-sm">
            <span className={cn('mt-0.5 font-mono', a.correct ? 'text-correct' : 'text-wrong')}>
              {a.correct ? '✓' : '✗'}
            </span>
            <span className="flex-1 text-white/85">
              {i + 1}. {a.question.question}
              <span className="block text-xs text-ink-muted">→ {a.question.options[a.question.correctIndex]}</span>
            </span>
            <span className="font-mono text-xs text-ink-muted">{a.points}</span>
          </div>
        ))}
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="primary" size="lg" leading={<RotateCcw className="h-4 w-4" />} onClick={onAgain}>
          Nochmal
        </Button>
        <Link to="/" className="block">
          <Button variant="secondary" size="lg" className="w-full">
            Zur Startseite
          </Button>
        </Link>
      </div>
    </div>
  )
}
