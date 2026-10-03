import { describe, it, expect } from 'vitest'
import { buildSoloRun, SOLO_CURVE, soloPointsFor } from './solo'

describe('Solo-Runde', () => {
  it('liefert zehn verschiedene Fragen', () => {
    const run = buildSoloRun(undefined)
    expect(run).toHaveLength(SOLO_CURVE.length)
    expect(new Set(run.map((q) => q.id)).size).toBe(run.length)
  })

  it('folgt ohne Themenfilter exakt der Kurve 1,1,2,2,…,5,5', () => {
    const run = buildSoloRun(undefined)
    expect(run.map((q) => q.difficulty)).toEqual([...SOLO_CURVE])
  })

  it('respektiert die Themenauswahl', () => {
    const run = buildSoloRun(['film', 'musik'])
    expect(run.length).toBeGreaterThan(0)
    for (const q of run) expect(['film', 'musik']).toContain(q.topic)
  })

  it('schließt bereits gespielte Fragen aus', () => {
    const first = buildSoloRun(undefined)
    const second = buildSoloRun(undefined, new Set(first.map((q) => q.id)))
    for (const q of second) expect(first.map((f) => f.id)).not.toContain(q.id)
  })

  it('Punkte = Stufe × 100', () => {
    expect(soloPointsFor(1)).toBe(100)
    expect(soloPointsFor(5)).toBe(500)
  })
})
