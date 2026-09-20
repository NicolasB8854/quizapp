/**
 * Spielansicht — Show-Bühne für den aktiven Modus (im Prototyp: Themen-Battle).
 *
 * Angelehnt an das PDF-Gameplay-Mockup:
 *  - Header schlank: Wortmarke links, Modus-Titel zentriert („JEOPARDY"-Look), Runden-Dots
 *    rechts. Keine dominante Navigation während der Runde.
 *  - Bühne zweigeteilt (nur ab md): Content links (Frage/Grid) + Score-Sidebar rechts.
 *  - Kategorie-Header als leuchtender Chip mit Emoji + Punktwert — analog zu „BASKETBALL 300".
 *  - Antworten in 2×2-Grid mit Neon-Kreis-Chips (siehe AnswerOption).
 *  - Score-Sidebar mit Krone am führenden Team.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, Crown } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { AnswerOption, type AnswerStatus } from '@/components/AnswerOption'
import { TopicTile } from '@/components/TopicTile'
import { useGame, useCategoryDuel } from '@/context/GameContext'
import { TOPICS, TOPICS_BY_ID } from '@/data/topics'
import { MODES_BY_ID } from '@/data/modes'
import type { Team } from '@/types/round'
import { cn } from '@/lib/classnames'

const LETTERS = ['A', 'B', 'C', 'D']

export default function GamePage() {
  const navigate = useNavigate()
  const { state, dispatch, currentTeam, currentModeId } = useGame()
  const live = useCategoryDuel()

  useEffect(() => {
    if (state.phase === 'setup')      navigate('/setup', { replace: true })
    if (state.phase === 'lobby')      navigate('/lobby', { replace: true })
    if (state.phase === 'scoreboard') navigate('/scoreboard', { replace: true })
  }, [state.phase, navigate])

  if (!state.round || !live || !currentTeam) return null

  const round = state.round
  const mode = currentModeId ? MODES_BY_ID[currentModeId] : null

  return (
    <ScreenLayout variant="stage" hideNav hideFooter contentClassName="px-0">
      {/* Kompakter Show-Header: Wortmarke · Modus-Titel · Runden-Dots */}
      <div className="relative z-10 px-6 md:px-10 pt-5 md:pt-6 grid grid-cols-3 items-center">
        <div className="flex items-center gap-2 text-ink font-display font-bold uppercase tracking-widest text-sm">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-brand-purple shadow-[0_0_12px_rgba(124,92,255,0.9)]"
          />
          Quizo
        </div>
        <div className="justify-self-center font-display font-bold uppercase tracking-[0.4em] text-brand-purple-soft text-neon-purple text-lg md:text-xl">
          {mode?.name.toUpperCase() ?? 'Runde'}
        </div>
        <div className="justify-self-end flex items-center gap-3">
          <RoundDots current={state.currentModeIndex} total={round.gameModes.length} />
          <Button
            variant="ghost"
            size="md"
            leading={<X className="h-4 w-4" />}
            onClick={() => {
              if (window.confirm('Runde wirklich abbrechen? Der Fortschritt geht verloren.')) {
                dispatch({ type: 'RESET_ALL' })
                navigate('/', { replace: true })
              }
            }}
          >
            <span className="hidden md:inline">Abbruch</span>
          </Button>
        </div>
      </div>

      {/* Bühne */}
      <div className="mx-auto max-w-7xl w-full px-6 md:px-10 mt-6 md:mt-10 pb-14">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8">
          {/* Content-Spalte */}
          <div>
            {live.phase === 'pick-topic' ? <TopicGrid /> : <QuestionStage />}
          </div>
          {/* Score-Sidebar */}
          <ScoreSidebar
            teams={round.teams}
            scores={live.scores}
            matchPoints={state.matchPoints}
            currentTeamId={currentTeam.id}
          />
        </div>
      </div>
    </ScreenLayout>
  )
}

// ---------- Sub-Screens -------------------------------------------------------

function TopicGrid() {
  const { dispatch, currentTeam } = useGame()
  const live = useCategoryDuel()
  if (!live || !currentTeam) return null

  const usedSet = new Set(live.usedTopics)
  return (
    <div className="animate-titleIn">
      <div className="text-center mb-6 md:mb-8">
        <div className="eyebrow">
          {currentTeam.name} wählt
        </div>
        <h1 className="mt-2 font-display font-bold uppercase text-3xl md:text-5xl tracking-tight">
          Kategorie wählen
        </h1>
        <p className="mt-2 text-ink-muted text-sm">
          {live.usedTopics.length} von 12 gespielt · {live.pointsPerQuestion} Punkte pro Feld
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {TOPICS.map((topic) => (
          <TopicTile
            key={topic.id}
            topic={topic}
            points={live.pointsPerQuestion}
            used={usedSet.has(topic.id)}
            onSelect={() => dispatch({ type: 'CD_PICK_TOPIC', topic: topic.id })}
          />
        ))}
      </div>
    </div>
  )
}

