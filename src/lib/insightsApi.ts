/**
 * Frage melden + anonyme Kennzahlen (POST, öffentlich) und Admin-Auswertung (GET, Token).
 * Basis: VITE_HTTP_URL. Fehlt sie, werden Meldungen/Events still verworfen.
 */
import { getAdminToken } from './adminToken'

const BASE = import.meta.env.VITE_HTTP_URL as string | undefined

export type ReportReason = 'falsch' | 'mehrdeutig' | 'zu-leicht' | 'zu-schwer' | 'tippfehler' | 'sonstiges'

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  falsch: 'Antwort ist falsch',
  mehrdeutig: 'Mehrere Antworten passen',
  'zu-leicht': 'Viel zu leicht',
  'zu-schwer': 'Viel zu schwer',
  tippfehler: 'Tipp- oder Formulierungsfehler',
  sonstiges: 'Etwas anderes',
}

export async function reportQuestion(input: {
  questionId: string
  reason: ReportReason
  note?: string
  source: 'room' | 'solo'
}): Promise<boolean> {
  if (!BASE) return false
  try {
    const res = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    return res.ok
  } catch {
    return false
  }
}

export type ClientEvent = 'solo_finished' | 'invite_shared' | 'director_used'

/** Fire-and-forget; blockiert nie die UI. */
export function track(event: ClientEvent): void {
  if (!BASE) return
  const body = JSON.stringify({ event })
  try {
    if (navigator.sendBeacon?.(`${BASE}/events`, new Blob([body], { type: 'text/plain' }))) return
  } catch {
    /* fallback unten */
  }
  void fetch(`${BASE}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(
    () => undefined,
  )
}

async function adminGet<T>(path: string): Promise<T> {
  if (!BASE) throw new Error('VITE_HTTP_URL fehlt')
  const token = getAdminToken()
  if (!token) throw new Error('Admin-Token fehlt')
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-admin-token': token } })
  if (res.status === 403) throw new Error('Admin-Token ungültig')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export interface ReportRow {
  questionId: string
  reason: ReportReason
  note?: string
  source: string
  createdAt: string
}

export const fetchReports = () => adminGet<{ reports: ReportRow[] }>('/reports').then((r) => r.reports)
export const fetchMetrics = () =>
  adminGet<{ metrics: Record<string, Record<string, number>> }>('/metrics').then((r) => r.metrics)
