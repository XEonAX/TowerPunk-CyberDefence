/**
 * BFS Flowfield — Tech.md §5.1–5.2
 *
 * Computes cost and direction fields via BFS flood-fill from Core tile.
 * Two fields: standard (all towers block) and glitch (ICE Wall + Firewall passable).
 */

import { GRID_SIZE, CORE_X, CORE_Y } from '../constants'
import { isEdgeTile, idx } from './grid'
import type { ReadonlyGrid } from './grid'
import { TowerType } from '../ecs/component'

export const UNREACHABLE = 0xffff

/** Direction enums matching §2.10.5 */
export const DIR_N = 0
export const DIR_S = 1
export const DIR_E = 2
export const DIR_W = 3
export const DIR_NONE = 0xff

// Orthogonal neighbors: [dx, dy, dir]
const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [0, -1, DIR_S], // neighbor to North = we came from South
  [0, 1, DIR_N],  // neighbor to South = we came from North
  [1, 0, DIR_W],  // neighbor to East = we came from West
  [-1, 0, DIR_E], // neighbor to West = we came from East
]

export interface Flowfield {
  cost: Uint16Array
  dir: Uint8Array
}

// Module-level BFS queue (reused, zero alloc)
const BFS_QUEUE = new Uint16Array(GRID_SIZE * GRID_SIZE * 2) // [x, y] pairs
const VISITED = new Uint8Array(GRID_SIZE * GRID_SIZE)

/**
 * Run BFS from Core tile and produce cost + direction fields.
 * @param extraBlocked Additional tiles to treat as blocked (for scratch validation).
 */
function runBFS(
  grid: ReadonlyGrid,
  cost: Uint16Array,
  dir: Uint8Array,
  glitchMode: boolean,
  extraBlocked: ReadonlyArray<number> = [],
): void {
  cost.fill(UNREACHABLE)
  dir.fill(DIR_NONE)
  VISITED.fill(0)

  const coreIdx = idx(CORE_X, CORE_Y)
  cost[coreIdx] = 0
  dir[coreIdx] = DIR_NONE
  VISITED[coreIdx] = 1

  let head = 0
  let tail = 0
  BFS_QUEUE[tail++] = CORE_X
  BFS_QUEUE[tail++] = CORE_Y

  while (head < tail) {
    const cx = BFS_QUEUE[head++]
    const cy = BFS_QUEUE[head++]
    const ci = idx(cx, cy)
    const nextCost = cost[ci] + 1

    for (let n = 0; n < 4; n++) {
      const [dx, dy, fromDir] = NEIGHBORS[n]
      const nx = cx + dx
      const ny = cy + dy

      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue
      const ni = idx(nx, ny)
      if (VISITED[ni]) continue

      // Check if blocked
      const towerTypeVal = grid.towerType[ni]
      if (grid.blocked[ni]) {
        // In glitch mode, ICE Wall and Firewall are passable
        if (
          !glitchMode ||
          (towerTypeVal !== TowerType.ICE_WALL && towerTypeVal !== TowerType.FIREWALL)
        ) {
          continue
        }
      }
      // Check extra blocked tiles
      if (extraBlocked.includes(ni)) continue

      VISITED[ni] = 1
      cost[ni] = nextCost
      dir[ni] = fromDir
      BFS_QUEUE[tail++] = nx
      BFS_QUEUE[tail++] = ny
    }
  }
}

/**
 * Compute both standard and glitch flowfields.
 */
export function computeDualFlowfields(
  grid: ReadonlyGrid,
  standardCost: Uint16Array,
  standardDir: Uint8Array,
  glitchCost: Uint16Array,
  glitchDir: Uint8Array,
): void {
  runBFS(grid, standardCost, standardDir, false)
  runBFS(grid, glitchCost, glitchDir, true)
}

/**
 * Compute just the standard flowfield.
 */
export function computeFlowfield(
  grid: ReadonlyGrid,
  cost: Uint16Array,
  dir: Uint8Array,
  glitchMode: boolean = false,
  extraBlocked: ReadonlyArray<number> = [],
): void {
  runBFS(grid, cost, dir, glitchMode, extraBlocked)
}

// Suppress unused import warning — isEdgeTile is available for callers
void isEdgeTile
