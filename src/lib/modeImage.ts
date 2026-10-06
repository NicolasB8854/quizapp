/** Studio-Motiv pro Spielmodus (Bedrock, freigegebener Studio-Look). */
import type { GameModeId } from '@quizapp/shared'

export function modeImage(id: GameModeId): string {
  return `/img/modes/${id}.jpg`
}
