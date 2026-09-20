import { describe, it, expect } from 'vitest'
import { shuffleWithMapping } from './shuffle'

describe('shuffleWithMapping', () => {
  const items = ['A', 'B', 'C', 'D']

  describe('mit Seed (deterministisch)', () => {
    it('liefert bei gleichem Seed exakt die gleiche Reihenfolge', () => {
      const a = shuffleWithMapping(items, 'seed-1')
      const b = shuffleWithMapping(items, 'seed-1')
      expect(b.shuffled).toEqual(a.shuffled)
    })

    it('liefert bei unterschiedlichen Seeds mindestens irgendwann eine andere Reihenfolge', () => {
      // FNV-1a + Mulberry32 sind gut gleichverteilt. Bei 4 Elementen gibt es 24
      // Permutationen — wir prüfen 10 Seeds und erwarten mindestens zwei verschiedene.
      const seen = new Set<string>()
      for (let i = 0; i < 10; i++) {
        seen.add(shuffleWithMapping(items, `s${i}`).shuffled.join(''))
      }
      expect(seen.size).toBeGreaterThan(1)
    })

    it('enthält alle ursprünglichen Elemente genau einmal', () => {
      const { shuffled } = shuffleWithMapping(items, 'perm-check')
      expect(shuffled).toHaveLength(items.length)
      expect(shuffled.slice().sort()).toEqual(items.slice().sort())
    })
  })

  describe('Mapping-Funktionen', () => {
    it('originalIndexOf und renderedIndexOf sind zueinander invers', () => {
      const { originalIndexOf, renderedIndexOf } = shuffleWithMapping(items, 'inverse')
      for (let i = 0; i < items.length; i++) {
        expect(renderedIndexOf(originalIndexOf(i))).toBe(i)
        expect(originalIndexOf(renderedIndexOf(i))).toBe(i)
      }
    })

    it('originalIndexOf zeigt den echten Ursprung des gerenderten Slots', () => {
      const { shuffled, originalIndexOf } = shuffleWithMapping(items, 'origin')
      for (let renderedIdx = 0; renderedIdx < shuffled.length; renderedIdx++) {
        const originalIdx = originalIndexOf(renderedIdx)
        expect(shuffled[renderedIdx]).toBe(items[originalIdx])
      }
    })
  })

  describe('Edge-Cases', () => {
    it('leerer Input liefert leeren Output', () => {
      const { shuffled } = shuffleWithMapping<number>([], 'seed')
      expect(shuffled).toEqual([])
    })

    it('einzelnes Element wird unverändert zurückgegeben', () => {
      const { shuffled, originalIndexOf, renderedIndexOf } = shuffleWithMapping(['only'], 'seed')
      expect(shuffled).toEqual(['only'])
      expect(originalIndexOf(0)).toBe(0)
      expect(renderedIndexOf(0)).toBe(0)
    })
  })
})
