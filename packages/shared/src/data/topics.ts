/**
 * Die zwölf Themenfelder des Themen-Battles.
 *
 * IDs sind konsistent mit dem `Topic`-Typ. `label` = deutsche UI-Anzeige, `emoji` = kleiner
 * Wiedererkennungs-Anker in den Grid-Kacheln (dezent eingesetzt, keine Clipart-Optik).
 */

import type { Topic } from '../types/question'

export interface TopicDef {
  id: Topic
  label: string
  emoji: string
}

export const TOPICS: TopicDef[] = [
  { id: 'film',         label: 'Film',            emoji: '🎬' },
  { id: 'serien',       label: 'Serien',          emoji: '📺' },
  { id: 'musik',        label: 'Musik',           emoji: '🎧' },
  { id: 'games',        label: 'Games',           emoji: '🎮' },
  { id: 'geografie',    label: 'Geografie',       emoji: '🗺️' },
  { id: 'geschichte',   label: 'Geschichte',      emoji: '🏛️' },
  { id: 'wissenschaft', label: 'Wissenschaft',    emoji: '🔬' },
  { id: 'sport',        label: 'Sport',           emoji: '🏆' },
  { id: 'essen',        label: 'Essen & Trinken', emoji: '🍷' },
  { id: 'technik',      label: 'Technik',         emoji: '💾' },
  { id: 'sprache',      label: 'Sprache',         emoji: '🔤' },
  { id: 'kurioses',     label: 'Kurioses',        emoji: '🤔' },
]

export const TOPICS_BY_ID: Record<Topic, TopicDef> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t]),
) as Record<Topic, TopicDef>
