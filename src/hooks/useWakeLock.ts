/**
 * Hält den Bildschirm wach, solange `active` true ist (Screen Wake Lock API).
 * Browser geben den Lock beim Tab-Wechsel frei — beim Zurückkehren holen wir
 * ihn neu. Ohne API-Support (ältere Browser) passiert einfach nichts.
 */
import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const wl = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
    }).wakeLock
    if (!wl) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const s = await wl.request('screen')
        if (cancelled) void s.release()
        else sentinel = s
      } catch {
        // z. B. Energiesparmodus — kein Fehler für den Nutzer.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => undefined)
    }
  }, [active])
}
