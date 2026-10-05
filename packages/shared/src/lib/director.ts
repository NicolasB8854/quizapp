/**
 * Quiz Director (Businessplan-USP): stellt einen Spieleabend zusammen.
 *
 * Dramaturgie statt Zufall:
 *   1. Opener — locker, alle zusammen (Klick! oder Blitzrunde)
 *   2. Hauptteil — abwechselnde Mechaniken (nie zwei Buzzer-Modi direkt hintereinander)
 *   3. Finale — hoher Einsatz (Alles oder Nichts bzw. Elimination)
 * Die Gruppe fließt ein: Spotlight nur, wenn genug Spieler Interessen gepflegt
 * haben; Fachrunde ab 2 Spielern; Duell 1:1 erst ab 2 Spielern pro Team.
 */
import { MODES_BY_ID } from '../data/modes'
import type { GameModeId } from '../types/round'

export interface DirectorInput {
  /** Gewünschte Länge des Abends in Minuten. */
  minutes: number
  playerCount: number
  teamCount: number
  /** Spieler mit mindestens einem gepflegten Interesse. */
  playersWithInterests: number
  /** Zufallsquelle (für Tests deterministisch). */
  random?: () => number
}

type Mechanic = 'calm' | 'turns' | 'buzzer' | 'speed' | 'stakes' | 'personal'

const MECHANIC: Partial<Record<GameModeId, Mechanic>> = {
  'around-corner': 'calm',
  flash: 'speed',
  'category-duel': 'turns',
  'category-board': 'buzzer',
  'duel-1v1': 'buzzer',
  sprinter: 'speed',
  experts: 'personal',
  'player-spotlight': 'personal',
  elimination: 'stakes',
  'points-ladder': 'stakes',
  blindguess: 'speed',
  geoguess: 'calm',
  'geo-hints': 'speed',
  'geo-shape': 'calm',
  'geo-history': 'calm',
}

export function minutesOf(modes: readonly GameModeId[]): number {
  return modes.reduce((sum, id) => sum + (MODES_BY_ID[id]?.estimatedMinutes ?? 10), 0)
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function directEvening(input: DirectorInput): GameModeId[] {
  const random = input.random ?? Math.random
  const target = Math.max(15, input.minutes)
  const available = new Set<GameModeId>(
    (Object.keys(MECHANIC) as GameModeId[]).filter((id) => MODES_BY_ID[id]?.status === 'ready'),
  )
  if (input.playerCount < 2) available.delete('experts')
  if (input.playerCount < input.teamCount * 2) available.delete('duel-1v1')
  if (input.playersWithInterests < Math.max(2, Math.ceil(input.playerCount / 2))) available.delete('player-spotlight')

  // 1. Opener: bei kurzen Abenden die schnelle Blitzrunde, sonst das Warm-up.
  const opener: GameModeId = target >= 45 && available.has('around-corner') ? 'around-corner' : 'flash'
  // 3. Finale: bei längeren Abenden die Punkte-Leiter, sonst Elimination.
  const finale: GameModeId = target >= 40 ? 'points-ladder' : 'elimination'
  available.delete(opener)
  available.delete(finale)

  const plan: GameModeId[] = [opener]
  let budget = target - minutesOf([opener, finale])

  // 2. Hauptteil: persönliche Modi zuerst einplanen (das ist der USP), dann Vielfalt.
  const preferred = shuffled(
    [...available].filter((id) => MECHANIC[id] === 'personal'),
    random,
  )
  const rest = shuffled(
    [...available].filter((id) => MECHANIC[id] !== 'personal'),
    random,
  )
  for (const id of [...preferred.slice(0, 1), ...rest, ...preferred.slice(1)]) {
    const mins = MODES_BY_ID[id]?.estimatedMinutes ?? 10
    if (mins > budget + 5) continue
    const prev = plan[plan.length - 1]
    if (MECHANIC[prev] === 'buzzer' && MECHANIC[id] === 'buzzer') continue
    plan.push(id)
    budget -= mins
    if (budget <= 3) break
  }
  plan.push(finale)
  return plan
}
