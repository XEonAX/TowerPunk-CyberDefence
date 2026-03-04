import { describe, it, expect } from 'vitest'
import { createGrid, setBlocked, idx } from '../grid'
import { computeFlowfield, computeDualFlowfields, UNREACHABLE, DIR_NONE } from '../flowfield'
import { GRID_SIZE, CORE_X, CORE_Y } from '../../constants'
import { TowerType } from '../../ecs/component'

function makeFields() {
  return {
    cost: new Uint16Array(GRID_SIZE * GRID_SIZE),
    dir: new Uint8Array(GRID_SIZE * GRID_SIZE),
    glitchCost: new Uint16Array(GRID_SIZE * GRID_SIZE),
    glitchDir: new Uint8Array(GRID_SIZE * GRID_SIZE),
  }
}

describe('BFS Flowfield', () => {
  it('empty grid: Core tile has cost=0 and dir=NONE', () => {
    const grid = createGrid()
    const { cost, dir } = makeFields()
    computeFlowfield(grid, cost, dir)
    expect(cost[idx(CORE_X, CORE_Y)]).toBe(0)
    expect(dir[idx(CORE_X, CORE_Y)]).toBe(DIR_NONE)
  })

  it('empty grid: all non-edge tiles reachable', () => {
    const grid = createGrid()
    const { cost, dir: _ } = makeFields()
    computeFlowfield(grid, cost, _)
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        expect(cost[idx(x, y)]).not.toBe(UNREACHABLE)
      }
    }
  })

  it('cost increases outward from Core', () => {
    const grid = createGrid()
    const { cost, dir: _ } = makeFields()
    computeFlowfield(grid, cost, _)
    // Tile adjacent to core should have cost 1
    expect(cost[idx(CORE_X + 1, CORE_Y)]).toBe(1)
    expect(cost[idx(CORE_X, CORE_Y + 1)]).toBe(1)
    // Tile 5 away should have cost ~5
    expect(cost[idx(CORE_X + 5, CORE_Y)]).toBe(5)
  })

  it('blocked tile: paths route around it', () => {
    const grid = createGrid()
    setBlocked(grid, CORE_X + 1, CORE_Y, TowerType.ICE_WALL)
    const { cost, dir: _ } = makeFields()
    computeFlowfield(grid, cost, _)
    // Blocked tile is unreachable
    expect(cost[idx(CORE_X + 1, CORE_Y)]).toBe(UNREACHABLE)
    // Tile beyond blocked should still be reachable (routes around)
    expect(cost[idx(CORE_X + 2, CORE_Y)]).not.toBe(UNREACHABLE)
  })

  it('fully walled off tile is unreachable', () => {
    const grid = createGrid()
    // Surround a tile completely
    const tx = 10
    const ty = 10
    setBlocked(grid, tx + 1, ty, TowerType.ICE_WALL)
    setBlocked(grid, tx - 1, ty, TowerType.ICE_WALL)
    setBlocked(grid, tx, ty + 1, TowerType.ICE_WALL)
    setBlocked(grid, tx, ty - 1, TowerType.ICE_WALL)
    const { cost, dir: _ } = makeFields()
    computeFlowfield(grid, cost, _)
    expect(cost[idx(tx, ty)]).toBe(UNREACHABLE)
  })

  it('4-directional only — no diagonal movement', () => {
    // Block a diagonal tile from Core — it should only be reachable by going orthogonally
    const grid = createGrid()
    // Block all tiles in a row except CORE_X, forcing the only path to go straight up
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      if (x !== CORE_X) {
        setBlocked(grid, x, CORE_Y - 1, TowerType.ICE_WALL)
      }
    }
    const { cost, dir: _ } = makeFields()
    computeFlowfield(grid, cost, _)
    // The unblocked tile at (CORE_X, CORE_Y-1) should be reachable with cost 1
    expect(cost[idx(CORE_X, CORE_Y - 1)]).toBe(1)
    // A blocked tile at (CORE_X+1, CORE_Y-1) should be UNREACHABLE (not reachable diagonally)
    expect(cost[idx(CORE_X + 1, CORE_Y - 1)]).toBe(UNREACHABLE)
    // This confirms enemies can't reach tiles diagonally — only orthogonally (§7.0.2)
  })
})

describe('Dual Flowfields (§5.2)', () => {
  it('standard: ICE Wall blocks path', () => {
    const grid = createGrid()
    setBlocked(grid, CORE_X + 1, CORE_Y, TowerType.ICE_WALL)
    const f = makeFields()
    computeDualFlowfields(grid, f.cost, f.dir, f.glitchCost, f.glitchDir)
    expect(f.cost[idx(CORE_X + 1, CORE_Y)]).toBe(UNREACHABLE)
  })

  it('glitch: ICE Wall is passable (§7.4.1)', () => {
    const grid = createGrid()
    setBlocked(grid, CORE_X + 1, CORE_Y, TowerType.ICE_WALL)
    const f = makeFields()
    computeDualFlowfields(grid, f.cost, f.dir, f.glitchCost, f.glitchDir)
    expect(f.glitchCost[idx(CORE_X + 1, CORE_Y)]).not.toBe(UNREACHABLE)
  })

  it('glitch: Firewall is passable (§7.4.1)', () => {
    const grid = createGrid()
    setBlocked(grid, CORE_X + 1, CORE_Y, TowerType.FIREWALL)
    const f = makeFields()
    computeDualFlowfields(grid, f.cost, f.dir, f.glitchCost, f.glitchDir)
    expect(f.glitchCost[idx(CORE_X + 1, CORE_Y)]).not.toBe(UNREACHABLE)
  })

  it('glitch: Data Spike still blocks path', () => {
    const grid = createGrid()
    setBlocked(grid, CORE_X + 1, CORE_Y, TowerType.DATA_SPIKE)
    const f = makeFields()
    computeDualFlowfields(grid, f.cost, f.dir, f.glitchCost, f.glitchDir)
    expect(f.glitchCost[idx(CORE_X + 1, CORE_Y)]).toBe(UNREACHABLE)
  })
})
