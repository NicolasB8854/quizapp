/**
 * Fisher-Yates-Shuffle mit Rückgabe der neuen Reihenfolge UND einer Mapping-Funktion,
 * damit man den Original-Index einer geshuffleten Option zurückbekommt.
 *
 * Anwendung bei Multiple-Choice-Fragen: die richtige Antwort steht via `correctIndex` im
 * Original-Array. Beim Rendern shufflen wir die Optionen — die Mapping-Funktion sagt
 * uns, welcher gerenderte Index dem Original-`correctIndex` entspricht.
 *
 * Deterministisch mit Seed: Wenn ein `seed` übergeben wird, ist die Reihenfolge
 * reproduzierbar. Nützlich für Tests, für konsistente Multi-Device-Ansichten (alle
 * Clients rechnen dieselbe Reihenfolge aus dem Round-ID+Question-ID-Hash) und für
 * State-Wiederherstellung nach Refresh.
 *
 * Ohne Seed nutzt der Shuffle `Math.random` (Bestandsverhalten).
 */

export interface ShuffleResult<T> {
  shuffled: T[]
  originalIndexOf: (renderedIndex: number) => number
  renderedIndexOf: (originalIndex: number) => number
}

export function shuffleWithMapping<T>(items: T[], seed?: string): ShuffleResult<T> {
  const rand = seed !== undefined ? mulberry32(hashString(seed)) : Math.random
  const indices = items.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const shuffled = indices.map((originalIdx) => items[originalIdx])
  const originalIndexOf = (renderedIndex: number) => indices[renderedIndex]
  const renderedIndexOf = (originalIndex: number) => indices.indexOf(originalIndex)
  return { shuffled, originalIndexOf, renderedIndexOf }
}

/**
 * FNV-1a-32 Hash. Ausreichend gleichmäßig für Shuffle-Seeding, nicht kryptografisch.
 */
function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Mulberry32 PRNG — schneller, kleiner, ausreichend gleichmäßig für Shuffle-Zwecke.
 * Quelle: https://gist.github.com/tommyettinger/46a3b5f13beb0961e46e05977b6f3a26
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
