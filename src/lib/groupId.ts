/**
 * Zufällige Gruppen-ID dieses Geräts. Wer hostet, schickt sie beim Beitritt
 * mit; der Server merkt sich darunter die gestellten Fragen, damit sie sich
 * über mehrere Abende derselben Runde nicht wiederholen. Keine Personendaten.
 */
const KEY = 'quizapp:groupId'

export function getGroupId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) return existing
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}
