/**
 * Cross-Topic-Interessen-Suche.
 *
 * Bisher konnte man nur innerhalb eines bereits aktivierten Topics nach
 * Sub-Interessen suchen. Für 2-Sekunden-Onboarding auf dem Handy zu
 * umständlich — Realität ist: der Spieler denkt „ich bin Formel-1-Fan"
 * und will das eintippen, nicht erst „Sport" aktivieren und dann suchen.
 *
 * Diese Bibliothek stellt einen flachen Index aus zwei Quellen bereit:
 *
 *   1. **Katalog-Tags**: alle `tags[]` aus dem Fragen-Pool. Für jedes Tag
 *      wird das Haupt-Topic aus den passenden Fragen abgeleitet (das
 *      häufigste; bei Gleichstand alphabetisch). Diese Einträge haben
 *      Vorrang, weil sie tatsächlich zu Fragen führen.
 *   2. **Interest-Suggestions**: kuratierte Liste pro Topic aus
 *      `interest-suggestions.ts`. Ergänzt den Katalog um sinnvolle
 *      Vorschläge, die (noch) keine Fragen haben.
 *
 * Duplikate (identisches Label, case-insensitive) werden dedupliziert;
 * die Katalog-Version gewinnt.
 *
 * Der Index wird nicht module-level gecacht — der Katalog kann zur
 * Laufzeit ausgetauscht werden (`setQuestionCatalog` in Server-Cold-
 * Starts). Aufrufer sollten `useMemo` verwenden.
 */

import type { Topic } from '../types/question'
import { getAllQuestions } from './questions'
import { INTEREST_SUGGESTIONS } from '../data/interest-suggestions'
import { TOPICS } from '../data/topics'

export interface InterestSearchEntry {
  /** Anzeige-Label, in Originalschreibweise. */
  label: string
  /** Normalisierte Form für Match-Vergleich (lowercase, getrimmt). */
  normalized: string
  /** Zugeordnetes Topic (bei Tags: häufigstes Fragen-Topic). */
  topic: Topic
  /** Herkunft — Katalog-Tag oder statischer Vorschlag. */
  source: 'tag' | 'suggestion'
  /** Anzahl Fragen im Katalog mit diesem Tag. Für Ranking. */
  catalogCount: number
}

export interface InterestSearchResult {
  label: string
  topic: Topic
  source: 'tag' | 'suggestion'
  /** Ranking-Score — höher = besser. */
  score: number
}

/**
 * Baut den Suchindex einmalig aus dem aktuellen Katalog. Rückgabe ist ein
 * flaches Array; Aufrufer memoize.
 */
export function buildInterestSearchIndex(): InterestSearchEntry[] {
  const entries: InterestSearchEntry[] = []

  // 1) Katalog-Tags: pro Tag zählen wir, in welchen Topics es vorkommt.
  //    Das häufigste Topic wird zum Primär-Topic dieses Tags.
  const tagTopicCounts = new Map<string, Map<Topic, number>>()
  for (const q of getAllQuestions()) {
    if (!q.tags || q.tags.length === 0) continue
    for (const rawTag of q.tags) {
      const tag = (rawTag ?? '').trim()
      if (!tag) continue
      let inner = tagTopicCounts.get(tag)
      if (!inner) {
        inner = new Map<Topic, number>()
        tagTopicCounts.set(tag, inner)
      }
      inner.set(q.topic, (inner.get(q.topic) ?? 0) + 1)
    }
  }

  const seenNormalized = new Set<string>()
  for (const [tag, topicMap] of tagTopicCounts) {
    let bestTopic: Topic | null = null
    let bestCount = 0
    for (const [topic, count] of topicMap) {
      if (count > bestCount) {
        bestCount = count
        bestTopic = topic
      }
    }
    if (!bestTopic) continue
    const normalized = tag.toLowerCase()
    if (seenNormalized.has(normalized)) continue // Katalog-Duplikate reduzieren
    seenNormalized.add(normalized)
    entries.push({
      label: tag,
      normalized,
      topic: bestTopic,
      source: 'tag',
      catalogCount: bestCount,
    })
  }

  // 2) Interest-Suggestions: pro Topic die statische Liste — nur solche,
  //    die noch nicht als Katalog-Tag vorkommen.
  for (const topic of TOPICS) {
    const suggestions = INTEREST_SUGGESTIONS[topic.id] ?? []
    for (const label of suggestions) {
      const normalized = label.toLowerCase()
      if (seenNormalized.has(normalized)) continue
      seenNormalized.add(normalized)
      entries.push({
        label,
        normalized,
        topic: topic.id,
        source: 'suggestion',
        catalogCount: 0,
      })
    }
  }

  return entries
}

/**
 * Sucht im Index nach dem Query. Rangfolge:
 *   1. Prefix-Match schlägt Substring-Match.
 *   2. Höhere `catalogCount` schlägt niedrigere.
 *   3. Kürzere Labels schlagen längere (bessere Präzision).
 *   4. Katalog-Tags bevorzugen wir leicht gegenüber Suggestions.
 *   5. Alphabetisch als Tie-Breaker.
 *
 * `alreadyChosen`: Set aus normalisierten Labels, die der Nutzer bereits
 * ausgewählt hat — diese werden aus den Ergebnissen gefiltert, damit die
 * Suche nicht schon vergebene Chips vorschlägt.
 */
export function searchInterests(
  index: InterestSearchEntry[],
  query: string,
  alreadyChosen: ReadonlySet<string> = new Set(),
  limit: number = 8,
): InterestSearchResult[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return []

  const scored: Array<{ entry: InterestSearchEntry; score: number }> = []
  for (const entry of index) {
    if (alreadyChosen.has(entry.normalized)) continue
    const idx = entry.normalized.indexOf(q)
    if (idx === -1) continue
    const prefixBonus = idx === 0 ? 1_000 : 0
    const catalogBonus = Math.min(entry.catalogCount, 20) * 8
    const sourceBonus = entry.source === 'tag' ? 5 : 0
    const shortBonus = Math.max(0, 40 - entry.label.length)
    const score = prefixBonus + catalogBonus + sourceBonus + shortBonus
    scored.push({ entry, score })
  }
  scored.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
  return scored.slice(0, limit).map(({ entry, score }) => ({
    label: entry.label,
    topic: entry.topic,
    source: entry.source,
    score,
  }))
}

/**
 * Fügt bei Bedarf ein Topic zur Interessen-Liste hinzu, wenn es dort noch
 * nicht existiert. Behält das bisherige Level bei; für neu hinzugefügte
 * Topics wird `defaultLevel` gesetzt (Empfehlung: 3 = „gut", moderat).
 */
export function ensureTopicInInterests(
  currentInterests: readonly {
    topic: Topic
    level: 1 | 2 | 3 | 4 | 5
    tags?: string[]
  }[],
  topic: Topic,
  defaultLevel: 1 | 2 | 3 | 4 | 5 = 3,
): typeof currentInterests {
  if (currentInterests.some((i) => i.topic === topic)) return currentInterests
  return [...currentInterests, { topic, level: defaultLevel }]
}
