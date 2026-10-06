import { describe, expect, it } from 'vitest'
import { hostLine, rankStandings, splashDurationMs, STANDINGS_MS } from './ModeTransitionSplash'

const t = (id: string, points: number) => ({ id, name: id, colorHex: '#fff', points })

describe('Zwischenstand im Modus-Splash', () => {
  it('Überholen: Sieger des letzten Modus rutscht an der Konkurrenz vorbei', () => {
    // Vorher: A 2, B 1, C 2  →  B gewinnt im Finale doppelt → B 3
    const r = rankStandings([t('A', 2), t('B', 3), t('C', 2)], 'B', 2)
    expect(r.before).toEqual(['A', 'C', 'B'])
    expect(r.after).toEqual(['B', 'A', 'C'])
    expect([...r.overtook]).toEqual(['B'])
  })

  it('Gleichstand bleibt stabil in Eingangsreihenfolge, ohne Sieger kein Platztausch', () => {
    const r = rankStandings([t('A', 1), t('B', 1)], null, 1)
    expect(r.before).toEqual(['A', 'B'])
    expect(r.after).toEqual(['A', 'B'])
    expect(r.overtook.size).toBe(0)
  })

  it('Finale-Moderation nennt doppelte Punkte erst ab 3 Modi', () => {
    expect(hostLine(2, 3, 'Quiz')).toContain('doppelt')
    expect(hostLine(1, 2, 'Quiz')).not.toContain('doppelt')
  })

  it('Dauer: Zwischenstand verlängert nur ab dem zweiten Modus', () => {
    expect(splashDurationMs(true) - splashDurationMs(false)).toBe(STANDINGS_MS)
  })
})
