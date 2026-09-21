/**
 * Persistiertes Spielerprofil aus der Player-Library.
 *
 * Wandert bewusst nicht in die Frontend-only `playerLibrary.ts`, weil der
 * Reducer den Typ referenziert (Actions wie `ADD_PLAYER_FROM_LIBRARY`).
 * `playerLibrary.ts` bleibt Frontend-only (Storage), importiert diesen Typ
 * aber von hier.
 */
import type { Avatar, PlayerInterest } from './round'

export interface PlayerProfile {
  id: string
  name: string
  interests: PlayerInterest[]
  avatar: Avatar
  /** ISO-Datum der letzten Verwendung. */
  lastUsedAt: string
}
