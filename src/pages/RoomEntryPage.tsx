/**
 * `/room` — Einstieg in den Multi-Device-Modus.
 *
 * Zwei Optionen:
 *  1. Neuen Raum eröffnen (Client generiert Room-Code, wird i. d. R. Master
 *     am großen Bildschirm).
 *  2. Bestehenden Raum joinen (Code manuell eingeben, üblicherweise vom
 *     Handy aus als Player).
 *
 * Nach Submit: Redirect zu `/room/:code?name=...&role=...`. Die eigentliche
 * Verbindung baut `RoomLobbyPage` auf.
 *
 * Wenn `VITE_WS_URL` nicht gesetzt ist, zeigt die Seite einen deutlichen
 * Hinweis — der Multi-Device-Modus braucht das deployte Backend.
 */

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Users, WifiOff, ArrowRight, ArrowLeft } from 'lucide-react'
import { generateRoomCode } from '@quizapp/shared'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { readRoomIdentity } from '@/lib/roomIdentity'
import { cn } from '@/lib/classnames'

type Intent = 'create' | 'join'

export default function RoomEntryPage() {
  const navigate = useNavigate()
  const wsUrl = import.meta.env.VITE_WS_URL
  const params = new URLSearchParams(window.location.search)
  const prefilledCode = (params.get('code') ?? '').trim().toUpperCase()

  const identity = useMemo(() => readRoomIdentity(), [])
  const [intent, setIntent] = useState<Intent>(prefilledCode ? 'join' : 'create')
  const [name, setName] = useState(identity.playerName ?? '')
  const [role, setRole] = useState<'player' | 'master'>('player')
  const [freshCode] = useState(() => generateRoomCode(4))
  const [joinCode, setJoinCode] = useState(prefilledCode)

  const chosenCode = intent === 'create' ? freshCode : joinCode.trim().toUpperCase()
  const canSubmit =
    !!wsUrl && name.trim().length > 0 && chosenCode.length >= 3

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const params = new URLSearchParams({
      name: name.trim(),
      role,
    })
    navigate(`/room/${chosenCode}?${params.toString()}`)
  }

  return (
    <ScreenLayout variant="dim">
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="md"
            leading={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/')}
          >
            Zurück
          </Button>
        </div>

        <div>
          <div className="eyebrow">Multi-Device</div>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-white md:text-4xl">
            Party auf mehreren Handys
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-muted">
            Ein Gerät zeigt das Spiel groß, die anderen sind Buzzer und
            Antwort-Controller. Alle sehen live denselben Stand.
          </p>
        </div>

        {!wsUrl && (
          <Card className="border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <strong>Multi-Device ist noch nicht konfiguriert.</strong>{' '}
                Trage <code>VITE_WS_URL</code> in <code>.env.local</code> ein
                und starte <code>npm run dev</code> neu.
              </div>
            </div>
          </Card>
        )}

        <form onSubmit={submit} className="space-y-4">
          {/* Modus-Wahl */}
          <div className="grid gap-3 sm:grid-cols-2">
            <IntentCard
              active={intent === 'create'}
              onClick={() => setIntent('create')}
              icon={<Radio className="h-5 w-5" />}
              title="Neuen Raum eröffnen"
              subtitle={`Code: ${freshCode}`}
            />
            <IntentCard
              active={intent === 'join'}
              onClick={() => setIntent('join')}
              icon={<Users className="h-5 w-5" />}
              title="Bestehendem Raum joinen"
              subtitle="Code vom Master erfragen"
            />
          </div>

          {intent === 'join' && (
            <Card className="space-y-2 p-4">
              <label className="block text-xs uppercase tracking-[0.22em] text-ink-muted">
                Room-Code
              </label>
              <input
                autoFocus
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-white/10 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.4em] text-white placeholder-white/30"
                placeholder="ABCD"
                maxLength={8}
              />
            </Card>
          )}

          {/* Name */}
          <Card className="space-y-2 p-4">
            <label className="block text-xs uppercase tracking-[0.22em] text-ink-muted">
              Dein Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-white/10 px-4 py-3 text-lg text-white placeholder-white/30"
              placeholder="z. B. Sara"
              maxLength={40}
            />
          </Card>

          {/* Rolle */}
          <Card className="space-y-2 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">
              Rolle
            </div>
            <div className="grid grid-cols-2 gap-2">
              <RoleButton
                active={role === 'player'}
                onClick={() => setRole('player')}
                title="Player"
                subtitle="Buzzern, antworten, Fragen wählen"
              />
              <RoleButton
                active={role === 'master'}
                onClick={() => setRole('master')}
                title="Master-Screen"
                subtitle="Nur Anzeige (auf großem TV/Beamer)"
              />
            </div>
          </Card>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            trailing={<ArrowRight className="h-4 w-4" />}
            disabled={!canSubmit}
            className="w-full"
          >
            Los geht&apos;s
          </Button>
        </form>
      </div>
    </ScreenLayout>
  )
}

function IntentCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all',
        active
          ? 'border-brand-purple/60 bg-brand-purple/10 shadow-neon-purple'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          active
            ? 'bg-brand-purple/25 text-brand-purple-soft'
            : 'bg-white/10 text-white/60',
        )}
      >
        {icon}
      </span>
      <div className="flex-1">
        <div className="font-display text-sm font-bold uppercase tracking-wide text-white">
          {title}
        </div>
        <div className="mt-0.5 font-mono text-xs text-white/60">{subtitle}</div>
      </div>
    </button>
  )
}

function RoleButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2 text-left transition-all',
        active
          ? 'border-brand-cyan/60 bg-brand-cyan/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20',
      )}
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-[11px] text-ink-muted">{subtitle}</div>
    </button>
  )
}
