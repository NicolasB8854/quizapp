/**
 * Spielmodi-Übersicht (#11): erst verstehen, was es gibt — Auswahl der Modi
 * passiert später in der Lobby des Spieleabends.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock, Play } from 'lucide-react'
import { MODES } from '@quizapp/shared'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { modeImage } from '@/lib/modeImage'

export default function ModesPage() {
  const modes = MODES.filter((m) => m.status === 'ready')
  return (
    <ScreenLayout variant="dim" hideNav>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 md:py-8">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="md" leading={<ArrowLeft className="h-4 w-4" />}>
              Start
            </Button>
          </Link>
          <div className="eyebrow">Spielmodi</div>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-white">
            {modes.length} Formate für euren Abend
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Welche Modi ihr spielt, wählt der Host in der Lobby. Gewonnene Modi zählen als Match-Punkt.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {modes.map((m) => (
            <Card key={m.id} className="space-y-2 overflow-hidden p-0">
              <img
                src={modeImage(m.id)}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="space-y-2 p-4 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.28em] text-brand-purple-soft">{m.chipLabel}</span>
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Clock className="h-3.5 w-3.5" /> ~{m.estimatedMinutes} min
                </span>
              </div>
              <h2 className="font-display text-xl font-bold text-white">{m.name}</h2>
              <p className="text-sm font-medium text-white/85">{m.tagline}</p>
              <p className="text-sm text-ink-muted">{m.description}</p>
              {!m.scoresMatchPoint && <p className="text-xs text-ink-faint">Ohne Wertung — zum Aufwärmen.</p>}
              </div>
            </Card>
          ))}
        </div>
        <Link to="/room" className="block">
          <Button variant="primary" size="lg" className="w-full" leading={<Play className="h-4 w-4" />}>
            Spieleabend starten
          </Button>
        </Link>
      </div>
    </ScreenLayout>
  )
}
