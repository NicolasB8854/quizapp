/**
 * Admin-Auswertung in /review: Token setzen, KPIs (letzte 30 Tage) und
 * gemeldete Fragen. Ohne gültiges Token passiert nichts (Server prüft).
 */
import { useState } from 'react'
import { KeyRound, RefreshCw } from 'lucide-react'
import { Button } from '@/components/Button'
import { getAdminToken, setAdminToken } from '@/lib/adminToken'
import { fetchMetrics, fetchReports, REPORT_REASON_LABELS, type ReportRow } from '@/lib/insightsApi'

const KPI_LABELS: Record<string, string> = {
  room_created: 'Räume eröffnet',
  night_started: 'Spieleabende gestartet',
  night_finished: 'Spieleabende beendet',
  players_in_nights: 'Spieler in Abenden',
  player_joined: 'Beitritte',
  mode_played: 'Modi gespielt',
  solo_finished: 'Solo-Runden',
  question_reported: 'Fragen gemeldet',
  invite_shared: 'Einladungen geteilt',
  director_used: 'Quiz Director genutzt',
}

export function AdminInsightsPanel({ onSelectQuestion }: { onSelectQuestion?: (id: string) => void }) {
  const [token, setToken] = useState(getAdminToken() ?? '')
  const [metrics, setMetrics] = useState<Record<string, Record<string, number>> | null>(null)
  const [reports, setReports] = useState<ReportRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setAdminToken(token || null)
    setLoading(true)
    setError(null)
    try {
      const [m, r] = await Promise.all([fetchMetrics(), fetchReports()])
      setMetrics(m)
      setReports(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const totals: Record<string, number> = {}
  for (const day of Object.values(metrics ?? {})) {
    for (const [k, v] of Object.entries(day)) totals[k] = (totals[k] ?? 0) + v
  }
  const nights = totals.night_started ?? 0
  const playersPerNight = nights > 0 ? (totals.players_in_nights ?? 0) / nights : 0

  return (
    <section className="mt-8 space-y-4 rounded-card border-2 border-white/10 bg-navy-900/80 p-4 md:p-5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="eyebrow text-brand-purple-soft">Admin-Token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            placeholder="aus infra/secrets.auto.tfvars"
            className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white placeholder-white/30"
          />
        </label>
        <Button variant="primary" leading={loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} onClick={() => void load()}>
          Auswertung laden
        </Button>
      </div>
      {error && <p className="text-sm text-wrong">{error}</p>}

      {metrics && (
        <div>
          <div className="eyebrow mb-2 text-ink-muted">Kennzahlen · letzte 30 Tage</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Spieleabende" value={nights} />
            <Kpi label="Spieler / Abend" value={playersPerNight ? playersPerNight.toFixed(1) : '–'} />
            <Kpi label="Solo-Runden" value={totals.solo_finished ?? 0} />
            <Kpi
              label="Meldequote"
              value={totals.mode_played ? `${((100 * (totals.question_reported ?? 0)) / Math.max(1, totals.mode_played * 8)).toFixed(1)} %` : '–'}
              hint="Meldungen / ~8 Fragen pro Modus"
            />
          </div>
          <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {Object.entries(KPI_LABELS).map(([k, label]) => (
              <div key={k} className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
                <span className="text-ink-muted">{label}</span>
                <span className="font-mono text-white">{totals[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reports && (
        <div>
          <div className="eyebrow mb-2 text-ink-muted">Gemeldete Fragen ({reports.length})</div>
          {reports.length === 0 ? (
            <p className="text-sm text-ink-muted">Noch keine Meldungen.</p>
          ) : (
            <ul className="space-y-1">
              {reports.map((r, i) => (
                <li key={`${r.createdAt}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => onSelectQuestion?.(r.questionId)}
                    className="font-mono text-brand-cyan-soft hover:underline"
                  >
                    {r.questionId}
                  </button>
                  <span className="text-white/85">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span>
                  <span className="ml-auto text-xs text-ink-muted">
                    {r.source} · {new Date(r.createdAt).toLocaleString('de-DE')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" title={hint}>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="font-display text-2xl font-extrabold text-white">{value}</div>
    </div>
  )
}
