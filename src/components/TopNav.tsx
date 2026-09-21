/**
 * Obere Navigationsleiste — Wortmarke links, Menu-Links zentriert, `actions`-Slot
 * plus globales Settings-Zahnrad ganz rechts.
 *
 * Das Zahnrad-Menü ist der zentrale Zugang zu Prototyp-Tools, die nicht Teil des
 * Spielflusses sind — aktuell nur „Fragen-Review", später Themen für DB-Migration,
 * KI-Assistent etc.
 */

import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Settings, BookOpenCheck } from 'lucide-react'
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

      <div className="flex items-center gap-2 md:gap-3">
        {actions}
        <SettingsMenu />
      </div>
    </div>
  )
}

/**
 * Zahnrad-Dropdown mit globalen Prototyp-Tools.
 *
 * Schließt sich bei Click-Outside oder Escape. Positionierung absolut unter dem
 * Trigger — mobile OK, da klein genug.
 */
function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Einstellungen und Prototyp-Tools"
        aria-expanded={open}
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-full',
          'border border-white/10 bg-navy-800/60 text-ink-muted',
          'hover:text-ink hover:border-white/30 transition-colors',
          open && 'text-ink border-brand-purple/60 bg-brand-purple/15',
        )}
      >
        <Settings className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-full mt-2 z-30 w-64',
            'rounded-card border border-white/10 bg-navy-800/95 backdrop-blur',
            'shadow-neon-purple p-2',
          )}
        >
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Prototyp-Tools
          </div>
          <MenuLink
            to="/review"
            icon={<BookOpenCheck className="h-4 w-4" />}
            label="Fragen-Review"
            hint="Katalog durchsuchen und prüfen"
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

interface MenuLinkProps {
  to: string
  icon: ReactNode
  label: string
  hint?: string
  onNavigate: () => void
}

function MenuLink({ to, icon, label, hint, onNavigate }: MenuLinkProps) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.06] transition-colors"
    >
      <span className="shrink-0 mt-0.5 text-brand-purple-soft">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold text-sm text-ink">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[11px] text-ink-muted leading-snug">
            {hint}
          </span>
        )}
      </span>
    </Link>
  )
}
