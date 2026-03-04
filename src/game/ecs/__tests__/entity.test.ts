import { describe, it, expect } from 'vitest'
import { createEntityPool } from '../entity'

describe('EntityPool', () => {
  it('create() returns a valid numeric ID', () => {
    const pool = createEntityPool()
    const id = pool.create()
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('isAlive() returns true for a freshly created entity', () => {
    const pool = createEntityPool()
    const id = pool.create()
    expect(pool.isAlive(id)).toBe(true)
  })

  it('destroy() + create() recycles the same ID', () => {
    const pool = createEntityPool()
    const id1 = pool.create()
    pool.destroy(id1)
    const id2 = pool.create()
    expect(id2).toBe(id1)
  })

  it('isAlive() returns false after destroy()', () => {
    const pool = createEntityPool()
    const id = pool.create()
    pool.destroy(id)
    expect(pool.isAlive(id)).toBe(false)
  })

  it('pool handles 4096+ entities', () => {
    const pool = createEntityPool(5000)
    const ids: number[] = []
    for (let i = 0; i < 4096; i++) {
      ids.push(pool.create())
    }
    expect(ids.length).toBe(4096)
    ids.forEach((id) => expect(pool.isAlive(id)).toBe(true))
  })
})
