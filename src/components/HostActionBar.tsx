/**
 * Sticky Host-Steuerleiste oben im Content während `phase='playing'`.
 *
 * Der Host, der auf seinem Handy mitspielt, muss oft zwischen „Antwort geben"
 * und „Weiter / Auflösen" wechseln. Damit er nicht jedes Mal zum Ende des
 * Modus-Panels scrollen muss, blenden wir die aktuell wichtigste Show-
 * Runner-Aktion kontextabhängig oben in eine schmale Bar ein.
 *
 * Zeigen nur eine Aktion (die vom Modus + Phase logisch die „next big move" ist);
 * modus-spezifische Sonderaktionen (Fach wählen, Zell-Pick, Vertreter etc.)
 * bleiben in den Modus-Views.
 */

import type { GameAction, GameState } from '@quizapp/shared'
import { Button } from '@/components/Button'
import { cn } from '@/lib/classnames'

interface Props {
  state: GameState
  canDispatch: boolean
  send: (action: GameAction) => void
}

interface HostAction {
  label: string
  action: GameAction
  tone: 'primary' | 'secondary'
}

/**
 * Bestimmt die aktuell wichtigste Meta-Aktion für den Host anhand des Live-
 * States. Gibt `null` zurück, wenn gerade auf Player-Input gewartet wird
 * und der Host nichts zu tun hat.
 */
function resolveHostAction(state: GameState): HostAction | null {
  const live = state.live
  if (!live) return null

  switch (live.kind) {
    case 'flash': {
      const allAnswered = Object.values(live.teamAnswers).every((v) => v !== null && v !== undefined)
      if (live.phase === 'answering') {
        return {
          label: allAnswered ? '✓ Auflösen' : 'Auflösen (jederzeit)',
          action: { type: 'FLASH_REVEAL' },
          tone: allAnswered ? 'primary' : 'secondary',
        }
      }
      if (live.phase === 'revealed') {
        return { label: 'Nächste Frage', action: { type: 'FLASH_NEXT' }, tone: 'primary' }
      }
      return null
    }

    case 'category-duel': {
      if (live.phase === 'revealed') {
        return { label: 'Nächste Runde', action: { type: 'CD_NEXT_TURN' }, tone: 'primary' }
      }
      return null
    }

    case 'points-ladder': {
      const allAnswered = state.round
        ? state.round.teams.every(
            (t) => live.teamAnswers[t.id] !== null && live.teamAnswers[t.id] !== undefined,
          )
        : false
      if (live.phase === 'answering') {
        return {
          label: allAnswered ? '✓ Auflösen' : 'Auflösen (jederzeit)',
          action: { type: 'LADDER_REVEAL' },
          tone: allAnswered ? 'primary' : 'secondary',
        }
      }
      if (live.phase === 'revealed') {
        const done = live.currentIndex + 1 >= live.totalQuestions
        return {
          label: done ? 'Runde beenden' : 'Nächste Stufe',
          action: { type: 'LADDER_NEXT' },
          tone: 'primary',
        }
      }
      return null
    }

    case 'sprinter': {
      if (live.phase === 'between-teams') {
        return {
          label: 'Nächstes Team starten',
          action: { type: 'SPRINTER_START_NEXT_TEAM' },
          tone: 'primary',
        }
      }
      return null
    }

    case 'elimination': {
      if (live.phase === 'revealed') {
        return { label: 'Nächster Spieler', action: { type: 'ELIM_NEXT' }, tone: 'primary' }
      }
      return null
    }

    case 'category-board': {
      if (live.phase === 'revealed') {
        return { label: 'Nächste Zelle', action: { type: 'BOARD_NEXT' }, tone: 'primary' }
      }
      return null
    }

    case 'duel-1v1': {
      if (live.phase === 'revealed') {
        return { label: 'Nächstes Duell', action: { type: 'DUEL_NEXT' }, tone: 'primary' }
      }
      return null
    }

    case 'experts': {
      if (live.phase === 'revealed') {
        return { label: 'Nächster Experte', action: { type: 'EXPERTS_NEXT' }, tone: 'primary' }
      }
      return null
    }

    case 'player-spotlight': {
      if (live.phase === 'revealed') {
        return { label: 'Nächster Spieler', action: { type: 'SPOTLIGHT_NEXT' }, tone: 'primary' }
      }
      return null
    }

    case 'around-corner': {
      if (live.phase === 'revealed') {
        const done = live.currentIndex + 1 >= live.totalRiddles
        return {
          label: done ? 'Klick! beenden' : 'Nächstes Rätsel',
          action: { type: 'AC_NEXT' },
          tone: 'primary',
        }
      }
      return null
    }

    default:
      return null
  }
}

export function HostActionBar({ state, canDispatch, send }: Props) {
  const action = resolveHostAction(state)
  if (!action) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-brand-purple/30 bg-brand-purple/[0.06] px-4 py-2.5 text-xs text-brand-purple-soft"
      >
        <span aria-hidden>🎬</span>
        <span>Host-Steuerung — warte auf die Player</span>
      </div>
    )
  }
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2',
        action.tone === 'primary'
          ? 'border-brand-purple/50 bg-brand-purple/10'
          : 'border-white/15 bg-white/[0.03]',
      )}
    >
      <span aria-hidden className="text-lg">
        🎬
      </span>
      <span className="text-[10px] uppercase tracking-[0.28em] text-brand-purple-soft">
        Host
      </span>
      <Button
        size="md"
        variant={action.tone}
        onClick={() => send(action.action)}
        disabled={!canDispatch}
        className="ml-auto"
      >
        {action.label}
      </Button>
    </div>
  )
}
