import { describe, it, expect } from 'vitest'

import {
  DEFAULT_TEAM_NAMES,
  MAX_TEAMS,
  MIN_TEAMS,
  TEAM_COLOR_HEX,
  TEAM_COLOR_ORDER,
  getNextTeamId,
  getTeamColorHex,
  getTeamColorTokens,
  makeDefaultTeam,
} from './teams'
import type { Team, TeamColor } from '../types/round'

/**
 * Unit-Tests für die Team-Palette und Rotations-Helpers (Session R).
 * Wichtig: die Steal-Rotation ist der Kern der Multi-Team-Fairness — bei einer
 * Regression würden alle Steal-Modi in falsche Teams laufen.
 */

describe('teams — Konstanten und Palette', () => {
  it('exportiert MIN/MAX konsistent mit konzept-v2.md (2–4 Teams)', () => {
    expect(MIN_TEAMS).toBe(2)
    expect(MAX_TEAMS).toBe(4)
  })

  it('hat für jede TeamColor einen Hex-Wert', () => {
    const expected: TeamColor[] = ['purple', 'cyan', 'orange', 'pink']
    for (const c of expected) {
      expect(TEAM_COLOR_HEX[c]).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('hat TEAM_COLOR_ORDER genau 4 Elemente, alle einzigartig', () => {
    expect(TEAM_COLOR_ORDER).toHaveLength(4)
    expect(new Set(TEAM_COLOR_ORDER).size).toBe(4)
  })

  it('DEFAULT_TEAM_NAMES hat mindestens 4 Show-Namen', () => {
    expect(DEFAULT_TEAM_NAMES.length).toBeGreaterThanOrEqual(4)
    for (const n of DEFAULT_TEAM_NAMES) {
      expect(n).toMatch(/^Team /)
    }
  })
})

describe('makeDefaultTeam', () => {
  it('erzeugt Slot 0..3 mit den erwarteten Farben und Namen', () => {
    for (let i = 0; i < 4; i++) {
      const team = makeDefaultTeam(i)
      expect(team.color).toBe(TEAM_COLOR_ORDER[i])
      expect(team.name).toBe(DEFAULT_TEAM_NAMES[i])
      expect(team.id).toBe(`team-${String.fromCharCode(97 + i)}`)
    }
  })

  it('klammert negativen Index auf 0', () => {
    const team = makeDefaultTeam(-1)
    expect(team.color).toBe('purple')
    expect(team.id).toBe('team-a')
  })

  it('klammert Overshoot auf letzten Slot', () => {
    const team = makeDefaultTeam(99)
    expect(team.color).toBe('pink')
    expect(team.id).toBe('team-d')
  })
})

describe('getTeamColorHex', () => {
  it('gibt den Hex-Code für jede Farbe zurück', () => {
    expect(getTeamColorHex('purple')).toBe('#7C5CFF')
    expect(getTeamColorHex('cyan')).toBe('#27D8FF')
    expect(getTeamColorHex('orange')).toBe('#FF6E5C')
    expect(getTeamColorHex('pink')).toBe('#FF3D8B')
  })
})

describe('getTeamColorTokens', () => {
  it('liefert konsistente Tokens für alle 4 Farben', () => {
    for (const color of TEAM_COLOR_ORDER) {
      const tokens = getTeamColorTokens(color)
      expect(tokens.hex).toBe(TEAM_COLOR_HEX[color])
      expect(tokens.cardGlow).toBe(color)
      expect(tokens.badgeTone).toBe(color)
      expect(tokens.neonText).toBe(`text-neon-${color}`)
      expect(tokens.neonShadow).toBe(`shadow-neon-${color}`)
      expect(tokens.glowShadow).toBe(`shadow-glow-${color}`)
      // Label ist die Titelform der Farbe.
      expect(tokens.label.toLowerCase()).toBe(color)
    }
  })
})

describe('getNextTeamId — Steal-Rotation', () => {
  function makeTeams(colors: TeamColor[]): Team[] {
    return colors.map((color, i) => ({
      id: `team-${String.fromCharCode(97 + i)}`,
      name: `Team ${i}`,
      color,
    }))
  }

  it('gibt bei 2 Teams das andere Team zurück (klassisches Verhalten)', () => {
    const teams = makeTeams(['purple', 'cyan'])
    expect(getNextTeamId(teams, 'team-a')).toBe('team-b')
    expect(getNextTeamId(teams, 'team-b')).toBe('team-a')
  })

  it('rotiert bei 3 Teams zyklisch: A→B, B→C, C→A', () => {
    const teams = makeTeams(['purple', 'cyan', 'orange'])
    expect(getNextTeamId(teams, 'team-a')).toBe('team-b')
    expect(getNextTeamId(teams, 'team-b')).toBe('team-c')
    expect(getNextTeamId(teams, 'team-c')).toBe('team-a')
  })

  it('rotiert bei 4 Teams zyklisch: A→B, B→C, C→D, D→A', () => {
    const teams = makeTeams(['purple', 'cyan', 'orange', 'pink'])
    expect(getNextTeamId(teams, 'team-a')).toBe('team-b')
    expect(getNextTeamId(teams, 'team-b')).toBe('team-c')
    expect(getNextTeamId(teams, 'team-c')).toBe('team-d')
    expect(getNextTeamId(teams, 'team-d')).toBe('team-a')
  })

  it('gibt null zurück, wenn Team nicht gefunden wird', () => {
    const teams = makeTeams(['purple', 'cyan'])
    expect(getNextTeamId(teams, 'nonexistent')).toBeNull()
  })

  it('gibt null zurück, wenn Teams leer ist', () => {
    expect(getNextTeamId([], 'team-a')).toBeNull()
  })
})
