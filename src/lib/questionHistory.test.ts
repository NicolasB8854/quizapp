import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clearQuestionHistory,
  markQuestionsAsked,
  readAskedQuestionIds,
} from './questionHistory'

describe('questionHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('liefert einen leeren Set, wenn nichts gespeichert ist', () => {
    expect(readAskedQuestionIds().size).toBe(0)
  })

  it('markiert IDs und liest sie danach zurück', () => {
    markQuestionsAsked(['q1', 'q2', 'q3'])
    const ids = readAskedQuestionIds()
    expect(ids.size).toBe(3)
    expect(ids.has('q1')).toBe(true)
    expect(ids.has('q2')).toBe(true)
    expect(ids.has('q3')).toBe(true)
  })

  it('ist idempotent: doppelt markierte IDs erscheinen nur einmal', () => {
    markQuestionsAsked(['q1', 'q2'])
    markQuestionsAsked(['q2', 'q3'])
    const ids = readAskedQuestionIds()
    expect(ids.size).toBe(3)
  })

  it('markQuestionsAsked([]) ändert den State nicht', () => {
    markQuestionsAsked(['q1'])
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    markQuestionsAsked([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('clearQuestionHistory leert die Historie vollständig', () => {
    markQuestionsAsked(['q1', 'q2'])
    clearQuestionHistory()
    expect(readAskedQuestionIds().size).toBe(0)
  })

  it('toleriert kaputte Daten im localStorage', () => {
    // Nicht-JSON, aber vorhandenes Item → readAskedQuestionIds gibt leeren Set,
    // ohne dass die App abstürzt.
    localStorage.setItem('quizapp:questionHistory', 'not-json')
    expect(readAskedQuestionIds().size).toBe(0)
  })

  it('toleriert JSON, das kein Array ist', () => {
    localStorage.setItem('quizapp:questionHistory', '{"foo":"bar"}')
    expect(readAskedQuestionIds().size).toBe(0)
  })

  it('filtert Nicht-String-Einträge aus dem Array', () => {
    localStorage.setItem('quizapp:questionHistory', JSON.stringify(['q1', 42, null, 'q2']))
    const ids = readAskedQuestionIds()
    expect(ids.size).toBe(2)
    expect(ids.has('q1')).toBe(true)
    expect(ids.has('q2')).toBe(true)
  })

  it('setItem-Fehler beim Schreiben crashen die App nicht', () => {
    const errorSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(() => markQuestionsAsked(['q1'])).not.toThrow()
    expect(errorSpy).toHaveBeenCalled()
  })
})
