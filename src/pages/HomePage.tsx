/**
 * Startseite (mobile first).
 *
 * Zwei Wege, sonst nichts:
 *  - Spieleabend — Multi-Device: jede:r spielt auf dem eigenen Handy,
 *    optional ein großer Master-Screen (TV/Laptop) als Bühne.
 *  - Solo-Runde — eine Person, zehn Fragen gegen die Uhr.
 * Dazu direkt „Raum beitreten" per Code, eine generische Erklärung und die
 * Erklärung Master-Screen vs. ohne.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Play, User, LogIn, Monitor, Smartphone, LayoutGrid, ArrowRight, Crown } from 'lucide-react'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Card } from '@/components/Card'
import { AvatarBadge } from '@/components/AvatarBadge'
import { readMyProfile } from '@/lib/myProfile'
import { readSoloStats } from '@/lib/soloStats'
import { primaryTitle } from '@/lib/titles'
import { cn } from '@/lib/classnames'

export default function HomePage() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const [code, setCode] = useState('')
  const cleanCode = code.trim().toUpperCase()
  const [profile] = useState(() => readMyProfile())
  const [title] = useState(() => primaryTitle(readSoloStats()))

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  const join = (e: FormEvent) => {
    e.preventDefault()
    if (cleanCode.length < 3) return
    navigate(`/room?code=${encodeURIComponent(cleanCode)}`)
  }

  return (
    <ScreenLayout variant="home">
      <div className="mx-auto w-full max-w-xl space-y-6 px-4 pb-12 pt-2 md:max-w-5xl md:pt-8">
        {/* HERO */}
        <section className="relative animate-titleIn">
          {/* Neon-Schriftzug aus dem Designkonzept — nur Desktop, rein dekorativ. */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-2 hidden select-none text-right font-display text-3xl font-black uppercase leading-tight tracking-wide lg:block xl:text-4xl"
          >
            <span className="neon-cyan block -rotate-3">Good Questions.</span>
            <span className="neon-magenta block -rotate-3">Better People.</span>
          </div>
          <h1
            className={cn(
              'font-display font-extrabold uppercase tracking-tight leading-[0.9]',
              'text-4xl sm:text-5xl md:text-7xl',
            )}
          >
            <span className="text-white" style={{ textShadow: '0 0 22px rgba(124,92,255,0.35), 0 12px 40px rgba(0,0,0,0.65)' }}>
              Game Night,
            </span>{' '}
            <span style={{ color: '#B7A2FF', textShadow: '0 0 14px rgba(124,92,255,0.55)' }}>your way.</span>
          </h1>
          <p className="mt-3 max-w-md text-base text-ink" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.75)' }}>
            Quizshow-Formate für euren Abend. Jede:r spielt auf dem eigenen Handy, ohne App.
          </p>
        </section>

        {/* ZWEI WEGE */}
        <section className="grid gap-3 md:grid-cols-2">
          <Link
            to="/room"
            className="group flex items-center gap-4 rounded-2xl bg-cta p-5 text-white shadow-neon-purple transition-all hover:brightness-110"
          >
            <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
              <Play className="h-5 w-5 fill-current" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-bold uppercase tracking-[0.12em]">Spieleabend starten</span>
              <span className="block text-sm text-white/80">Raum eröffnen, Freunde scannen den Code</span>
            </span>
            <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/solo"
            className="group flex items-center gap-4 rounded-2xl border border-white/15 bg-navy-900/70 p-5 text-white backdrop-blur transition-all hover:border-white/30"
          >
            <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-brand-purple/60 bg-brand-purple/20 text-brand-purple-soft">
              <User className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-bold uppercase tracking-[0.12em]">Solo-Runde</span>
              <span className="block text-sm text-ink-muted">10 Fragen allein gegen die Uhr</span>
            </span>
            <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>

        {/* PROFIL */}
        <Link
          to="/profil"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-900/70 p-3 backdrop-blur transition-colors hover:border-white/25"
        >
          <AvatarBadge avatar={profile.avatar} size="lg" name={profile.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-white">
              {profile.name.trim() || 'Profil anlegen'}
            </span>
            <span className="block text-xs text-ink-muted">
              {title ? (
                <span className="inline-flex items-center gap-1 text-amber-200">
                  <Crown className="h-3 w-3" fill="currentColor" aria-hidden /> {title}
                </span>
              ) : (
                'Avatar, Titel & Statistik'
              )}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-ink-muted" />
        </Link>

        {/* RAUM BEITRETEN */}
        <Card className="p-4">
          <form onSubmit={join} className="flex items-center gap-2">
            <label htmlFor="join-code" className="sr-only">
              Room-Code
            </label>
            <input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Code eingeben"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.3em] text-white placeholder:text-base placeholder:font-sans placeholder:tracking-normal placeholder:text-white/40"
            />
            <button
              type="submit"
              disabled={cleanCode.length < 3}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-brand-cyan/50 bg-brand-cyan/15 px-4 font-semibold text-brand-cyan-soft transition-colors hover:bg-brand-cyan/25 disabled:opacity-40"
            >
              <LogIn className="h-4 w-4" />
              Beitreten
            </button>
          </form>
        </Card>

        {/* SO FUNKTIONIERT'S */}
        <section id="so-gehts" className="scroll-mt-6">
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">So funktioniert&apos;s</h2>
            <ol className="space-y-3">
              {[
                ['Raum eröffnen', 'Eine Person startet den Spieleabend und bekommt einen Code samt QR-Code.'],
                ['Alle treten bei', 'Jede:r öffnet die Seite auf dem Handy, gibt den Code ein und wählt Name, Avatar und Interessen.'],
                ['Teams & Modi', 'Teams werden ausgelost oder eingeteilt, der Host wählt die Spielmodi für den Abend.'],
                ['Spielen', 'Fragen, Buzzer und Antworten laufen auf euren Handys. Wer einen Modus gewinnt, holt einen Match-Punkt.'],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-purple/25 font-mono text-sm font-bold text-brand-purple-soft">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{title}</span>
                    <span className="block text-sm text-ink-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link
              to="/modi"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-cyan-soft hover:text-brand-cyan"
            >
              <LayoutGrid className="h-4 w-4" />
              Alle Spielmodi ansehen
            </Link>
          </Card>
        </section>

        {/* MASTER-SCREEN VS. OHNE */}
        <section className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-2 p-5">
            <div className="flex items-center gap-2 text-brand-cyan-soft">
              <Smartphone className="h-5 w-5" />
              <h3 className="font-display font-bold uppercase tracking-wide">Ohne Master-Screen</h3>
            </div>
            <p className="text-sm text-ink-muted">
              Nur Handys. Frage und Antworten erscheinen bei allen, wer dran ist, tippt. Der Host spielt mit
              und steuert über eine kleine Leiste (weiter, auflösen).
            </p>
            <p className="text-xs text-ink-faint">Ideal unterwegs oder in kleiner Runde.</p>
          </Card>
          <Card className="space-y-2 p-5">
            <div className="flex items-center gap-2 text-brand-purple-soft">
              <Monitor className="h-5 w-5" />
              <h3 className="font-display font-bold uppercase tracking-wide">Mit Master-Screen</h3>
            </div>
            <p className="text-sm text-ink-muted">
              Ein TV oder Laptop wird zur Bühne: große Frage, Timer und Punktestand für alle. Die Handys sind
              Buzzer und Antwort-Controller. Beim Raum-Eröffnen „Nur Bühne“ wählen.
            </p>
            <p className="text-xs text-ink-faint">Ideal fürs Wohnzimmer — echtes Quizshow-Gefühl.</p>
          </Card>
        </section>
      </div>
    </ScreenLayout>
  )
}
