/**
 * Wartet, bis der Fragenkatalog (eigener Chunk) geladen ist. Nur Seiten, die
 * Fragen lokal brauchen (Solo, Ein-Gerät-Flow, Interessen-Suche, Review),
 * hängen dahinter — Start, Modi und Profil laden ohne Katalog.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { isCatalogLoaded, loadBundledCatalog } from '@quizapp/shared'

export function CatalogGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isCatalogLoaded)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (ready) return
    let alive = true
    loadBundledCatalog()
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [ready])

  if (ready) return <>{children}</>
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-navy-900 text-ink-muted">
      {failed ? (
        <>
          <p>Fragen konnten nicht geladen werden.</p>
          <button type="button" className="text-brand-cyan-soft underline" onClick={() => window.location.reload()}>
            Neu laden
          </button>
        </>
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-brand-purple-soft" aria-label="Fragen werden geladen" />
      )}
    </div>
  )
}
