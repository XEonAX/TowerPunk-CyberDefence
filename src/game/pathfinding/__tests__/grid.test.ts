import { describe, it, expect } from 'vitest'
import { createGrid, isEdgeTile, isOccupied, setBlocked, clearBlocked, idx } from '../grid'
import { GRID_SIZE } from '../../constants'

describe('Grid', () => {
  it('createGrid() returns all empty', () => {
    const grid = createGrid()
    expect(grid.blocked.every((v) => v === 0)).toBe(true)
  })

  it('idx(x, y) returns y * GRID_SIZE + x', () => {
    expect(idx(3, 5)).toBe(3 + 5 * GRID_SIZE)
    expect(idx(0, 0)).toBe(0)
  })

  describe('isEdgeTile — §2.6.3', () => {
    it('returns true for x=0', () => expect(isEdgeTile(0, 10)).toBe(true))
    it('returns true for y=0', () => expect(isEdgeTile(10, 0)).toBe(true))
    it('returns true for x=50', () => expect(isEdgeTile(50, 10)).toBe(true))
    it('returns true for y=50', () => expect(isEdgeTile(10, 50)).toBe(true))
    it('returns false for center tile', () => expect(isEdgeTile(25, 25)).toBe(false))
    it('returns false for interior tile', () => expect(isEdgeTile(10, 10)).toBe(false))
  })

  it('setBlocked → isOccupied returns true', () => {
    const grid = createGrid()
    setBlocked(grid, 5, 5, 1)
    expect(isOccupied(grid, 5, 5)).toBe(true)
  })

  it('clearBlocked → isOccupied returns false', () => {
    const grid = createGrid()
    setBlocked(grid, 5, 5, 1)
    clearBlocked(grid, 5, 5)
    expect(isOccupied(grid, 5, 5)).toBe(false)
  })
})
