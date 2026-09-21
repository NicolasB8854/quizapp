/**
 * Startseite — Foto-Ambient + Show-Layout wie im PDF-Mockup „Startseite / Spielauswahl".
 *
 * Aufbau:
 *  - Wohnzimmer-Foto als Vollbild-Hintergrund (aus ScreenLayout `variant="home"`).
 *  - TopNav (Wortmarke + Nav-Links + „Gemeinsam schlauer"-Chip).
 *  - Hero: Micro-Label + gigantische Uppercase-Headline + Sub-Text + zwei Show-CTAs +
 *    Micro-Info-Zeile — alles linksbündig, sodass die rechte Bildhälfte (Personen, Pflanzen,
 *    Neonlicht) frei bleibt und die Wohnzimmer-Atmosphäre durchkommt.
 *  - Modus-Streifen darunter mit den vier Featured-Cards.
 */

import { Link } from 'react-router-dom'
import { Play, LogIn, Users, Wifi, Sparkles, Info, Settings } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { ModeCard } from '@/components/ModeCard'
import { MODES } from '@quizapp/shared'
import { cn } from '@/lib/classnames'

export default function HomePage() {
  const featured = MODES.slice(0, 4)

  return (
    <ScreenLayout
      variant="home"
      navActions={
        <>
          <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/60 backdrop-blur px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-ink-muted">
            <Users className="h-3.5 w-3.5 text-brand-cyan-soft" />
            Gemeinsam schlauer
          </span>
          <button
            aria-label="Einstellungen"
            className="h-9 w-9 rounded-full border border-white/10 bg-navy-800/60 backdrop-blur flex items-center justify-center text-ink-muted hover:text-ink hover:border-white/25 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="mx-auto max-w-7xl">
        {/* HERO */}
        <section className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-6 items-center pt-4 md:pt-8 pb-6 md:pb-10 animate-titleIn">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-brand-purple-soft">
              <span
                aria-hidden
                className="h-1.5 w-6 rounded-full bg-brand-purple shadow-[0_0_12px_rgba(124,92,255,0.95)]"
              />
              Wissen verbindet
            </span>

            <h1
              className={cn(
                'mt-4 font-display font-extrabold uppercase tracking-tight',
                'text-5xl sm:text-6xl md:text-[4.5rem] lg:text-[5rem] xl:text-[5.5rem]',
                'leading-[0.88]',
              )}
            >
              <span
                className="text-white"
                style={{
                  textShadow:
                    '0 0 22px rgba(124,92,255,0.35), 0 12px 40px rgba(0,0,0,0.65)',
                }}
              >
                Game Night,
              </span>
              <br />
              <span
                style={{
                  color: '#B7A2FF',
                  textShadow:
                    '0 0 14px rgba(124,92,255,0.55), 0 0 42px rgba(124,92,255,0.35)',
                }}
              >
                your way.
              </span>
            </h1>

            <p
              className="mt-5 max-w-md text-base md:text-lg text-ink leading-relaxed"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.75)' }}
            >
              Legendäre Quizshow-Formate. Unvergessliche Abende.
              <br />
              <span
                style={{
                  color: '#B7A2FF',
                  textShadow: '0 0 12px rgba(124,92,255,0.35)',
                }}
              >
                Bei dir zu Hause.
              </span>
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/setup?flow=night"
                className="group inline-flex items-center gap-3 h-12 pl-2 pr-6 rounded-full bg-cta font-display font-bold tracking-[0.22em] uppercase text-sm text-white shadow-neon-purple hover:brightness-110 transition-all"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 group-hover:bg-white/25 transition-colors">
                  <Play className="h-3.5 w-3.5 fill-current" />
                </span>
                Spielabend starten
              </Link>
              <Link
                to="/setup?flow=free"
                className="group inline-flex items-center gap-3 h-12 pl-2 pr-5 rounded-full border border-white/20 bg-navy-900/60 backdrop-blur font-display font-bold tracking-[0.22em] uppercase text-sm text-brand-purple-soft hover:border-white/35 hover:bg-navy-800/70 transition-all"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-purple/60 bg-brand-purple/20 text-brand-purple-soft">
                  <LogIn className="h-3.5 w-3.5" />
                </span>
                Freie Runde
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              <Info className="h-3.5 w-3.5" />
              <span className="inline-flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                2–8 Spieler
              </span>
              <span className="text-ink-faint">·</span>
              <span className="inline-flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5" />
                keine App
              </span>
              <span className="text-ink-faint">·</span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                direkt im Browser
              </span>
            </div>
          </div>

          {/* Rechte Spalte ist bewusst leer — hier atmet das Wohnzimmer-Foto durch. */}
          <div aria-hidden />
        </section>

        {/* MODI-STREIFEN — auf einer eigenen dunklen „Bühne" damit das Foto den Text-Bereich nicht überlagert */}
        <section className="relative z-10 pt-2 pb-8 md:pb-12">
          <div
            className="rounded-3xl border border-white/[0.08] p-4 md:p-6"
            style={{
              background:
                'linear-gradient(180deg, rgba(11,16,32,0.85) 0%, rgba(4,6,15,0.9) 100%)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="eyebrow">Unsere Spielmodi</div>
                <h2 className="mt-1 font-display font-bold uppercase tracking-tight text-lg md:text-xl">
                  Von klassisch bis überraschend
                </h2>
              </div>
              <Link
                to="/setup?flow=night"
                className="text-[11px] uppercase tracking-[0.22em] text-brand-cyan-soft hover:text-brand-cyan transition-colors whitespace-nowrap"
              >
                Alle Modi ansehen →
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {featured.map((mode) => (
                <ModeCard
                  key={mode.id}
                  mode={mode}
                  selected={false}
                  onToggle={() => { /* Vorschau — Auswahl im Setup */ }}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </ScreenLayout>
  )
}
