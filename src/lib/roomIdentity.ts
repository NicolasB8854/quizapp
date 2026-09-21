/**
 * Persistente Player-Identity für Multi-Device-Sessions.
 *
 * Wenn der User seinen Browser refreshed oder das Handy Reconnected, will der
 * Server denselben Player wiedererkennen — dafür speichern wir die vom Server
 * bestätigte `playerId` in localStorage.
 *
 * Zusätzlich: der letzte genutzte `playerName`, damit das Join-Formular ihn
 * vorbelegen kann.
 *
 * Bewusst kein Account-System (siehe konzept-v2.md: „Keine Account-Hürde"),
 * nur ein reines Wiedererkennungs-Cookie.
 */

const STORAGE_KEY = 'quizapp:roomIdentity'

export interface RoomIdentity {
  playerId: string | null
  playerName: string | null
}

const EMPTY: RoomIdentity = { playerId: null, playerName: null }

/** Lädt die aktuelle Identity aus dem Storage. Fehler-tolerant. */
export function readRoomIdentity(): RoomIdentity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY
    const rec = parsed as Record<string, unknown>
    return {
      playerId: typeof rec.playerId === 'string' ? rec.playerId : null,
      playerName: typeof rec.playerName === 'string' ? rec.playerName : null,
    }
  } catch {
    return EMPTY
  }
}

/**
 * Merged eine Teil-Änderung in die Storage. Nicht-übergebene Felder bleiben
 * unverändert. Fehler-tolerant.
 */
export function saveRoomIdentity(patch: Partial<RoomIdentity>): void {
  try {
    const current = readRoomIdentity()
    const next: RoomIdentity = {
      playerId: patch.playerId ?? current.playerId,
      playerName: patch.playerName ?? current.playerName,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Silent — Multi-Device funktioniert auch ohne Persistenz, nur ohne Wiedererkennung.
  }
}

/** Wischt Identity komplett (z. B. „Als anderer Spieler joinen"). */
export function clearRoomIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* silent */
  }
}
