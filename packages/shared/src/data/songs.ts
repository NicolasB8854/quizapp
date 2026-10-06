/**
 * Songkatalog für die Musik-Modi (Summ-Duell, „Welches Jahr?").
 * Nur Titel, Interpret und Jahr — keine Songtexte, keine Audiodateien.
 * Jahre gegen MusicBrainz geprüft (.audit-work/music/verify_songs.py).
 */
import raw from './songs.json'

export interface Song {
  id: string
  title: string
  artist: string
  /** Jahr der Erstveröffentlichung. */
  year: number
  /** 1 = kennt jeder … 3 = eher Fans. */
  difficulty: 1 | 2 | 3
  fact: string
}

export const SONGS: readonly Song[] = raw as Song[]

/** Punkte für „Welches Jahr?" nach Abstand in Jahren. */
export function yearPoints(diff: number): number {
  if (diff === 0) return 300
  if (diff === 1) return 200
  if (diff <= 3) return 100
  if (diff <= 5) return 50
  return 0
}

export const YEAR_MIN = 1950
export const YEAR_MAX = 2030
