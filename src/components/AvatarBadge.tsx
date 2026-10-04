/**
 * AvatarBadge — rendert die Spieler-Identität (Session T).
 *
 * Zustände (Vorrang von oben nach unten):
 *  - Foto vorhanden → runder <img> mit farbigem Ring (Team-Farbe oder
 *    Avatar-Farbe als Fallback). Look wie das Mockup: prominenter Portrait-
 *    Kreis, subtiler Glow bei größeren Sizes.
 *  - Figur aus dem Avatar-Baukasten (`avatar.look`) → SVG-Brustbild.
 *  - Sonst → farbiger Kreis mit Emoji bzw. Namens-Initiale. Ohne Namen wird ein
 *    generisches Person-Icon gezeigt.
 *
 * Die Farbe wirkt weiter — auch beim Foto als Ring-Farbe (`avatar.colorHex`),
 * plus optional ein zusätzlicher Team-Ring (`teamHex`).
 */

import { User } from 'lucide-react'
import type { Avatar } from '@quizapp/shared'
import { cn } from '@/lib/classnames'
import { AvatarFigure } from '@/components/avatar/AvatarFigure'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  avatar: Avatar
  size?: Size
  /** Ring in Team-Farbe; ohne Prop nutzen wir avatar.colorHex. */
  teamHex?: string
  /** Namens-Initiale für den No-Photo-Fallback (erste 1–2 Buchstaben). */
  name?: string
  className?: string
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 md:h-16 md:w-16 text-lg md:text-xl',
  xl: 'h-20 w-20 md:h-24 md:w-24 text-2xl md:text-3xl',
}

const ICON_SIZE: Record<Size, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
  xl: 'h-10 w-10',
}

export function AvatarBadge({
  avatar,
  size = 'md',
  teamHex,
  name,
  className,
}: Props) {
  const ringHex = teamHex ?? avatar.colorHex
  const isLarge = size === 'lg' || size === 'xl'
  const shadow = isLarge
    ? `0 0 0 1px ${ringHex}55, 0 0 22px -6px ${avatar.colorHex}CC`
    : `0 0 0 1px ${ringHex}40`

  // Foto: als <img> im runden Container.
  if (avatar.photoDataUrl) {
    return (
      <span
        role="img"
        aria-label={name ? `Portrait von ${name}` : 'Portrait'}
        className={cn(
          'inline-block rounded-full overflow-hidden border-2 select-none',
          SIZE_CLASSES[size],
          className,
        )}
        style={{
          borderColor: `${ringHex}CC`,
          boxShadow: shadow,
        }}
      >
        <img
          src={avatar.photoDataUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </span>
    )
  }

  // Gebaute Figur: SVG füllt den Kreis; klein auf das Gesicht gezoomt.
  if (avatar.look) {
    return (
      <span
        role="img"
        aria-label={name ? `Avatar von ${name}` : 'Avatar'}
        className={cn(
          'inline-block rounded-full overflow-hidden border-2 select-none bg-navy-800',
          SIZE_CLASSES[size],
          className,
        )}
        style={{ borderColor: `${ringHex}CC`, boxShadow: shadow }}
      >
        <AvatarFigure
          look={avatar.look}
          accentHex={avatar.colorHex}
          crop={isLarge ? 'bust' : 'face'}
          className="h-full w-full"
        />
      </span>
    )
  }

  // Kein Foto → Initiale oder Person-Icon.
  const initials = getInitials(name)
  return (
    <span
      role="img"
      aria-label={name ? `Avatar von ${name}` : 'Avatar ohne Foto'}
      className={cn(
        'inline-flex items-center justify-center rounded-full border-2 leading-none font-display font-bold',
        'select-none',
        SIZE_CLASSES[size],
        className,
      )}
      style={{
        borderColor: `${ringHex}CC`,
        background: `${avatar.colorHex}33`,
        color: '#F5F7FF',
        boxShadow: shadow,
      }}
    >
      {avatar.emoji ? (
        <span aria-hidden className="font-sans">{avatar.emoji}</span>
      ) : initials ? (
        <span aria-hidden>{initials}</span>
      ) : (
        <User className={cn(ICON_SIZE[size], 'text-ink/70')} aria-hidden />
      )}
    </span>
  )
}

/** Erste 1–2 Buchstaben des Namens, oder null wenn leer. */
function getInitials(name: string | undefined): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
