/** Admin-Token für Fragen-Editor und Auswertung — nur auf Nicolas' Geräten gesetzt. */
const KEY = 'quizapp:adminToken'

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KEY, token.trim())
    else localStorage.removeItem(KEY)
  } catch {
    /* silent */
  }
}
