/**
 * Orte für „Wo liegt das?" (Koordinaten gegen OpenStreetMap geprüft,
 * siehe .audit-work/geo/verify_places.py). Stufe nach Rubrik 1–5.
 */
import raw from './places.json'
import rawRiddles from './geoRiddles.json'
import rawEvents from './geoEvents.json'
import rawShapes from './geoShapes.json'
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

/** Ziel einer Geo-Runde: ein Ort plus variantenabhängige Zusatzdaten. */
export interface GeoTarget extends Place {
  /** Heißer Draht: Hinweise, vage → konkret. */
  hints?: string[]
  /** Zeitreise: Ereignis, das statt des Namens gezeigt wird. */
  prompt?: string
  /** Länder-Umriss: Silhouette (SVG-Pfad in 200×200), Drehung in Grad, Radius in km. */
  path?: string
  rotate?: number
  radiusKm?: number
}

export type GeoVariant = 'place' | 'hints' | 'shape' | 'history'

/** Heißer Draht: Ort über 4 Hinweise erraten (Koordinaten OSM-geprüft). */
export const GEO_RIDDLES: readonly GeoTarget[] = rawRiddles as GeoTarget[]
/** Zeitreise: Wo fand das statt? (Koordinaten OSM-geprüft). */
export const GEO_EVENTS: readonly GeoTarget[] = rawEvents as GeoTarget[]
/** Länder-Umriss: Silhouetten aus Natural Earth (scripts/build-geo-shapes.py). */
export const GEO_SHAPES: readonly GeoTarget[] = rawShapes as GeoTarget[]

export function geoPool(variant: GeoVariant): readonly GeoTarget[] {
  switch (variant) {
    case 'hints':
      return GEO_RIDDLES
    case 'history':
      return GEO_EVENTS
    case 'shape':
      return GEO_SHAPES
    default:
      return PLACES
  }
}
