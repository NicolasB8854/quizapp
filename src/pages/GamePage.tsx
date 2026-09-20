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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, Crown, Check, XCircle, Lightbulb, Eye, Timer, SkipForward, TrendingUp } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { AnswerOption, type AnswerStatus } from '@/components/AnswerOption'
import { TopicTile } from '@/components/TopicTile'
import {
  useGame,
  useCategoryDuel,
  useFlash,
  useSpotlight,
  useAroundCorner,
  useSprinter,
  usePointsLadder,
  useCategoryBoard,
} from '@/context/GameContext'
import { TOPICS, TOPICS_BY_ID } from '@/data/topics'
import { MODES_BY_ID } from '@/data/modes'
import type { Team } from '@/types/round'
import type { TrueFalseQuestion } from '@/types/question'
import { cn } from '@/lib/classnames'

const LETTERS = ['A', 'B', 'C', 'D']

export default function GamePage() {
  const navigate = useNavigate()
  const { state, dispatch, currentModeId } = useGame()
  const cdLive = useCategoryDuel()
  const flashLive = useFlash()
  const spotlightLive = useSpotlight()
  const cornerLive = useAroundCorner()
  const sprinterLive = useSprinter()
  const ladderLive = usePointsLadder()
  const boardLive = useCategoryBoard()

  useEffect(() => {
    if (state.phase === 'setup')      navigate('/setup', { replace: true })
    if (state.phase === 'lobby')      navigate('/lobby', { replace: true })
    if (state.phase === 'scoreboard') navigate('/scoreboard', { replace: true })
  }, [state.phase, navigate])

  if (!state.round || !state.live) return null

  const round = state.round
  const live = state.live
  const mode = currentModeId ? MODES_BY_ID[currentModeId] : null

  // „Am Zug"-Markierung: Themen-Battle nutzt currentTeamIndex, Sprinter das
  // activeTeamId, Punktejagd wechselt je nach Phase (cellPicker / buzzer / opponent).
  const boardCurrentTeamId = boardLive
    ? boardLive.phase === 'pick-cell'
      ? boardLive.cellPickerTeamId
      : boardLive.phase === 'primary-answer'
      ? boardLive.buzzingTeamId
      : boardLive.phase === 'steal-answer'
      ? round.teams.find((t) => t.id !== boardLive.buzzingTeamId)?.id ?? null
      : null
    : null
  const currentTeamId = cdLive
    ? round.teams[cdLive.currentTeamIndex]?.id ?? null
    : sprinterLive?.activeTeamId ?? boardCurrentTeamId ?? null

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
          {/* Content-Spalte — je nach Live-Modus */}
          <div>
            {cdLive ? (
              cdLive.phase === 'pick-topic' ? <TopicGrid /> : <QuestionStage />
            ) : flashLive ? (
              <FlashStage />
            ) : spotlightLive ? (
              <SpotlightStage />
            ) : cornerLive ? (
              <AroundCornerStage />
            ) : sprinterLive ? (
              <SprinterStage />
            ) : ladderLive ? (
              <PointsLadderStage />
            ) : boardLive ? (
              <CategoryBoardStage />
            ) : null}
          </div>
          {/* Score-Sidebar */}
          <ScoreSidebar
            teams={round.teams}
            scores={live.scores}
            matchPoints={state.matchPoints}
            currentTeamId={currentTeamId}
          />
        </div>
      </div>
    </ScreenLayout>
  )
}

// ---------- Sub-Screens -------------------------------------------------------

