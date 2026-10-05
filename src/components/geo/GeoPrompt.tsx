/**
 * Aufgaben-Karte für die Geo-Modi: Ortsname, Hinweise (Heißer Draht),
 * Länder-Silhouette (Länder-Umriss) oder Ereignis (Zeitreise).
 */
import { GEO_HINT_FACTORS, type GeoLive } from '@quizapp/shared'
import { Card } from '@/components/Card'
import { cn } from '@/lib/classnames'

const EYEBROW: Record<GeoLive['variant'], string> = {
  place: 'Setz die Nadel',
  hints: 'Heißer Draht',
  shape: 'Wo liegt dieses Land?',
  history: 'Wo ist das passiert?',
}

export function hintFactor(hints: number | null | undefined): number {
  return GEO_HINT_FACTORS[(hints ?? GEO_HINT_FACTORS.length) - 1] ?? 1
}

function fmtFactor(f: number): string {
  return `×${String(f).replace('.', ',')}`
}

export function GeoPrompt({ live, isMaster, myTeamId }: { live: GeoLive; isMaster: boolean; myTeamId: string | null }) {
  const place = live.place
  if (!place) return null
  const revealed = live.phase === 'revealed'
  const big = isMaster ? 'text-5xl' : 'text-3xl'
  const solution = (
    <>
      <div className={cn('mt-1 font-display font-extrabold text-white', big)}>{place.name}</div>
      {place.country !== place.name && (
        <div className={cn('mt-1 text-ink-muted', isMaster ? 'text-lg' : 'text-sm')}>{place.country}</div>
      )}
    </>
  )

  return (
    <Card className={cn('text-center', isMaster ? 'p-6' : 'p-4')}>
      <div className="text-xs uppercase tracking-[0.28em] text-ink-muted">{EYEBROW[live.variant]}</div>

      {live.variant === 'place' && (
        <>
          <div className={cn('mt-1 font-display font-extrabold text-white', big)}>{place.name}</div>
          {revealed && <div className={cn('mt-1 text-ink-muted', isMaster ? 'text-lg' : 'text-sm')}>{place.country}</div>}
        </>
      )}

      {live.variant === 'history' && (
        <>
          <div className={cn('mx-auto mt-2 max-w-2xl font-display font-bold leading-snug text-white', isMaster ? 'text-3xl' : 'text-xl')}>
            {place.prompt}
          </div>
          {revealed && solution}
        </>
      )}

      {live.variant === 'shape' && (
        <>
          <svg
            viewBox="-10 -10 220 220"
            className={cn('mx-auto mt-2 block', isMaster ? 'h-64 w-64' : 'h-44 w-44')}
            role="img"
            aria-label={revealed ? `Umriss von ${place.name}` : 'Umriss eines Landes'}
          >
            <g
              style={{ transition: 'transform 700ms ease', transformOrigin: '100px 100px', transform: `rotate(${revealed ? 0 : place.rotate ?? 0}deg)` }}
            >
              <path d={place.path} fill="#3FD98B" fillOpacity={0.25} stroke="#3FD98B" strokeWidth={2.5} strokeLinejoin="round" />
            </g>
          </svg>
          {revealed ? solution : <div className="mt-1 text-sm text-ink-muted">Ohne Nachbarn, nicht maßstabsgetreu — und vielleicht gedreht.</div>}
        </>
      )}

      {live.variant === 'hints' && (
        <>
          <ol className={cn('mx-auto mt-3 max-w-2xl space-y-2 text-left', isMaster ? 'text-2xl' : 'text-base')}>
            {(place.hints ?? []).slice(0, revealed ? undefined : live.revealedHints).map((h, i) => (
              <li
                key={i}
                className={cn(
                  'flex gap-3 rounded-xl border px-3 py-2',
                  i === live.revealedHints - 1 && !revealed ? 'border-correct/60 bg-correct/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/80',
                )}
              >
                <span className="font-display font-extrabold text-correct">{i + 1}</span>
                <span>{h}</span>
              </li>
            ))}
          </ol>
          {!revealed && (
            <div className={cn('mt-3 text-amber-200', isMaster ? 'text-xl' : 'text-sm')}>
              Jetzt setzen = {fmtFactor(hintFactor(live.revealedHints))} Punkte
              {myTeamId && live.pinHints[myTeamId] != null && (
                <span className="text-ink-muted"> · eure Nadel zählt {fmtFactor(hintFactor(live.pinHints[myTeamId]))}</span>
              )}
            </div>
          )}
          {revealed && solution}
        </>
      )}
    </Card>
  )
}
