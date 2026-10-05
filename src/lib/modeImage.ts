/** Studio-Motiv pro Spielmodus (Bedrock, freigegebener Studio-Look). */
import type { GameModeId } from '@quizapp/shared'

/** Varianten ohne eigenes Motiv teilen sich das Bild ihres Grundmodus. */
const SHARED: Partial<Record<GameModeId, GameModeId>> = {
  'geo-hints': 'geoguess',
  'geo-shape': 'geoguess',
  'geo-history': 'geoguess',
}

export function modeImage(id: GameModeId): string {
  return `/img/modes/${SHARED[id] ?? id}.jpg`
}
