import { describe, it, expect } from 'vitest'
import { createWorld } from '../ecs/world'
import { rngNext, rngFloat, rngRange } from '../rng'

describe('Seeded PRNG (xorshift128)', () => {
  it('same seed produces identical sequence', () => {
    const w1 = createWorld(999)
    const w2 = createWorld(999)
    const seq1 = Array.from({ length: 1000 }, () => rngNext(w1))
    const seq2 = Array.from({ length: 1000 }, () => rngNext(w2))
    expect(seq1).toEqual(seq2)
  })

  it('different seeds produce different sequences', () => {
    const w1 = createWorld(1)
    const w2 = createWorld(2)
    const seq1 = Array.from({ length: 100 }, () => rngNext(w1))
    const seq2 = Array.from({ length: 100 }, () => rngNext(w2))
    expect(seq1).not.toEqual(seq2)
  })

  it('rngFloat returns values in [0, 1)', () => {
    const w = createWorld(42)
    for (let i = 0; i < 1000; i++) {
      const v = rngFloat(w)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('rngRange returns values in [min, max)', () => {
    const w = createWorld(42)
    for (let i = 0; i < 1000; i++) {
      const v = rngRange(w, 5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThan(10)
    }
  })

  it('no degenerate output (not all zeros)', () => {
    const w = createWorld(0)
    const seq = Array.from({ length: 100 }, () => rngNext(w))
    const nonZero = seq.filter((v) => v !== 0).length
    expect(nonZero).toBeGreaterThan(90)
  })
})
