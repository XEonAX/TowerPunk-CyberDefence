import { describe, it, expect } from 'vitest'
import { createGrid, setBlocked } from '../grid'
import { canPlaceTower, canPlaceFirewallPair } from '../placement'
import { GRID_SIZE, CORE_X, CORE_Y } from '../../constants'
import { TowerType } from '../../ecs/component'

// A simple set of gateway tiles for testing (corners accessible)
const testGateways: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [49, 49],
]

describe('canPlaceTower — §2.6', () => {
  it('accepts valid placement on empty interior tile', () => {
    const grid = createGrid()
    expect(canPlaceTower(grid, testGateways, 10, 10)).toBe(true)
  })

  it('rejects placement on occupied tile (§2.6.1)', () => {
    const grid = createGrid()
    setBlocked(grid, 10, 10, TowerType.ICE_WALL)
    expect(canPlaceTower(grid, testGateways, 10, 10)).toBe(false)
  })

  it('rejects placement on edge tile (§2.6.3)', () => {
    const grid = createGrid()
    expect(canPlaceTower(grid, testGateways, 0, 10)).toBe(false)
    expect(canPlaceTower(grid, testGateways, 10, 0)).toBe(false)
    expect(canPlaceTower(grid, testGateways, 50, 10)).toBe(false)
    expect(canPlaceTower(grid, testGateways, 10, 50)).toBe(false)
  })

  it('rejects placement that blocks all paths to Core (§2.6.4)', () => {
    const grid = createGrid()
    const gateways: ReadonlyArray<readonly [number, number]> = [[1, 25]]
    // Block top, left, right neighbours of Core (25,25)
    setBlocked(grid, 25, 24, TowerType.ICE_WALL) // top
    setBlocked(grid, 24, 25, TowerType.ICE_WALL) // left
    setBlocked(grid, 26, 25, TowerType.ICE_WALL) // right
    // Placing on the bottom (25,26) would seal Core — must be rejected
    expect(canPlaceTower(grid, gateways, 25, 26)).toBe(false)
  })

  it('rejects pre-wave placement that fully isolates Core — no gateways yet (§2.6.4)', () => {
    const grid = createGrid()
    const noGateways: ReadonlyArray<readonly [number, number]> = []
    const mid = 25 // CORE is at (25, 25) 0-indexed

    // Build a complete horizontal wall above Core, leaving no vertical gap
    for (let x = 1; x < 50; x++) {
      setBlocked(grid, x, mid - 1, TowerType.ICE_WALL)
    }
    // Build a complete horizontal wall below Core
    for (let x = 1; x < 50; x++) {
      setBlocked(grid, x, mid + 1, TowerType.ICE_WALL)
    }
    // Build left and right walls to fully seal Core tile
    for (let y = mid - 1; y <= mid + 1; y++) {
      setBlocked(grid, mid - 1, y, TowerType.ICE_WALL)
      setBlocked(grid, mid + 1, y, TowerType.ICE_WALL)
    }

    // Attempting to place anything adjacent to the remaining open tile should be rejected
    // The Core is sealed — any inner-border tile is isolated from it
    expect(canPlaceTower(grid, noGateways, 5, 5)).toBe(false)
  })
})

describe('canPlaceFirewallPair — §5.6', () => {
  it('accepts valid horizontal pair', () => {
    const grid = createGrid()
    expect(canPlaceFirewallPair(grid, testGateways,
      { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 })).toBe(true)
  })

  it('rejects if t1 is occupied', () => {
    const grid = createGrid()
    setBlocked(grid, 10, 10, TowerType.ICE_WALL)
    expect(canPlaceFirewallPair(grid, testGateways,
      { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 })).toBe(false)
  })

  it('rejects if t1 is on edge', () => {
    const grid = createGrid()
    expect(canPlaceFirewallPair(grid, testGateways,
      { x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 })).toBe(false)
  })

  it('gap tile is not added to blocked set', () => {
    // Gap should remain walkable after placement validation
    const grid = createGrid()
    const gateways: ReadonlyArray<readonly [number, number]> = [[1, 25]]
    // If gap were blocked, the gateway at (1,25) might become unreachable
    // This test ensures the gap stays walkable
    expect(canPlaceFirewallPair(grid, gateways,
      { x: 10, y: 25 }, { x: 11, y: 25 }, { x: 12, y: 25 })).toBe(true)
  })
})

// Suppress unused import warning
void GRID_SIZE
void CORE_X
void CORE_Y
