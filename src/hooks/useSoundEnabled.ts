/**
 * React-Zugriff auf den Sound-Enabled-Zustand aus `@/lib/audio`.
 *
 * Hält den lokalen Zustand mit dem SoundManager synchron. Für den einfachen
 * Ein-Toggle-Case reicht das aus — es gibt aktuell nur eine Instanz des
 * Toggles im Room-Header, deswegen keine Notwendigkeit für einen Event-Bus.
 */

import { useCallback, useState } from 'react'
import { isSoundEnabled, setSoundEnabled } from '@/lib/audio'

export function useSoundEnabled(): {
  enabled: boolean
  toggle: () => void
} {
  const [enabled, setEnabled] = useState<boolean>(() => isSoundEnabled())

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      setSoundEnabled(next)
      return next
    })
  }, [])

  return { enabled, toggle }
}
