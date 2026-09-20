/**
 * Obere Navigationsleiste — Wortmarke links, Menu-Links zentriert/rechts, ein „Actions"-Slot.
 *
 * Nachempfunden dem PDF-Mockup: schlank, ohne Container-Kanten, minimaler Ausdruck. Die
 * Menu-Links sind im Prototyp Fake-Anker (führen zurück auf `/`), aber optisch anwesend
 * damit die Startseite komplett wirkt.
 */

import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/classnames'
import { BrandLogo } from './BrandLogo'

interface Props {
  actions?: ReactNode
}

const NAV_ITEMS = [
  { label: 'Start',            to: '/' },
  { label: 'Spielmodi',        to: '/setup?flow=night' },
  { label: 'So funktioniert\u2019s', to: '/' },
  { label: 'Über uns',         to: '/' },
]

export function TopNav({ actions }: Props) {
  const { pathname } = useLocation()
  return (
    <div className="relative z-20 px-6 md:px-10 pt-5 md:pt-6 flex items-center justify-between gap-6">
      <Link to="/" className="focus-visible:outline-none">
        <BrandLogo size="md" />
      </Link>

      <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-navy-800/60 backdrop-blur px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.to && item.to !== '/'
          return (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs uppercase tracking-[0.22em] font-semibold transition-colors',
                isActive
                  ? 'bg-brand-purple/25 text-white'
                  : 'text-ink-muted hover:text-ink hover:bg-white/5',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-2 md:gap-3">{actions}</div>
    </div>
  )
}
