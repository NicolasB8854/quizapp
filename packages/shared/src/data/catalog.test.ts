/**
 * Katalog-Validator: sichert die Qualitäts- und Verteilungsregeln aus
 * docs/content/difficulty-rubric.md dauerhaft ab. Schlägt ein neuer Import
 * fehl, ist das Absicht — erst Rubrik erfüllen, dann committen.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import questions from './questions.json'
import { TOPICS } from './topics'
import type { Question } from '../types/question'

const all = questions as unknown as Question[]
const MIN_PER_LEVEL = 4

describe('Fragenkatalog', () => {
  it('hat eindeutige IDs', () => {
    const ids = all.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('jede Frage hat eine Erklärung', () => {
    const missing = all.filter((q) => !(q.explanation ?? '').trim()).map((q) => q.id)
    expect(missing).toEqual([])
  })

  it('jede Frage hat Schwierigkeit 1-5 und ein bekanntes Topic', () => {
    const topicIds = new Set(TOPICS.map((t) => t.id))
    const bad = all.filter((q) => ![1, 2, 3, 4, 5].includes(q.difficulty as number) || !topicIds.has(q.topic))
    expect(bad.map((q) => q.id)).toEqual([])
  })

  it('Multiple Choice: 4 verschiedene Optionen und gültiger Index', () => {
    const bad = all.filter(
      (q) =>
        q.type === 'multiple-choice' &&
        (q.options.length !== 4 || new Set(q.options).size !== 4 || q.correctIndex < 0 || q.correctIndex > 3),
    )
    expect(bad.map((q) => q.id)).toEqual([])
  })

  it(`jedes Topic hat mindestens ${MIN_PER_LEVEL} Multiple-Choice-Fragen pro Stufe`, () => {
    const gaps: string[] = []
    for (const t of TOPICS) {
      for (const d of [1, 2, 3, 4, 5]) {
        const n = all.filter((q) => q.type === 'multiple-choice' && !q.image && q.topic === t.id && q.difficulty === d).length
        if (n < MIN_PER_LEVEL) gaps.push(`${t.id}:${d}=${n}`)
      }
    }
    expect(gaps).toEqual([])
  })

  it('Bilderrätsel: jede Bild-Frage hat ein Bild in public/ und läuft nur dort', () => {
    const pics = all.filter((q) => q.type === 'multiple-choice' && q.image)
    expect(pics.length).toBeGreaterThanOrEqual(12)
    for (const q of pics) {
      if (q.type !== 'multiple-choice') continue
      expect(existsSync(resolve(__dirname, '../../../../public', q.image!.slice(1)))).toBe(true)
      expect(q.compatibleModes).toEqual(['blindguess'])
    }
  })

  it('genug Wahr/Falsch- und Klick!-Inhalte für mehrere Abende', () => {
    expect(all.filter((q) => q.type === 'true-false').length).toBeGreaterThanOrEqual(200)
    expect(all.filter((q) => q.type === 'warmup-riddle').length).toBeGreaterThanOrEqual(50)
  })
})
