/**
 * Room-Code-Generator im Stile klassischer Party-Show-Codes.
 *
 * - Vier Zeichen, alphanumerisch, ohne mehrdeutige Zeichen (0/O, 1/I).
 * - Groß geschrieben — konsistent mit der Anzeige in der Lobby (Designkonzept).
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 4): string {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}
