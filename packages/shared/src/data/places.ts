/**
 * Orte für „Wo liegt das?" (Koordinaten gegen OpenStreetMap geprüft,
 * siehe .audit-work/geo/verify_places.py). Stufe nach Rubrik 1–5.
 */
import raw from './places.json'
import type { Difficulty } from '../types/question'

export interface Place {
  id: string
  name: string
  country: string
  lat: number
  lon: number
  difficulty: Difficulty
  /** Kurzer Fakt für die Auflösung. */
  fact: string
}

export const PLACES: readonly Place[] = raw as Place[]
