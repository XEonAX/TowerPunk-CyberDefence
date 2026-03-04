/**
 * Placement Validation — Tech.md §5.3, §5.5–5.6, Rulebook §2.6
 *
 * canPlaceTower() and canPlaceFirewallPair() are read-only queries.
 * Zero allocations — reuses module-level scratch buffers (Tech.md §5.5.4).
 */

import { GRID_SIZE, CORE_X, CORE_Y } from '../constants'
import { isEdgeTile, isOccupied, idx } from './grid'
import type { ReadonlyGrid } from './grid'
import { computeFlowfield, UNREACHABLE } from './flowfield'

// Pre-allocated scratch buffers (Tech.md §5.5.4) — zero allocations per call
const scratchCost = new Uint16Array(GRID_SIZE * GRID_SIZE)
const scratchDir = new Uint8Array(GRID_SIZE * GRID_SIZE)

// Reusable extra-blocked index list for passing to BFS (avoids allocation)
// Max 2 tiles needed for Firewall pair validation
const extraBlockedBuf: number[] = [0, 0]

/**
 * Check whether a tower can be placed at (x, y).
 * Read-only — zero allocations (Tech.md §5.5.2).
 * @param gatewayTiles List of [x, y] pairs for active gateway tiles.
 */
export function canPlaceTower(
  grid: ReadonlyGrid,
  gatewayTiles: ReadonlyArray<readonly [number, number]>,
  x: number,
  y: number,
): boolean {
  // §2.6.3 — edge tiles cannot be built on
  if (isEdgeTile(x, y)) return false

  // §2.6.1 — must be empty
  if (isOccupied(grid, x, y)) return false

  // Core tile cannot be built on
  if (x === CORE_X && y === CORE_Y) return false

  // §2.6.4 — check placement doesn't block all paths to Core
  // Use extraBlocked to temporarily mark the tile without mutating grid
  extraBlockedBuf[0] = idx(x, y)
  computeFlowfield(grid, scratchCost, scratchDir, false, extraBlockedBuf.slice(0, 1))

  // Check all active gateways still reachable
  for (const [gx, gy] of gatewayTiles) {
    if (scratchCost[idx(gx, gy)] === UNREACHABLE) return false
  }

  return true
}

/**
 * Check whether a Firewall pair can be placed.
 * t1 and t2 are the two tower tiles; gap is the middle walkable tile.
 * Zero allocations (Tech.md §5.6.4).
 * Rulebook §5.2.1, §5.2.3
 */
export function canPlaceFirewallPair(
  grid: ReadonlyGrid,
  gatewayTiles: ReadonlyArray<readonly [number, number]>,
  t1: { x: number; y: number },
  gap: { x: number; y: number },
  t2: { x: number; y: number },
): boolean {
  // All three tiles must be within playfield bounds
  if (
    t1.x < 0 || t1.x >= GRID_SIZE || t1.y < 0 || t1.y >= GRID_SIZE ||
    gap.x < 0 || gap.x >= GRID_SIZE || gap.y < 0 || gap.y >= GRID_SIZE ||
    t2.x < 0 || t2.x >= GRID_SIZE || t2.y < 0 || t2.y >= GRID_SIZE
  ) return false

  // Core tile cannot be blocked
  if (
    (t1.x === CORE_X && t1.y === CORE_Y) ||
    (gap.x === CORE_X && gap.y === CORE_Y) ||
    (t2.x === CORE_X && t2.y === CORE_Y)
  ) return false

  // Tower tiles cannot be edge tiles (§2.6.3)
  if (isEdgeTile(t1.x, t1.y) || isEdgeTile(t2.x, t2.y)) return false

  // All three tiles must be unoccupied
  if (
    isOccupied(grid, t1.x, t1.y) ||
    isOccupied(grid, gap.x, gap.y) ||
    isOccupied(grid, t2.x, t2.y)
  ) return false

  // Gap tile is walkable — only block the two tower tiles for BFS (Tech.md §5.6.2)
  extraBlockedBuf[0] = idx(t1.x, t1.y)
  extraBlockedBuf[1] = idx(t2.x, t2.y)
  computeFlowfield(grid, scratchCost, scratchDir, false, extraBlockedBuf.slice(0, 2))

  for (const [gx, gy] of gatewayTiles) {
    if (scratchCost[idx(gx, gy)] === UNREACHABLE) return false
  }

  return true
}
