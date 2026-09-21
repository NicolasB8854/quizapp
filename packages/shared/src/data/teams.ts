/**
 * Team-Katalog und Farb-Palette.
 *
 * Bis zu vier Teams pro Runde (konzept-v2.md, Kapitel 4). Jedes Team bekommt
 * eine feste Farbe aus der Design-Palette — konsistent mit dem Neon-Look der
 * App und den Modus-Akzenten.
 *
 * `getTeamColorHex` ist der zentrale Farb-Lookup — er ersetzt die vielen
 * inline `color === 'purple' ? '#7C5CFF' : '#27D8FF'`-Checks im UI-Code.
 */

import type { Team, TeamColor } from '../types/round'

export const MIN_TEAMS = 2
export const MAX_TEAMS = 4

/** Hex-Werte parallel zu `tailwind.config.js` / Design-Palette. */
export const TEAM_COLOR_HEX: Record<TeamColor, string> = {
  purple: '#7C5CFF',
  cyan:   '#27D8FF',
  orange: '#FF6E5C',
  pink:   '#FF3D8B',
}

/** Feste Farb-Reihenfolge — das i-te Team bekommt `TEAM_COLOR_ORDER[i]`. */
export const TEAM_COLOR_ORDER: readonly TeamColor[] = ['purple', 'cyan', 'orange', 'pink']

/** Show-Namen für die vier Team-Slots — beibehaltbare Marken-Vibes. */
export const DEFAULT_TEAM_NAMES: readonly string[] = [
  'Team Nova',
  'Team Pulsar',
  'Team Solaris',
  'Team Nebula',
]

/** Zentraler Farb-Lookup — nutzt die Palette und ist typ-sicher. */
export function getTeamColorHex(color: TeamColor): string {
  return TEAM_COLOR_HEX[color]
}

/**
 * Häufig genutzte CSS-Klassen und Werte pro Team-Farbe, gebündelt für einen
 * Aufruf. Ersetzt die vielen inline-Ternäre `color === 'purple' ? 'text-brand-…' : …`.
 *
 * Warum als konstante Map und nicht als Template-String? Tailwind purge kann keine
 * dynamisch zusammengesetzten Klassen erkennen — hier steht jede Klasse als
 * vollständiges Literal, das der JIT-Compiler findet.
 */
export interface TeamColorTokens {
  hex: string
  /** Neon-Text-Class für Show-Momente (Runden-Header, Frage-Titel). */
  neonText: string
  /** Neon-Shadow für Buttons/Frames (Room-Code-Kachel etc.). */
  neonShadow: string
  /** Dezenter Glow für Fokus/Auswahl. */
  glowShadow: string
  /** Chip-Style (klein, gefüllt) — Initialen-Kreis, Pillen. */
  chip: string
  /** Kräftiger Chip mit Border — Avatar-Umrandungen, Team-Anzeiger. */
  chipStrong: string
  /** Softe Text-Farbe für Team-Labels. */
  softText: string
  /** Der Card-glow-Wert (siehe Card.tsx). */
  cardGlow: 'purple' | 'cyan' | 'orange' | 'pink'
  /** Der Badge-tone-Wert (siehe Badge.tsx). */
  badgeTone: 'purple' | 'cyan' | 'orange' | 'pink'
  /** Menschlich lesbares Farb-Label — Setup: „Team · Purple". */
  label: string
}

const TOKENS: Record<TeamColor, TeamColorTokens> = {
  purple: {
    hex: TEAM_COLOR_HEX.purple,
    neonText: 'text-neon-purple',
    neonShadow: 'shadow-neon-purple',
    glowShadow: 'shadow-glow-purple',
    chip: 'bg-brand-purple/25 text-brand-purple-soft',
    chipStrong: 'text-brand-purple-soft border-brand-purple/60 bg-brand-purple/15',
    softText: 'text-brand-purple-soft',
    cardGlow: 'purple',
    badgeTone: 'purple',
    label: 'Purple',
  },
  cyan: {
    hex: TEAM_COLOR_HEX.cyan,
    neonText: 'text-neon-cyan',
    neonShadow: 'shadow-neon-cyan',
    glowShadow: 'shadow-glow-cyan',
    chip: 'bg-brand-cyan/25 text-brand-cyan-soft',
    chipStrong: 'text-brand-cyan-soft border-brand-cyan/60 bg-brand-cyan/15',
    softText: 'text-brand-cyan-soft',
    cardGlow: 'cyan',
    badgeTone: 'cyan',
    label: 'Cyan',
  },
  orange: {
    hex: TEAM_COLOR_HEX.orange,
    neonText: 'text-neon-orange',
    neonShadow: 'shadow-neon-orange',
    glowShadow: 'shadow-glow-orange',
    chip: 'bg-brand-orange/25 text-brand-orange-soft',
    chipStrong: 'text-brand-orange-soft border-brand-orange/60 bg-brand-orange/15',
    softText: 'text-brand-orange-soft',
    cardGlow: 'orange',
    badgeTone: 'orange',
    label: 'Orange',
  },
  pink: {
    hex: TEAM_COLOR_HEX.pink,
    neonText: 'text-neon-pink',
    neonShadow: 'shadow-neon-pink',
    glowShadow: 'shadow-glow-pink',
    chip: 'bg-brand-pink/25 text-brand-pink-soft',
    chipStrong: 'text-brand-pink-soft border-brand-pink/60 bg-brand-pink/15',
    softText: 'text-brand-pink-soft',
    cardGlow: 'pink',
    badgeTone: 'pink',
    label: 'Pink',
  },
}

/** Bundled color tokens für eine Team-Farbe. */
export function getTeamColorTokens(color: TeamColor): TeamColorTokens {
  return TOKENS[color]
}

/** Erzeugt einen Default-Team-Slot für Position `i` (0-basiert, 0..3). */
export function makeDefaultTeam(index: number): Team {
  const clamped = Math.min(Math.max(0, index), TEAM_COLOR_ORDER.length - 1)
  return {
    id: `team-${String.fromCharCode('a'.charCodeAt(0) + clamped)}`,
    name: DEFAULT_TEAM_NAMES[clamped] ?? `Team ${clamped + 1}`,
    color: TEAM_COLOR_ORDER[clamped],
  }
}

/**
 * Rotations-Helper: liefert die ID des nächsten Teams nach `primaryTeamId`.
 * Wird von Steal-Modi genutzt (Heimspiel, Punktejagd, Fachrunde). Bei 2 Teams
 * ist das automatisch das eine Gegenteam; bei 3+ rotiert es deterministisch.
 */
export function getNextTeamId(
  teams: readonly Team[],
  primaryTeamId: string,
): string | null {
  if (teams.length === 0) return null
  const idx = teams.findIndex((t) => t.id === primaryTeamId)
  if (idx < 0) return null
  const nextIdx = (idx + 1) % teams.length
  return teams[nextIdx].id
}
