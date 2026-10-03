/**
 * Titel aus der Geräte-Statistik (#22). Pure Funktionen, keine Persistenz.
 *
 * Themen-Titel: pro Thema Stufe nach Anzahl Antworten UND Trefferquote —
 * viel spielen allein reicht nicht, man muss auch gut sein.
 * Dazu Meta-Titel für Serie, Allround-Wissen und Spieleabend-Siege.
 */
import { TOPICS_BY_ID, type Topic } from '@quizapp/shared'
import type { SoloStats } from './soloStats'

export interface TitleTier {
  id: 'einsteiger' | 'kenner' | 'profi' | 'legende'
  suffix: string
  minAnswered: number
  minRate: number
}

/** Aufsteigend sortiert — die höchste erfüllte Stufe gewinnt. */
export const TITLE_TIERS: readonly TitleTier[] = [
  { id: 'einsteiger', suffix: 'Einsteiger', minAnswered: 10, minRate: 0.5 },
  { id: 'kenner', suffix: 'Kenner', minAnswered: 20, minRate: 0.65 },
  { id: 'profi', suffix: 'Profi', minAnswered: 40, minRate: 0.75 },
  { id: 'legende', suffix: 'Legende', minAnswered: 80, minRate: 0.85 },
]

export interface TopicTitle {
  topic: Topic
  tier: TitleTier
  label: string
  answered: number
  rate: number
  /** Nächste Stufe und was noch fehlt — für den Fortschrittsbalken. */
  next: { tier: TitleTier; answeredMissing: number; rateMissing: number } | null
}

export interface MetaTitle {
  id: string
  label: string
  description: string
}

/** Kurzname fürs Titel-Label: „Chemie & Elemente" → „Chemie". */
const SHORT_OVERRIDES: Partial<Record<Topic, string>> = {
  kunst: 'Kunst',
  getraenke: 'Drinks',
  suesses: 'Dessert',
  kurioses: 'Fun-Fact',
}

export function topicShortName(topic: Topic): string {
  const label = TOPICS_BY_ID[topic]?.label ?? topic
  return SHORT_OVERRIDES[topic] ?? label.split(/ & |, /)[0]
}

function tierRank(id: TitleTier['id']): number {
  return TITLE_TIERS.findIndex((t) => t.id === id)
}

/** Themen-Titel, bestes zuerst (Stufe, dann Quote). */
export function computeTopicTitles(stats: SoloStats): TopicTitle[] {
  const out: TopicTitle[] = []
  for (const [topic, stat] of Object.entries(stats.perTopic) as [Topic, { answered: number; correct: number }][]) {
    if (!stat || stat.answered === 0) continue
    const rate = stat.correct / stat.answered
    let reached: TitleTier | null = null
    for (const tier of TITLE_TIERS) {
      if (stat.answered >= tier.minAnswered && rate >= tier.minRate) reached = tier
    }
    if (!reached) continue
    const nextTier = TITLE_TIERS[tierRank(reached.id) + 1] ?? null
    const label = `${topicShortName(topic)}-${reached.suffix}`
    out.push({
      topic,
      tier: reached,
      label,
      answered: stat.answered,
      rate,
      next: nextTier
        ? {
            tier: nextTier,
            answeredMissing: Math.max(0, nextTier.minAnswered - stat.answered),
            rateMissing: Math.max(0, nextTier.minRate - rate),
          }
        : null,
    })
  }
  return out.sort((a, b) => tierRank(b.tier.id) - tierRank(a.tier.id) || b.rate - a.rate)
}

export function computeMetaTitles(stats: SoloStats): MetaTitle[] {
  const titles: MetaTitle[] = []
  const topicTitles = computeTopicTitles(stats)
  if (stats.streakDays >= 7) titles.push({ id: 'stammgast', label: 'Stammgast', description: '7 Tage in Folge gespielt' })
  else if (stats.streakDays >= 3) titles.push({ id: 'dranbleiber', label: 'Dranbleiber', description: '3 Tage in Folge gespielt' })
  const kennerPlus = topicTitles.filter((t) => tierRank(t.tier.id) >= tierRank('kenner')).length
  if (kennerPlus >= 5) titles.push({ id: 'allrounder', label: 'Allrounder', description: 'In 5 Themen mindestens Kenner' })
  if ((stats.nightsWon ?? 0) >= 5) titles.push({ id: 'quizkoenig', label: 'Quiz-König', description: '5 Spieleabende gewonnen' })
  if (stats.bestScore >= 2500) titles.push({ id: 'highscorer', label: 'Highscorer', description: 'Solo-Runde mit 2500+ Punkten' })
  return titles
}

/** Der eine Titel, der neben dem Avatar steht: bester Themen-Titel, sonst bester Meta-Titel. */
export function primaryTitle(stats: SoloStats): string | null {
  return computeTopicTitles(stats)[0]?.label ?? computeMetaTitles(stats)[0]?.label ?? null
}
