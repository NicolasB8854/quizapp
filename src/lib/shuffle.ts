/**
 * Fisher-Yates-Shuffle mit Rückgabe der neuen Reihenfolge UND einer Mapping-Funktion,
 * damit man den Original-Index einer geshuffleten Option zurückbekommt.
 *
 * Anwendung bei Multiple-Choice-Fragen: die richtige Antwort steht via correctIndex im
 * Original-Array. Beim Rendern shufflen wir die Optionen — die Mapping-Funktion sagt
 * uns, welcher gerenderte Index dem Original-correctIndex entspricht.
 */

export interface ShuffleResult<T> {
  shuffled: T[]
  originalIndexOf: (renderedIndex: number) => number
  renderedIndexOf: (originalIndex: number) => number
}

export function shuffleWithMapping<T>(items: T[]): ShuffleResult<T> {
  const indices = items.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const shuffled = indices.map((originalIdx) => items[originalIdx])
  const originalIndexOf = (renderedIndex: number) => indices[renderedIndex]
  const renderedIndexOf = (originalIndex: number) => indices.indexOf(originalIndex)
  return { shuffled, originalIndexOf, renderedIndexOf }
}
