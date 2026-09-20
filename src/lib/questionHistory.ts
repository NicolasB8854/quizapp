/**
 * Persistente Frage-Historie über mehrere Runden hinweg.
 *
 * Zweck (aus konzept-v2.md, Kapitel 7 Prinzip 4):
 * „Keine Frage-Duplikate zwischen Runden. Das System muss vor Verwendung einer Frage
 * prüfen, ob sie schon einmal gestellt wurde."
 *
 * Speicherort: `localStorage`. Bewusst nicht `sessionStorage` — Duplicate-Check soll
 * über Tab- und Browser-Sessions hinweg greifen, damit dieselbe Runde nicht am nächsten
 * Abend die gleichen Fragen zieht.
 *
 * Alle Zugriffe sind fehler-tolerant: Wenn `localStorage` nicht verfügbar ist (private
 * Browser-Modi, deaktiviert), fallen wir auf einen leeren Filter zurück. Duplicate-Check
 * ist nice-to-have; die App muss auch ohne Historie funktionieren.
 */

const STORAGE_KEY = 'quizapp:questionHistory'

/** Lädt alle bisher gestellten Frage-IDs aus dem localStorage. */
export function readAskedQuestionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

/**
 * Fügt Frage-IDs zur Historie hinzu (idempotent).
 * Fehler beim Schreiben werden verschluckt — Historie ist nicht kritisch.
 */
export function markQuestionsAsked(ids: readonly string[]): void {
  if (ids.length === 0) return
  try {
    const existing = readAskedQuestionIds()
    for (const id of ids) existing.add(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]))
  } catch {
    // Silent — App bleibt funktionsfähig.
  }
}

/** Leert die Historie komplett. Für „Alle Fragen wieder zulassen"-Aktionen. */
export function clearQuestionHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silent.
  }
}