function QuestionStage() {
  const { dispatch, currentTeam } = useGame()
  const live = useCategoryDuel()
  if (!live || !live.activeQuestion || !live.activeTopic || !currentTeam) return null

  const topic = TOPICS_BY_ID[live.activeTopic]

  const answerStatus = (idx: number): AnswerStatus => {
    if (live.phase === 'answering') {
      return live.selectedRenderedIndex === idx ? 'selected' : 'idle'
    }
    if (idx === live.correctRenderedIndex) return 'correct'
    if (idx === live.selectedRenderedIndex) return 'wrong'
    return 'dimmed'
  }

  const wasCorrect =
    live.phase === 'revealed' && live.selectedRenderedIndex === live.correctRenderedIndex

  return (
    <div className="animate-titleIn">
      {/* Kategorie-Header — leuchtender Chip mit Emoji + Punktzahl */}
      <div className="flex justify-center">
        <div
          className="relative inline-flex flex-col items-center rounded-2xl px-6 md:px-10 py-4 md:py-5 border-2"
          style={{
            borderColor: 'rgba(124,92,255,0.6)',
            background: 'rgba(11,16,32,0.7)',
            boxShadow:
              '0 0 0 1px rgba(124,92,255,0.4), 0 0 28px rgba(124,92,255,0.5), 0 0 60px rgba(124,92,255,0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl" aria-hidden>
              {topic.emoji}
            </span>
            <span className="font-display font-bold uppercase tracking-[0.28em] text-white text-neon-purple text-lg md:text-2xl">
              {topic.label}
            </span>
          </div>
          <span className="mt-1 font-display font-extrabold text-4xl md:text-5xl tabular-nums leading-none text-neon-purple text-white">
            {live.pointsPerQuestion}
          </span>
        </div>
      </div>

      {/* Frage */}
      <div className="mt-8 md:mt-10">
        <div
          className="rounded-card border p-6 md:p-8 text-center"
          style={{
            borderColor: 'rgba(124,92,255,0.35)',
            background: 'rgba(11,16,32,0.55)',
            boxShadow:
              '0 0 0 1px rgba(124,92,255,0.25), 0 0 24px rgba(124,92,255,0.2)',
          }}
        >
          <div className="eyebrow">
            {currentTeam.name} · am Zug
          </div>
          <h2 className="mt-3 font-display font-bold text-white leading-tight text-2xl md:text-4xl">
            {live.activeQuestion.question}
          </h2>
        </div>
      </div>

      {/* Antworten */}
      <div className="mt-6 md:mt-8 grid md:grid-cols-2 gap-3 md:gap-4">
        {live.shuffledOptions.map((option, idx) => (
          <AnswerOption
            key={`${live.activeQuestion?.id}-${idx}`}
            letter={LETTERS[idx]}
            status={answerStatus(idx)}
            disabled={live.phase !== 'answering'}
            onClick={() => {
              if (live.phase === 'answering') {
                dispatch({ type: 'CD_SELECT_ANSWER', renderedIndex: idx })
              }
            }}
          >
            {option}
          </AnswerOption>
        ))}
      </div>

      {/* Reveal-Panel — zeigt Punkteänderung, Auflösung und optional Erklärung.
          `explanation` ist das v2-Feld für öffentliche Auflösungstexte,
          `gmNote` bleibt als Fallback für Bestandsdaten. */}
      {live.phase === 'revealed' && (() => {
        const explanationText =
          live.activeQuestion.explanation ?? live.activeQuestion.gmNote
        const correctAnswer = live.shuffledOptions[live.correctRenderedIndex]
        return (
          <div
            className={cn(
              'mt-6 rounded-card border p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
              wasCorrect
                ? 'bg-correct/10 border-correct/40'
                : 'bg-wrong/10 border-wrong/40',
            )}
          >
            <div className="min-w-0">
              <div
                className={cn(
                  'text-[11px] font-bold uppercase tracking-[0.22em]',
                  wasCorrect ? 'text-correct' : 'text-wrong',
                )}
              >
                {wasCorrect ? `+ ${live.pointsPerQuestion} Punkte` : 'Keine Punkte'}
              </div>
              <div className="mt-1 font-display font-bold text-xl md:text-2xl">
                {wasCorrect ? 'Richtig!' : 'Leider daneben.'}
              </div>
              {!wasCorrect && (
                <div className="mt-2 text-sm">
                  <span className="text-ink-muted">Richtig wäre: </span>
                  <span className="font-semibold text-correct">{correctAnswer}</span>
                </div>
              )}
              {explanationText && (
                <p className="mt-3 text-sm text-ink-muted leading-relaxed max-w-2xl">
                  <span className="font-semibold text-ink">Auflösung: </span>
                  {explanationText}
                </p>
              )}
            </div>
            <Button
              variant={wasCorrect ? 'cyan' : 'primary'}
              size="lg"
              trailing={<ArrowRight className="h-5 w-5" />}
              onClick={() => dispatch({ type: 'CD_NEXT_TURN' })}
            >
              Weiter
            </Button>
          </div>
        )
      })()}
    </div>
  )
}

// ---------- Sidebar & Header-Deko --------------------------------------------

interface SidebarProps {
  teams: Team[]
  scores: Record<string, number>
  matchPoints: Record<string, number>
  currentTeamId: string
}

function ScoreSidebar({ teams, scores, matchPoints, currentTeamId }: SidebarProps) {
  const [teamA, teamB] = teams
  const scoreA = scores[teamA.id] ?? 0
  const scoreB = scores[teamB.id] ?? 0
  const leaderId = scoreA === scoreB ? null : scoreA > scoreB ? teamA.id : teamB.id

  return (
    <aside className="space-y-3 md:space-y-4">
      <div className="eyebrow text-center">Punkte</div>
      {teams.map((team) => (
        <TeamSidebarCard
          key={team.id}
          team={team}
          score={scores[team.id] ?? 0}
          matchPoint={matchPoints[team.id] ?? 0}
          isLeader={leaderId === team.id}
          isCurrent={currentTeamId === team.id}
        />
      ))}
    </aside>
  )
}

interface TeamCardProps {
  team: Team
  score: number
  matchPoint: number
  isLeader: boolean
  isCurrent: boolean
}

function TeamSidebarCard({ team, score, matchPoint, isLeader, isCurrent }: TeamCardProps) {
  const hex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
  return (
    <div
      className="relative rounded-card border p-4 md:p-5"
      style={{
        borderColor: isCurrent ? `${hex}80` : 'rgba(255,255,255,0.08)',
        background: 'rgba(11,16,32,0.7)',
        boxShadow: isCurrent
          ? `0 0 0 1px ${hex}55, 0 0 28px -4px ${hex}80`
          : undefined,
      }}
    >
      {isLeader && (
        <Crown
          className="absolute -top-2.5 -right-2.5 h-6 w-6 text-mode-ladder drop-shadow-[0_0_8px_rgba(233,196,106,0.7)]"
          aria-label="Führt aktuell"
        />
      )}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center font-display font-bold text-sm border-2',
            team.color === 'purple'
              ? 'text-brand-purple-soft border-brand-purple/60 bg-brand-purple/15'
              : 'text-brand-cyan-soft border-brand-cyan/60 bg-brand-cyan/15',
          )}
        >
          {team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow" style={{ color: hex }}>
            Team {team.color === 'purple' ? 'Purple' : 'Cyan'}
          </div>
          <div className="truncate font-display font-bold text-ink text-sm md:text-base">
            {team.name}
          </div>
        </div>
      </div>
      <div
        className="mt-3 font-display font-extrabold tabular-nums text-4xl md:text-5xl leading-none"
        style={{ color: hex, textShadow: `0 0 20px ${hex}55` }}
      >
        {score.toLocaleString('de-DE')}
      </div>
      {matchPoint > 0 && (
        <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          {matchPoint} Match-Punkt{matchPoint === 1 ? '' : 'e'}
        </div>
      )}
      {isCurrent && (
        <div
          className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: hex }}
        >
          Am Zug
        </div>
      )}
    </div>
  )
}

function RoundDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-[0.22em] text-ink-muted">
        Runde <span className="text-ink font-bold">{current + 1}</span> von {total}
      </span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-2 w-2 rounded-full transition-all',
              i < current
                ? 'bg-brand-purple/80 shadow-[0_0_8px_rgba(124,92,255,0.9)]'
                : i === current
                ? 'bg-brand-purple shadow-[0_0_12px_rgba(124,92,255,1)]'
                : 'bg-white/15',
            )}
          />
        ))}
      </div>
    </div>
  )
}