function TopicGrid() {
  const { state, dispatch, currentTeam } = useGame()
  const live = useCategoryDuel()
  if (!live || !currentTeam) return null

  const usedSet = new Set(live.usedTopics)
  const interestSet = new Set(state.round?.interests ?? [])
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
            isInterest={interestSet.has(topic.id)}
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

// ---------- Blitzrunde -------------------------------------------------------

function FlashStage() {
  const { dispatch, state } = useGame()
  const flash = useFlash()
  if (!flash || !flash.activeQuestion || !state.round) return null

  const question = flash.activeQuestion
  const teams = state.round.teams
  const allAnswered = Object.values(flash.teamAnswers).every((a) => a !== null)
  const isRevealed = flash.phase === 'revealed'

  return (
    <div className="animate-titleIn">
      {/* Progress + Titel */}
      <div className="text-center mb-6 md:mb-8">
        <div className="eyebrow">
          Behauptung {flash.currentIndex + 1} von {flash.totalStatements}
        </div>
        <h1 className="mt-2 font-display font-bold uppercase text-3xl md:text-5xl tracking-tight">
          Wahr oder Falsch?
        </h1>
        <p className="mt-2 text-ink-muted text-sm">
          Beide Teams tippen unabhängig. Dann wird aufgedeckt.
        </p>
      </div>

      {/* Behauptung */}
      <div
        className="rounded-card border p-6 md:p-8 text-center"
        style={{
          borderColor: 'rgba(255,61,139,0.4)',
          background: 'rgba(11,16,32,0.6)',
          boxShadow:
            '0 0 0 1px rgba(255,61,139,0.25), 0 0 28px rgba(255,61,139,0.25)',
        }}
      >
        <h2 className="font-display font-bold text-white leading-tight text-2xl md:text-4xl">
          {question.question}
        </h2>
      </div>

      {/* Team-Auswahl */}
      <div className="mt-6 md:mt-8 grid md:grid-cols-2 gap-4">
        {teams.map((team) => (
          <TeamAnswerBox
            key={team.id}
            team={team}
            answer={flash.teamAnswers[team.id]}
            correctAnswer={question.correctAnswer}
            revealed={isRevealed}
            onPick={(a) =>
              dispatch({ type: 'FLASH_SET_ANSWER', teamId: team.id, answer: a })
            }
          />
        ))}
      </div>

      {/* Aktion: Aufdecken oder Weiter */}
      {!isRevealed ? (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-ink-muted">
            {allAnswered
              ? 'Beide Teams haben getippt. Bereit für die Auflösung.'
              : 'Warte auf beide Team-Antworten.'}
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={!allAnswered}
            onClick={() => dispatch({ type: 'FLASH_REVEAL' })}
          >
            Aufdecken
          </Button>
        </div>
      ) : (
        <FlashRevealPanel
          question={question}
          pointsPerCorrect={flash.pointsPerCorrect}
          onNext={() => dispatch({ type: 'FLASH_NEXT' })}
        />
      )}
    </div>
  )
}

interface TeamAnswerBoxProps {
  team: Team
  answer: boolean | null
  correctAnswer: boolean
  revealed: boolean
  onPick: (a: boolean) => void
}

function TeamAnswerBox({ team, answer, correctAnswer, revealed, onPick }: TeamAnswerBoxProps) {
  const teamHex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
  const wasCorrect = revealed && answer !== null && answer === correctAnswer

  return (
    <div
      className="rounded-card border p-5"
      style={{
        borderColor: revealed
          ? wasCorrect
            ? 'rgba(63,217,139,0.5)'
            : 'rgba(255,92,122,0.5)'
          : `${teamHex}55`,
        background: 'rgba(11,16,32,0.55)',
        boxShadow: revealed
          ? wasCorrect
            ? '0 0 24px rgba(63,217,139,0.35)'
            : '0 0 24px rgba(255,92,122,0.35)'
          : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <div className="eyebrow" style={{ color: teamHex }}>
            {team.name}
          </div>
          <div className="mt-0.5 font-display font-semibold text-sm text-ink-muted">
            {revealed
              ? wasCorrect
                ? 'Richtig'
                : answer === null
                ? 'Keine Antwort'
                : 'Daneben'
              : answer === null
              ? 'Bitte tippen'
              : 'Bereit'}
          </div>
        </div>
        {revealed &&
          (wasCorrect ? (
            <Check className="h-6 w-6 text-correct" aria-label="Richtig" />
          ) : (
            <XCircle className="h-6 w-6 text-wrong" aria-label="Daneben" />
          ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FlashChoice
          label="Wahr"
          isSelected={answer === true}
          isCorrect={correctAnswer === true}
          revealed={revealed}
          onClick={() => onPick(true)}
        />
        <FlashChoice
          label="Falsch"
          isSelected={answer === false}
          isCorrect={correctAnswer === false}
          revealed={revealed}
          onClick={() => onPick(false)}
        />
      </div>
    </div>
  )
}

interface FlashChoiceProps {
  label: string
  isSelected: boolean
  isCorrect: boolean
  revealed: boolean
  onClick: () => void
}

function FlashChoice({ label, isSelected, isCorrect, revealed, onClick }: FlashChoiceProps) {
  // Vor dem Reveal: gewählte Option leuchtet in Team-Akzent (via ring).
  // Nach dem Reveal: richtige Antwort grün, falsche gewählte rot, andere gedimmt.
  const disabled = revealed
  let stateClass = 'border-white/15 bg-navy-800/70 hover:border-white/30'
  if (!revealed && isSelected) {
    stateClass = 'border-brand-purple/70 bg-brand-purple/15 text-white'
  } else if (revealed && isCorrect) {
    stateClass = 'border-correct/60 bg-correct/15 text-correct'
  } else if (revealed && isSelected && !isCorrect) {
    stateClass = 'border-wrong/60 bg-wrong/15 text-wrong'
  } else if (revealed) {
    stateClass = 'border-white/10 bg-navy-800/40 text-ink-muted opacity-60'
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-14 rounded-card border font-display font-bold uppercase tracking-widest text-sm',
        'transition-colors disabled:cursor-not-allowed',
        stateClass,
      )}
    >
      {label}
    </button>
  )
}

interface FlashRevealPanelProps {
  question: TrueFalseQuestion
  pointsPerCorrect: number
  onNext: () => void
}

function FlashRevealPanel({ question, pointsPerCorrect, onNext }: FlashRevealPanelProps) {
  const correctLabel = question.correctAnswer ? 'Wahr' : 'Falsch'
  const explanation = question.explanation ?? question.gmNote
  return (
    <div className="mt-6 rounded-card border border-white/10 bg-navy-800/60 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-purple-soft">
          Auflösung
        </div>
        <div className="mt-1 font-display font-bold text-xl md:text-2xl">
          <span className="text-correct">{correctLabel}</span>
          <span className="text-ink-muted"> · {pointsPerCorrect} Punkte pro Treffer</span>
        </div>
        {explanation && (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
            {explanation}
          </p>
        )}
      </div>
      <Button
        variant="primary"
        size="lg"
        trailing={<ArrowRight className="h-5 w-5" />}
        onClick={onNext}
      >
        Weiter
      </Button>
    </div>
  )
}

// ---------- Heimspiel (Player Spotlight) -------------------------------------

function SpotlightStage() {
  const { state, dispatch } = useGame()
  const spot = useSpotlight()
  if (!spot || !state.round) return null

  // Empty-Fall: keine Spieler mit Interessen — Skip-Screen.
  if (spot.phase === 'empty') {
    return (
      <div className="animate-titleIn text-center py-10">
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          Heimspiel übersprungen
        </div>
        <h1 className="mt-3 font-display font-bold uppercase text-3xl md:text-5xl tracking-tight">
          Kein Interesse hinterlegt
        </h1>
        <p className="mt-3 text-ink-muted max-w-lg mx-auto">
          Für das „Heimspiel" braucht mindestens ein Spieler ein Interesse in der Lobby.
          Wir überspringen den Modus für diese Runde.
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            trailing={<ArrowRight className="h-5 w-5" />}
            onClick={() => dispatch({ type: 'SPOTLIGHT_NEXT' })}
          >
            Weiter
          </Button>
        </div>
      </div>
    )
  }

  if (!spot.activePlayerId || !spot.activeQuestion || !spot.activeTopic) return null

  const player = state.round.players.find((p) => p.id === spot.activePlayerId)
  if (!player) return null
  const team = state.round.teams.find((t) => t.id === player.teamId)!
  const opponent = state.round.teams.find((t) => t.id !== player.teamId)!
  const topic = TOPICS_BY_ID[spot.activeTopic]
  const teamHex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
  const opponentHex = opponent.color === 'purple' ? '#7C5CFF' : '#27D8FF'
  const displayName = player.name.trim() || `Spieler ${spot.currentIndex + 1}`
  const stealPoints = Math.floor(spot.pointsPerCorrect / 2)

  return (
    <div className="animate-titleIn">
      {/* Progress */}
      <div className="text-center mb-4 md:mb-6">
        <div className="eyebrow">
          Heimspiel · Spieler {spot.currentIndex + 1} von {spot.playerOrder.length}
        </div>
      </div>

      {/* Aktiver Spieler + Topic */}
      <div className="flex justify-center">
        <div
          className="relative inline-flex flex-col items-center rounded-2xl px-6 md:px-10 py-4 md:py-5 border-2"
          style={{
            borderColor: `${teamHex}99`,
            background: 'rgba(11,16,32,0.7)',
            boxShadow: `0 0 0 1px ${teamHex}55, 0 0 28px ${teamHex}55, 0 0 60px ${teamHex}30`,
          }}
        >
          <div className="eyebrow" style={{ color: teamHex }}>
            {team.name}
          </div>
          <div className="mt-1 font-display font-bold text-2xl md:text-4xl text-white text-neon-purple">
            {displayName}
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-sm">
            <span aria-hidden>{topic.emoji}</span>
            <span className="font-medium text-ink">{topic.label}</span>
          </div>
        </div>
      </div>

      {/* Frage */}
      <div className="mt-8 md:mt-10">
        <div
          className="rounded-card border p-6 md:p-8 text-center"
          style={{
            borderColor: 'rgba(255,184,77,0.35)',
            background: 'rgba(11,16,32,0.55)',
            boxShadow:
              '0 0 0 1px rgba(255,184,77,0.25), 0 0 24px rgba(255,184,77,0.2)',
          }}
        >
          <div className="eyebrow" style={{ color: '#FFB84D' }}>
            {spot.phase === 'primary'
              ? `${displayName} antwortet frei`
              : spot.phase === 'steal'
              ? `Steal für ${opponent.name}`
              : 'Auflösung'}
          </div>
          <h2 className="mt-3 font-display font-bold text-white leading-tight text-2xl md:text-4xl">
            {spot.activeQuestion.question}
          </h2>
        </div>
      </div>

      {/* Phasenabhängige Interaktion */}
      {spot.phase === 'primary' && (
        <div className="mt-6 md:mt-8">
          <p className="text-center text-sm text-ink-muted mb-4">
            Optionen bleiben verdeckt — Antwort mündlich. Master markiert:
          </p>
          <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-xl mx-auto">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'correct' })}
              className={cn(
                'h-14 rounded-card border font-display font-bold uppercase tracking-widest text-sm',
                'border-correct/60 bg-correct/15 text-correct',
                'hover:bg-correct/25 transition-colors',
              )}
            >
              Richtig
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SPOTLIGHT_MARK_PRIMARY', outcome: 'wrong' })}
              className={cn(
                'h-14 rounded-card border font-display font-bold uppercase tracking-widest text-sm',
                'border-wrong/60 bg-wrong/15 text-wrong',
                'hover:bg-wrong/25 transition-colors',
              )}
            >
              Falsch
            </button>
          </div>
        </div>
      )}

      {spot.phase === 'steal' && (
        <div className="mt-6 md:mt-8">
          <p className="text-center text-sm text-ink-muted mb-4">
            <span style={{ color: opponentHex }} className="font-semibold">
              {opponent.name}
            </span>{' '}
            wählt eine Option — {stealPoints} Punkte bei Treffer.
          </p>
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {spot.shuffledOptions.map((option, idx) => (
              <AnswerOption
                key={`steal-${idx}`}
                letter={LETTERS[idx]}
                status="idle"
                onClick={() =>
                  dispatch({ type: 'SPOTLIGHT_STEAL_ANSWER', renderedIndex: idx })
                }
              >
                {option}
              </AnswerOption>
            ))}
          </div>
        </div>
      )}

      {spot.phase === 'revealed' && (
        <SpotlightRevealPanel
          question={spot.activeQuestion}
          correctOption={spot.shuffledOptions[spot.correctRenderedIndex]}
          primaryOutcome={spot.primaryOutcome}
          stealOutcome={spot.stealOutcome}
          primaryPoints={spot.pointsPerCorrect}
          stealPoints={stealPoints}
          activeTeamName={team.name}
          opponentTeamName={opponent.name}
          onNext={() => dispatch({ type: 'SPOTLIGHT_NEXT' })}
        />
      )}
    </div>
  )
}

interface SpotlightRevealProps {
  question: import('@/types/question').MultipleChoiceQuestion
  correctOption: string
  primaryOutcome: 'correct' | 'wrong' | null
  stealOutcome: 'correct' | 'wrong' | null
  primaryPoints: number
  stealPoints: number
  activeTeamName: string
  opponentTeamName: string
  onNext: () => void
}

function SpotlightRevealPanel({
  question,
  correctOption,
  primaryOutcome,
  stealOutcome,
  primaryPoints,
  stealPoints,
  activeTeamName,
  opponentTeamName,
  onNext,
}: SpotlightRevealProps) {
  const explanationText = question.explanation ?? question.gmNote
  const primaryText =
    primaryOutcome === 'correct'
      ? `${activeTeamName}: + ${primaryPoints} Punkte`
      : primaryOutcome === 'wrong' && stealOutcome === 'correct'
      ? `${opponentTeamName} (Steal): + ${stealPoints} Punkte`
      : primaryOutcome === 'wrong' && stealOutcome === 'wrong'
      ? `Keine Punkte — auch der Steal ging daneben`
      : 'Keine Punkte'
  const tone =
    primaryOutcome === 'correct' || stealOutcome === 'correct' ? 'positive' : 'neutral'

  return (
    <div
      className={cn(
        'mt-6 rounded-card border p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
        tone === 'positive'
          ? 'bg-correct/10 border-correct/40'
          : 'bg-navy-800/60 border-white/10',
      )}
    >
      <div className="min-w-0">
        <div
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.22em]',
            tone === 'positive' ? 'text-correct' : 'text-ink-muted',
          )}
        >
          {primaryText}
        </div>
        <div className="mt-1 text-sm">
          <span className="text-ink-muted">Richtig wäre: </span>
          <span className="font-semibold text-correct">{correctOption}</span>
        </div>
        {explanationText && (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
            <span className="font-semibold text-ink">Auflösung: </span>
            {explanationText}
          </p>
        )}
      </div>
      <Button
        variant="primary"
        size="lg"
        trailing={<ArrowRight className="h-5 w-5" />}
        onClick={onNext}
      >
        Weiter
      </Button>
    </div>
  )
}

// ---------- Klick! (Warm-Up „Genial daneben") --------------------------------

function AroundCornerStage() {
  const { dispatch } = useGame()
  const corner = useAroundCorner()
  if (!corner) return null

  if (corner.phase === 'empty') {
    return (
      <div className="animate-titleIn text-center py-10">
        <div className="eyebrow">Klick! übersprungen</div>
        <h1 className="mt-3 font-display font-bold uppercase text-3xl md:text-5xl tracking-tight">
          Keine Rätsel im Katalog
        </h1>
        <p className="mt-3 text-ink-muted max-w-lg mx-auto">
          Für „Klick!" braucht es Warm-Up-Rätsel im Fragen-Katalog. Wir überspringen den
          Modus für diese Runde.
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            trailing={<ArrowRight className="h-5 w-5" />}
            onClick={() => dispatch({ type: 'AC_NEXT' })}
          >
            Weiter
          </Button>
        </div>
      </div>
    )
  }

  if (!corner.activeQuestion) return null
  const question = corner.activeQuestion
  const maxHints = question.hints.length
  const canRevealMoreHints = corner.revealedHints < maxHints
  const isRevealed = corner.phase === 'revealed'

  return (
    <div className="animate-titleIn">
      {/* Progress */}
      <div className="text-center mb-4 md:mb-6">
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          <Lightbulb className="h-3.5 w-3.5" style={{ color: '#F4A261' }} />
          Klick! · Rätsel {corner.currentIndex + 1} von {corner.totalRiddles}
        </div>
        <p className="mt-2 text-ink-muted text-sm">
          Alle beraten gemeinsam. Keine Punkte, nur der Aha-Moment.
        </p>
      </div>

      {/* Frage */}
      <div
        className="rounded-card border p-6 md:p-8 text-center"
        style={{
          borderColor: 'rgba(244,162,97,0.4)',
          background: 'rgba(11,16,32,0.6)',
          boxShadow:
            '0 0 0 1px rgba(244,162,97,0.25), 0 0 28px rgba(244,162,97,0.25)',
        }}
      >
        <h2 className="font-display font-bold text-white leading-tight text-2xl md:text-4xl">
          {question.question}
        </h2>
      </div>

      {/* Hinweise (nacheinander aufgedeckt) */}
      {corner.revealedHints > 0 && (
        <div className="mt-6 space-y-2">
          {question.hints.slice(0, corner.revealedHints).map((hint, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/[0.08] bg-navy-800/60 p-4 flex items-start gap-3 animate-titleIn"
            >
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase tracking-widest"
                style={{
                  color: '#F4A261',
                  border: '1px solid rgba(244,162,97,0.5)',
                  background: 'rgba(244,162,97,0.12)',
                }}
              >
                {idx + 1}
              </span>
              <p className="text-sm text-ink leading-relaxed">{hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* Aktion */}
      {!isRevealed && (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3">
          <button
            type="button"
            disabled={!canRevealMoreHints}
            onClick={() => dispatch({ type: 'AC_REVEAL_HINT' })}
            className={cn(
              'inline-flex items-center gap-2 h-12 rounded-full px-5',
              'font-display font-bold uppercase tracking-widest text-sm',
              canRevealMoreHints
                ? 'border-2 border-mode-corner/60 bg-mode-corner/15 text-mode-corner hover:bg-mode-corner/25'
                : 'border border-white/10 bg-navy-800/50 text-ink-faint cursor-not-allowed',
              'transition-colors',
            )}
          >
            <Lightbulb className="h-4 w-4" />
            {canRevealMoreHints ? `Hinweis ${corner.revealedHints + 1}/${maxHints}` : 'Alle Hinweise gezeigt'}
          </button>
          <Button
            variant="primary"
            size="lg"
            leading={<Eye className="h-5 w-5" />}
            onClick={() => dispatch({ type: 'AC_REVEAL_SOLUTION' })}
          >
            Auflösung
          </Button>
        </div>
      )}

      {/* Solution + Weiter */}
      {isRevealed && (
        <div
          className="mt-6 rounded-card border p-5 md:p-6"
          style={{
            borderColor: 'rgba(244,162,97,0.5)',
            background: 'rgba(11,16,32,0.7)',
            boxShadow: '0 0 24px -8px rgba(244,162,97,0.6)',
          }}
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-2" style={{ color: '#F4A261' }}>
            Auflösung
          </div>
          <p className="font-display font-semibold text-white text-lg md:text-xl leading-snug">
            {question.solution}
          </p>
          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              size="lg"
              trailing={<ArrowRight className="h-5 w-5" />}
              onClick={() => dispatch({ type: 'AC_NEXT' })}
            >
              {corner.currentIndex + 1 >= corner.totalRiddles ? 'Modus beenden' : 'Nächstes Rätsel'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Sprinter ---------------------------------------------------------

function SprinterStage() {
  const { state, dispatch } = useGame()
  const sprinter = useSprinter()
  const [remainingSec, setRemainingSec] = useState<number>(0)

  // Timer läuft im UI. Reducer bleibt pure — er bekommt nur SPRINTER_TIME_UP.
  useEffect(() => {
    if (!sprinter || sprinter.phase !== 'answering' || sprinter.sprintStartedAt == null) {
      return
    }
    const startedAt = sprinter.sprintStartedAt
    const durationMs = sprinter.sprintDurationSeconds * 1000

    const compute = () => Math.max(0, Math.ceil((durationMs - (Date.now() - startedAt)) / 1000))
    setRemainingSec(compute())
    const interval = setInterval(() => {
      const remaining = compute()
      setRemainingSec(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        dispatch({ type: 'SPRINTER_TIME_UP' })
      }
    }, 200)
    return () => clearInterval(interval)
  }, [sprinter?.phase, sprinter?.sprintStartedAt, sprinter?.sprintDurationSeconds, dispatch, sprinter])

  if (!sprinter || !state.round) return null

  // Between-Teams-Screen: Zwischenscore + Übergang.
  if (sprinter.phase === 'between-teams') {
    const finishedTeam = state.round.teams.find(
      (t) => t.id === sprinter.teamOrder[sprinter.currentTeamIndex],
    )
    const isFirstDone = sprinter.currentTeamIndex === 0
    const nextTeam = isFirstDone
      ? state.round.teams.find((t) => t.id === sprinter.teamOrder[1])
      : null
    return (
      <div className="animate-titleIn text-center py-6">
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          <Timer className="h-3.5 w-3.5" style={{ color: '#FF6E5C' }} />
          {isFirstDone ? 'Team 1 fertig' : 'Sprint komplett'}
        </div>
        {finishedTeam && (
          <div className="mt-3">
            <div className="text-sm text-ink-muted">{finishedTeam.name}</div>
            <div
              className="mt-1 font-display font-extrabold tabular-nums text-5xl md:text-7xl leading-none"
              style={{ color: '#FF6E5C', textShadow: '0 0 24px rgba(255,110,92,0.65)' }}
            >
              {sprinter.scores[finishedTeam.id] ?? 0}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.22em] text-ink-muted">Punkte</div>
          </div>
        )}
        {isFirstDone && nextTeam ? (
          <>
            <p className="mt-6 text-ink-muted max-w-md mx-auto">
              Jetzt ist{' '}
              <span className="font-semibold text-ink">{nextTeam.name}</span> dran —
              wieder 90 Sekunden für so viele richtige Antworten wie möglich.
            </p>
            <div className="mt-6 flex justify-center">
              <Button
                variant="primary"
                size="lg"
                trailing={<ArrowRight className="h-5 w-5" />}
                onClick={() => dispatch({ type: 'SPRINTER_START_NEXT_TEAM' })}
              >
                Sprint starten
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-6 text-ink-muted">Beide Sprints durch — weiter zum Ergebnis.</p>
        )}
      </div>
    )
  }

  // Answering-Phase.
  if (!sprinter.activeQuestion || !sprinter.activeTeamId) return null
  const team = state.round.teams.find((t) => t.id === sprinter.activeTeamId)
  if (!team) return null
  const teamHex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
  const timerCritical = remainingSec <= 10
  const timerHex = timerCritical ? '#FF5C7A' : '#FF6E5C'

  return (
    <div className="animate-titleIn">
      {/* Kopfzeile: Team + Timer + aktueller Score */}
      <div className="flex items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <div className="eyebrow" style={{ color: teamHex }}>
            Sprint · {team.name}
          </div>
          <div className="mt-1 font-display font-bold text-lg md:text-xl">
            {sprinter.scores[team.id] ?? 0} <span className="text-ink-muted text-sm font-normal">Punkte</span>
          </div>
        </div>
        <div
          className="inline-flex items-center gap-3 rounded-full px-5 py-2.5 border-2 tabular-nums"
          style={{
            borderColor: `${timerHex}99`,
            background: 'rgba(11,16,32,0.7)',
            boxShadow: `0 0 24px -8px ${timerHex}CC`,
          }}
        >
          <Timer className="h-5 w-5" style={{ color: timerHex }} />
          <span
            className="font-display font-extrabold text-2xl md:text-3xl"
            style={{ color: timerHex, textShadow: `0 0 18px ${timerHex}55` }}
          >
            {String(remainingSec).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Frage */}
      <div
        className="rounded-card border p-6 md:p-8 text-center"
        style={{
          borderColor: 'rgba(255,110,92,0.35)',
          background: 'rgba(11,16,32,0.6)',
          boxShadow: '0 0 0 1px rgba(255,110,92,0.25), 0 0 24px rgba(255,110,92,0.2)',
        }}
      >
        <h2 className="font-display font-bold text-white leading-tight text-2xl md:text-4xl">
          {sprinter.activeQuestion.question}
        </h2>
      </div>

      {/* Antworten */}
      <div className="mt-6 md:mt-8 grid md:grid-cols-2 gap-3 md:gap-4">
        {sprinter.shuffledOptions.map((option, idx) => (
          <AnswerOption
            key={`sprint-${sprinter.usedQuestionIds.length}-${idx}`}
            letter={LETTERS[idx]}
            status="idle"
            onClick={() =>
              dispatch({ type: 'SPRINTER_ANSWER', renderedIndex: idx })
            }
          >
            {option}
          </AnswerOption>
        ))}
      </div>

      {/* Skip */}
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SPRINTER_SKIP' })}
          className={cn(
            'inline-flex items-center gap-2 h-11 rounded-full px-5',
            'text-sm font-semibold uppercase tracking-[0.22em]',
            'border border-white/15 bg-navy-800/60 text-ink-muted',
            'hover:border-white/30 hover:text-ink transition-colors',
          )}
        >
          <SkipForward className="h-4 w-4" />
          Weiter (kein Punkt)
        </button>
      </div>
    </div>
  )
}

// ---------- Alles oder Nichts (Punkte-Leiter) --------------------------------

function PointsLadderStage() {
  const { state, dispatch } = useGame()
  const ladder = usePointsLadder()
  if (!ladder || !state.round) return null

  if (ladder.phase === 'empty') {
    return (
      <div className="animate-titleIn text-center py-10">
        <div className="eyebrow">Alles oder Nichts übersprungen</div>
        <h1 className="mt-3 font-display font-bold uppercase text-3xl md:text-5xl tracking-tight">
          Keine Fragen im Katalog
        </h1>
        <p className="mt-3 text-ink-muted max-w-lg mx-auto">
          Für die Punkte-Leiter braucht es Multiple-Choice-Fragen. Wir überspringen den
          Modus für diese Runde.
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            trailing={<ArrowRight className="h-5 w-5" />}
            onClick={() => dispatch({ type: 'LADDER_NEXT' })}
          >
            Weiter
          </Button>
        </div>
      </div>
    )
  }

  if (!ladder.activeQuestion) return null
  const currentValue = ladder.ladder[ladder.currentIndex] ?? 0
  const allAnswered = Object.values(ladder.teamAnswers).every((a) => a !== null)
  const isRevealed = ladder.phase === 'revealed'
  const teams = state.round.teams

  return (
    <div className="animate-titleIn">
      {/* Header mit Progress + Ladder-Stufen */}
      <div className="text-center mb-4 md:mb-6">
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          <TrendingUp className="h-3.5 w-3.5" style={{ color: '#E9C46A' }} />
          Alles oder Nichts · Stufe {ladder.currentIndex + 1} von {ladder.totalQuestions}
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5">
          {ladder.ladder.map((val, idx) => {
            const isCurrent = idx === ladder.currentIndex
            const isPast = idx < ladder.currentIndex
            return (
              <span
                key={idx}
                className={cn(
                  'rounded-full font-display font-bold tabular-nums transition-all',
                  isCurrent
                    ? 'text-mode-ladder text-lg md:text-xl px-3 py-1'
                    : 'text-xs md:text-sm px-2 py-0.5',
                  isCurrent
                    ? 'border-2 border-mode-ladder/60 bg-mode-ladder/15 shadow-[0_0_20px_-4px_rgba(233,196,106,0.7)]'
                    : isPast
                    ? 'text-ink-faint bg-navy-800/60 border border-white/[0.06]'
                    : 'text-ink-muted bg-navy-800/50 border border-white/[0.08]',
                )}
              >
                {val.toLocaleString('de-DE')}
              </span>
            )
          })}
        </div>
      </div>

      {/* Frage */}
      <div
        className="rounded-card border p-6 md:p-8 text-center"
        style={{
          borderColor: 'rgba(233,196,106,0.4)',
          background: 'rgba(11,16,32,0.6)',
          boxShadow:
            '0 0 0 1px rgba(233,196,106,0.25), 0 0 28px rgba(233,196,106,0.25)',
        }}
      >
        <div className="eyebrow" style={{ color: '#E9C46A' }}>
          {currentValue.toLocaleString('de-DE')} Punkte pro Team
        </div>
        <h2 className="mt-2 font-display font-bold text-white leading-tight text-2xl md:text-4xl">
          {ladder.activeQuestion.question}
        </h2>
      </div>

      {/* Zwei Team-Panels */}
      <div className="mt-6 md:mt-8 grid md:grid-cols-2 gap-4">
        {teams.map((team) => (
          <LadderTeamPanel
            key={team.id}
            team={team}
            options={ladder.shuffledOptions}
            selected={ladder.teamAnswers[team.id]}
            correctIndex={ladder.correctRenderedIndex}
            revealed={isRevealed}
            onPick={(idx) =>
              dispatch({
                type: 'LADDER_SET_ANSWER',
                teamId: team.id,
                renderedIndex: idx,
              })
            }
          />
        ))}
      </div>

      {/* Aktion */}
      {!isRevealed ? (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-ink-muted">
            {allAnswered
              ? 'Beide Teams haben getippt. Bereit für die Auflösung.'
              : 'Warte auf beide Team-Antworten.'}
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={!allAnswered}
            onClick={() => dispatch({ type: 'LADDER_REVEAL' })}
          >
            Aufdecken
          </Button>
        </div>
      ) : (
        <LadderRevealPanel
          question={ladder.activeQuestion}
          correctOption={ladder.shuffledOptions[ladder.correctRenderedIndex]}
          teams={teams}
          teamAnswers={ladder.teamAnswers}
          correctIndex={ladder.correctRenderedIndex}
          value={currentValue}
          isLast={ladder.currentIndex + 1 >= ladder.totalQuestions}
          onNext={() => dispatch({ type: 'LADDER_NEXT' })}
        />
      )}
    </div>
  )
}

interface LadderTeamPanelProps {
  team: Team
  options: string[]
  selected: number | null
  correctIndex: number
  revealed: boolean
  onPick: (renderedIndex: number) => void
}

function LadderTeamPanel({
  team,
  options,
  selected,
  correctIndex,
  revealed,
  onPick,
}: LadderTeamPanelProps) {
  const teamHex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
  return (
    <div
      className="rounded-card border p-4 md:p-5"
      style={{ borderColor: `${teamHex}55`, background: 'rgba(11,16,32,0.55)' }}
    >
      <div className="eyebrow mb-2" style={{ color: teamHex }}>
        {team.name}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {options.map((option, idx) => {
          const isSelected = selected === idx
          const isCorrect = idx === correctIndex
          let cls = 'border-white/10 bg-navy-800/70 hover:border-white/25'
          if (!revealed && isSelected) {
            cls = 'border-brand-purple/70 bg-brand-purple/15 text-white'
          } else if (revealed && isCorrect) {
            cls = 'border-correct/60 bg-correct/15 text-correct'
          } else if (revealed && isSelected && !isCorrect) {
            cls = 'border-wrong/60 bg-wrong/15 text-wrong'
          } else if (revealed) {
            cls = 'border-white/10 bg-navy-800/40 text-ink-muted opacity-60'
          }
          return (
            <button
              key={idx}
              type="button"
              disabled={revealed}
              onClick={() => onPick(idx)}
              className={cn(
                'group flex items-center gap-3 h-11 rounded-lg border px-3',
                'text-left text-sm font-medium transition-colors',
                'disabled:cursor-not-allowed',
                cls,
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  'text-[10px] font-bold uppercase tracking-widest border',
                  !revealed && isSelected
                    ? 'border-brand-purple/70 bg-brand-purple/25 text-white'
                    : 'border-white/15 text-ink-muted',
                )}
              >
                {LETTERS[idx]}
              </span>
              <span className="min-w-0 flex-1 truncate">{option}</span>
              {revealed && isSelected && (isCorrect ? (
                <Check className="h-4 w-4 text-correct" />
              ) : (
                <XCircle className="h-4 w-4 text-wrong" />
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface LadderRevealProps {
  question: import('@/types/question').MultipleChoiceQuestion
  correctOption: string
  teams: Team[]
  teamAnswers: Record<string, number | null>
  correctIndex: number
  value: number
  isLast: boolean
  onNext: () => void
}

function LadderRevealPanel({
  question,
  correctOption,
  teams,
  teamAnswers,
  correctIndex,
  value,
  isLast,
  onNext,
}: LadderRevealProps) {
  const explanationText = question.explanation ?? question.gmNote
  return (
    <div
      className="mt-6 rounded-card border p-5 md:p-6"
      style={{
        borderColor: 'rgba(233,196,106,0.5)',
        background: 'rgba(11,16,32,0.7)',
        boxShadow: '0 0 24px -8px rgba(233,196,106,0.6)',
      }}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-2" style={{ color: '#E9C46A' }}>
        Auflösung
      </div>
      <div className="text-sm mb-3">
        <span className="text-ink-muted">Richtig war: </span>
        <span className="font-semibold text-correct">{correctOption}</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {teams.map((team) => {
          const answer = teamAnswers[team.id]
          const wasCorrect = answer === correctIndex
          const teamHex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
          return (
            <div
              key={team.id}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs',
                wasCorrect
                  ? 'bg-correct/15 border border-correct/40 text-correct'
                  : 'bg-navy-800/60 border border-white/10 text-ink-muted',
              )}
            >
              <span style={{ color: teamHex }} className="font-semibold">
                {team.name}
              </span>
              <span>
                {wasCorrect ? `+ ${value.toLocaleString('de-DE')}` : 'keine Punkte'}
              </span>
            </div>
          )
        })}
      </div>
      {explanationText && (
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          <span className="font-semibold text-ink">Erklärung: </span>
          {explanationText}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          trailing={<ArrowRight className="h-5 w-5" />}
          onClick={onNext}
        >
          {isLast ? 'Modus beenden' : 'Nächste Stufe'}
        </Button>
      </div>
    </div>
  )
}

// ---------- Punktejagd (Kategorienbrett) -------------------------------------

function CategoryBoardStage() {
  const { state, dispatch } = useGame()
  const board = useCategoryBoard()
  if (!board || !state.round) return null

  const teams = state.round.teams
  const playedSet = new Set(board.playedCells.map((c) => `${c.topic}:${c.valueIndex}`))
  const totalCells = board.boardTopics.length * board.cellValues.length

  // pick-cell: das Board.
  if (board.phase === 'pick-cell') {
    const picker = teams.find((t) => t.id === board.cellPickerTeamId)
    const pickerHex = picker?.color === 'purple' ? '#7C5CFF' : picker ? '#27D8FF' : '#F0B23A'
    return (
      <div className="animate-titleIn">
        <div className="text-center mb-6 md:mb-8">
          <div className="eyebrow" style={{ color: '#F0B23A' }}>
            Punktejagd · {board.playedCells.length}/{totalCells} Felder
          </div>
          <h1 className="mt-2 font-display font-bold uppercase text-3xl md:text-5xl tracking-tight">
            {picker ? `${picker.name} wählt` : 'Ein Feld wählen'}
          </h1>
          {picker && (
            <p className="mt-2 text-sm text-ink-muted">
              Klick auf ein offenes Feld —{' '}
              <span style={{ color: pickerHex }} className="font-semibold">
                {picker.name}
              </span>{' '}
              spielt auf diese Frage. Wer zuerst summt, antwortet.
            </p>
          )}
        </div>

        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {/* Kolonnen-Header */}
          {board.boardTopics.map((topic) => {
            const t = TOPICS_BY_ID[topic]
            return (
              <div
                key={`h-${topic}`}
                className="rounded-lg border border-mode-board/30 bg-mode-board/10 p-2 md:p-3 text-center"
              >
                <div className="text-lg md:text-2xl" aria-hidden>{t.emoji}</div>
                <div className="mt-0.5 text-[10px] md:text-xs font-display font-semibold uppercase tracking-wider text-mode-board leading-tight">
                  {t.label}
                </div>
              </div>
            )
          })}
          {/* Zellen */}
          {board.cellValues.map((val, rowIdx) =>
            board.boardTopics.map((topic) => {
              const key = `${topic}:${rowIdx}`
              const isPlayed = playedSet.has(key)
              return (
                <button
                  key={`c-${key}`}
                  type="button"
                  disabled={isPlayed}
                  onClick={() =>
                    dispatch({
                      type: 'BOARD_PICK_CELL',
                      topic,
                      valueIndex: rowIdx,
                    })
                  }
                  className={cn(
                    'aspect-[4/3] rounded-lg border flex items-center justify-center',
                    'font-display font-extrabold tabular-nums',
                    'text-2xl md:text-4xl transition-all',
                    isPlayed
                      ? 'border-white/[0.06] bg-navy-800/30 text-ink-faint cursor-not-allowed'
                      : 'border-mode-board/40 bg-mode-board/10 text-mode-board hover:bg-mode-board/25 hover:border-mode-board/70 hover:-translate-y-0.5 shadow-[0_0_18px_-6px_rgba(240,178,58,0.5)]',
                  )}
                >
                  {isPlayed ? '—' : val}
                </button>
              )
            }),
          )}
        </div>
      </div>
    )
  }

  // Frage-Phasen.
  if (!board.activeCell || !board.activeQuestion) return null
  const topic = TOPICS_BY_ID[board.activeCell.topic]
  const value = board.cellValues[board.activeCell.valueIndex] ?? 0
  const buzzingTeam = teams.find((t) => t.id === board.buzzingTeamId)
  const opponent = buzzingTeam
    ? teams.find((t) => t.id !== buzzingTeam.id)
    : null
  const activeTeam =
    board.phase === 'steal-answer' ? opponent : buzzingTeam
  const activeTeamHex =
    activeTeam?.color === 'purple' ? '#7C5CFF' : activeTeam ? '#27D8FF' : '#F0B23A'

  return (
    <div className="animate-titleIn">
      {/* Header: Topic + Wert */}
      <div className="flex justify-center">
        <div
          className="relative inline-flex items-center gap-3 rounded-2xl px-6 py-3 border-2"
          style={{
            borderColor: 'rgba(240,178,58,0.6)',
            background: 'rgba(11,16,32,0.7)',
            boxShadow: '0 0 0 1px rgba(240,178,58,0.4), 0 0 24px rgba(240,178,58,0.4)',
          }}
        >
          <span className="text-3xl md:text-4xl" aria-hidden>{topic.emoji}</span>
          <span className="font-display font-bold uppercase tracking-[0.24em] text-white text-lg md:text-2xl">
            {topic.label}
          </span>
          <span className="font-display font-extrabold text-mode-board tabular-nums text-3xl md:text-4xl">
            {value}
          </span>
        </div>
      </div>

      {/* Frage */}
      <div
        className="mt-8 md:mt-10 rounded-card border p-6 md:p-8 text-center"
        style={{
          borderColor: 'rgba(240,178,58,0.35)',
          background: 'rgba(11,16,32,0.55)',
          boxShadow:
            '0 0 0 1px rgba(240,178,58,0.25), 0 0 24px rgba(240,178,58,0.2)',
        }}
      >
        <h2 className="font-display font-bold text-white leading-tight text-2xl md:text-4xl">
          {board.activeQuestion.question}
        </h2>
      </div>

      {/* Phasen-Interaktion */}
      {board.phase === 'awaiting-buzz' && (
        <div className="mt-6 md:mt-8">
          <p className="text-center text-sm text-ink-muted mb-4">
            Wer hat zuerst gesummt? Master markiert:
          </p>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {teams.map((team) => {
              const hex = team.color === 'purple' ? '#7C5CFF' : '#27D8FF'
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => dispatch({ type: 'BOARD_BUZZER', teamId: team.id })}
                  className={cn(
                    'h-14 rounded-card border-2 font-display font-bold uppercase tracking-widest text-sm',
                    'transition-all hover:brightness-110',
                  )}
                  style={{
                    borderColor: `${hex}80`,
                    background: `${hex}22`,
                    color: hex,
                  }}
                >
                  {team.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {(board.phase === 'primary-answer' || board.phase === 'steal-answer') && (
        <div className="mt-6 md:mt-8">
          <p className="text-center text-sm text-ink-muted mb-4">
            {board.phase === 'primary-answer'
              ? 'Auswahl für '
              : 'Steal für '}
            <span style={{ color: activeTeamHex }} className="font-semibold">
              {activeTeam?.name ?? '—'}
            </span>
          </p>
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {board.shuffledOptions.map((option, idx) => (
              <AnswerOption
                key={`board-${board.activeCell?.topic}-${idx}`}
                letter={LETTERS[idx]}
                status="idle"
                onClick={() =>
                  dispatch({ type: 'BOARD_ANSWER', renderedIndex: idx })
                }
              >
                {option}
              </AnswerOption>
            ))}
          </div>
        </div>
      )}

      {board.phase === 'revealed' && buzzingTeam && (
        <BoardRevealPanel
          question={board.activeQuestion}
          correctOption={board.shuffledOptions[board.correctRenderedIndex]}
          primaryOutcome={board.primaryOutcome}
          stealOutcome={board.stealOutcome}
          value={value}
          buzzingTeamName={buzzingTeam.name}
          opponentTeamName={opponent?.name ?? '—'}
          isBoardDone={board.playedCells.length + 1 >= totalCells}
          onNext={() => dispatch({ type: 'BOARD_NEXT' })}
        />
      )}
    </div>
  )
}

interface BoardRevealProps {
  question: import('@/types/question').MultipleChoiceQuestion
  correctOption: string
  primaryOutcome: 'correct' | 'wrong' | null
  stealOutcome: 'correct' | 'wrong' | null
  value: number
  buzzingTeamName: string
  opponentTeamName: string
  isBoardDone: boolean
  onNext: () => void
}

function BoardRevealPanel({
  question,
  correctOption,
  primaryOutcome,
  stealOutcome,
  value,
  buzzingTeamName,
  opponentTeamName,
  isBoardDone,
  onNext,
}: BoardRevealProps) {
  const explanationText = question.explanation ?? question.gmNote
  const label =
    primaryOutcome === 'correct'
      ? `${buzzingTeamName}: + ${value} Punkte`
      : stealOutcome === 'correct'
      ? `${opponentTeamName} (Steal): + ${value} Punkte`
      : 'Keine Punkte'
  const tone = primaryOutcome === 'correct' || stealOutcome === 'correct'
    ? 'positive'
    : 'neutral'
  return (
    <div
      className={cn(
        'mt-6 rounded-card border p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
        tone === 'positive'
          ? 'bg-correct/10 border-correct/40'
          : 'bg-navy-800/60 border-white/10',
      )}
    >
      <div className="min-w-0">
        <div
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.22em]',
            tone === 'positive' ? 'text-correct' : 'text-ink-muted',
          )}
        >
          {label}
        </div>
        <div className="mt-1 text-sm">
          <span className="text-ink-muted">Richtig war: </span>
          <span className="font-semibold text-correct">{correctOption}</span>
        </div>
        {explanationText && (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
            <span className="font-semibold text-ink">Auflösung: </span>
            {explanationText}
          </p>
        )}
      </div>
      <Button
        variant="primary"
        size="lg"
        trailing={<ArrowRight className="h-5 w-5" />}
        onClick={onNext}
      >
        {isBoardDone ? 'Modus beenden' : 'Zurück zum Board'}
      </Button>
    </div>
  )
}

// ---------- Sidebar & Header-Deko --------------------------------------------

interface SidebarProps {
  teams: Team[]
  scores: Record<string, number>
  matchPoints: Record<string, number>
  /** `null` z. B. in der Blitzrunde, wo beide Teams parallel spielen. */
  currentTeamId: string | null
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
