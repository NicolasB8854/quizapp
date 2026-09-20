/**
 * Persistente Spieler-Bibliothek für wiedererkennbare Profile über mehrere
 * Spielabende hinweg (siehe konzept-v2.md, Kapitel 8 „wiederkehrende Spielerprofile").
 *
 * Speicherort: `localStorage`. Bewusst kein Account-System — die App bleibt
 * account-frei laut Konzept-Guideline „Keine Account-Hürde". Wer die App auf
 * einem anderen Gerät nutzt, hat einen frischen Zustand — das ist so gewollt.
 *
 * Datenstruktur: Array von `PlayerProfile` mit Namen, Interessen, Avatar
 * und `lastUsedAt` (ISO-Datum). Sortiert nach Recency beim Lesen — die
 * zuletzt genutzten Profile stehen vorne.
 *
 * Alle Zugriffe sind fehler-tolerant. Bei privaten Browser-Modi oder
 * deaktiviertem localStorage arbeitet die App weiter, aber ohne Bibliothek.
 */

import type { Avatar, Player, PlayerInterest } from '@/types/round'

const STORAGE_KEY = 'quizapp:playerLibrary'
/** Obergrenze, damit die Bibliothek nicht unkontrolliert wächst. */
const MAX_PROFILES = 40

export interface PlayerProfile {
  id: string
  name: string
  interests: PlayerInterest[]
  avatar: Avatar
  /** ISO-Datum der letzten Verwendung. */
  lastUsedAt: string
}

/**
 * Liest alle bekannten Profile aus dem Storage, sortiert nach Recency
 * (jüngste zuerst).
 */
export function readPlayerLibrary(): PlayerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Filter auf plausibel geformte Einträge.
    const list = parsed.filter(isPlayerProfile)
    return list.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
  } catch {
    return []
  }
}

/**
 * Schreibt einen Snapshot der aktuellen Spielerliste in die Bibliothek.
 * Bestehende Profile mit derselben `id` werden überschrieben (Update),
 * neue werden angehängt.
 *
 * `lastUsedAt` wird auf jetzt gesetzt. Profile ohne echten Namen werden
 * übersprungen — leere Slots sollen nicht in die Bibliothek.
 */
export function saveToPlayerLibrary(players: readonly Player[]): void {
  try {
    const existing = readPlayerLibrary()
    const byId = new Map<string, PlayerProfile>()
    for (const p of existing) byId.set(p.id, p)

    const now = new Date().toISOString()
    for (const player of players) {
      if (!player.name.trim()) continue
      byId.set(player.id, {
        id: player.id,
        name: player.name.trim(),
        interests: player.interests,
        avatar: player.avatar,
        lastUsedAt: now,
      })
    }

    // Nach Recency sortieren und auf MAX_PROFILES begrenzen.
    const merged = Array.from(byId.values()).sort((a, b) =>
      b.lastUsedAt.localeCompare(a.lastUsedAt),
    )
    const trimmed = merged.slice(0, MAX_PROFILES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Silent — die App muss auch ohne Bibliothek funktionieren.
  }
}

/** Entfernt ein einzelnes Profil aus der Bibliothek. */
export function removeFromPlayerLibrary(profileId: string): void {
  try {
    const existing = readPlayerLibrary()
    const filtered = existing.filter((p) => p.id !== profileId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch {
    // Silent.
  }
}

/** Leert die gesamte Bibliothek — für „Alles vergessen"-Aktionen. */
export function clearPlayerLibrary(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silent.
  }
}

// ---------- Type Guards ------------------------------------------------------

function isPlayerProfile(x: unknown): x is PlayerProfile {
  if (typeof x !== 'object' || x === null) return false
  const rec = x as Record<string, unknown>
  return (
    typeof rec.id === 'string' &&
    typeof rec.name === 'string' &&
    Array.isArray(rec.interests) &&
    isAvatar(rec.avatar) &&
    typeof rec.lastUsedAt === 'string'
  )
}

function isAvatar(x: unknown): x is Avatar {
  if (typeof x !== 'object' || x === null) return false
  const rec = x as Record<string, unknown>
  return typeof rec.emoji === 'string' && typeof rec.colorHex === 'string'
}
