/**
 * Aggregation der Spieler-Interessen für den Quiz Director.
 *
 * Aus einer Liste von Spielern werden zwei Sichten abgeleitet:
 *   - `shared`     Topics, die von mindestens zwei Spielern gewählt wurden.
 *   - `individual` Topics, die genau ein Spieler gewählt hat.
 *
 * Zusätzlich `levelPerTopic`: das höchste Selbsteinschätzungs-Level, mit dem ein Topic
 * gewählt wurde. Wird aktuell im UI genutzt und ist bereit für den späteren
 * Difficulty-Match (Session E+).
 *
 * Der Reducer nutzt weiterhin `aggregatePlayerInterests` als flache Union — als
 * Filter-Signal für Legacy-Konsumenten von `round.interests`. `computeInterestProfile`
 * ist die reichere Sicht.
 */

import type { Topic } from '@/types/question'
import type { Player, SkillLevel } from '@/types/round'

/**
 * Höheren SkillLevel gewinnen lassen. Session X: SkillLevel ist numerisch 1-5,
 * `Math.max` reicht — der bisherige LEVEL_ORDER-Trick entfällt.
 */
function maxLevel(a: SkillLevel, b: SkillLevel): SkillLevel {
  return (Math.max(a, b) as SkillLevel)
}

export interface InterestProfile {
  shared: Set<Topic>
  individual: Set<Topic>
  /** Höchstes Level unter allen Spielern, die dieses Topic gewählt haben. */
  levelPerTopic: Map<Topic, SkillLevel>
}

/**
 * Union aller Spieler-Interessen als flache Topic-Liste, dedupliziert, in stabiler
 * Reihenfolge nach erster Nennung. Für Konsumenten, die nur wissen wollen „welche
 * Topics interessieren jemanden" (z. B. Marker im Themen-Battle-Grid).
 */
export function aggregatePlayerInterests(players: readonly Player[]): Topic[] {
  const seen = new Set<Topic>()
  const out: Topic[] = []
  for (const p of players) {
    for (const { topic } of p.interests) {
      if (!seen.has(topic)) {
        seen.add(topic)
        out.push(topic)
      }
    }
  }
  return out
}

/**
 * Berechnet die volle Interessen-Sicht: shared vs. individual und höchstes Level pro
 * Topic. Reine Funktion — kann bei jedem Reducer-Übergang neu aufgerufen werden.
 */
export function computeInterestProfile(players: readonly Player[]): InterestProfile {
  const counts = new Map<Topic, number>()
  const levels = new Map<Topic, SkillLevel>()
  for (const p of players) {
    for (const { topic, level } of p.interests) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
      const existing = levels.get(topic)
      levels.set(topic, existing ? maxLevel(existing, level) : level)
    }
  }
  const shared = new Set<Topic>()
  const individual = new Set<Topic>()
  for (const [topic, n] of counts) {
    if (n >= 2) shared.add(topic)
    else individual.add(topic)
  }
  return { shared, individual, levelPerTopic: levels }
}
