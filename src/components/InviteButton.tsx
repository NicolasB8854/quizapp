/**
 * „Freunde einladen": teilt den Beitritts-Link per System-Teilen-Dialog
 * (Handy), sonst WhatsApp-Link + Kopieren.
 */
import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { track } from '@/lib/insightsApi'
import { cn } from '@/lib/classnames'

export function InviteButton({ roomCode, className }: { roomCode: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/room?code=${encodeURIComponent(roomCode)}`
  const text = `Spieleabend bei QUIZO! Komm in meinen Raum ${roomCode}:`

  const canShare = typeof navigator.share === 'function'

  const share = async () => {
    track('invite_shared')
    if (canShare) {
      try {
        await navigator.share({ title: 'QUIZO Spieleabend', text, url })
        return
      } catch {
        // Abgebrochen oder nicht erlaubt → Fallback unten.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* silent */
    }
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brand-cyan/50 bg-brand-cyan/10 font-semibold text-brand-cyan-soft transition-colors hover:bg-brand-cyan/20"
      >
        {copied ? <Check className="h-4 w-4" /> : canShare ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Link kopiert' : 'Freunde einladen'}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('invite_shared')}
        className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-[#25D366]/50 bg-[#25D366]/10 px-4 text-sm font-semibold text-[#7CF0A8] hover:bg-[#25D366]/20"
      >
        WhatsApp
      </a>
    </div>
  )
}
