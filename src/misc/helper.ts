/**
 * Dev / stress-test helpers.
 *
 * These utilities are NOT part of the simulation and must never be imported
 * by production code paths.  They dispatch game:command events so they work
 * cleanly with the existing command queue without touching ECS internals.
 *
 * Usage (browser console while the game is running):
 *   import('/src/misc/helper.js').then(m => m.generateSpiralMaze(0))
 * or, after calling installDevHelpers():
 *   __dev.spiralMaze()          // uses ICE_WALL (type 0) at level 1
 *   __dev.spiralMaze(3, 5)      // DAEMON_TURRET at level 5
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GRID_SIZE, CORE_X, CORE_Y } from '../game/constants'
import { CommandType } from '../game/ecs/world'
import { TowerType } from '../game/ecs/component'
import { useUiStore } from '../ui/stores/ui.store'

/** Runtime mirror of TowerType const enum for __dev console access. */
const TOWER_TYPE_MAP = {
  ICE_WALL:      TowerType.ICE_WALL,
  FIREWALL:      TowerType.FIREWALL,
  DATA_SPIKE:    TowerType.DATA_SPIKE,
  DAEMON_TURRET: TowerType.DAEMON_TURRET,
  ICE_SNIPER:    TowerType.ICE_SNIPER,
  BLACKWALL:     TowerType.BLACKWALL,
  PING:          TowerType.PING,
  HARVESTER:     TowerType.HARVESTER,
} as const

// ---------------------------------------------------------------------------
// Spiral-maze coordinate generator
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of tile coordinates that form the spiral maze,
 * tracing a clockwise square spiral outward from the top-left tile of the core.
 *
 * Spiral pattern
 * --------------
 * Start at (CORE_X − 1, CORE_Y − 1) — the tile immediately top-left of the core.
 * Then proceed clockwise in segments whose lengths follow the sequence:
 *   2 right, 2 down, 4 left, 4 up, 6 right, 6 down, 8 left, 8 up, …
 *
 * Every pair of segments the step-count increases by 2, growing the spiral
 * one layer outward each full revolution.  Tiles that fall outside the
 * valid placed area (border rows/cols 0 and GRID_SIZE−1 are forbidden) stop
 * iteration early.
 */
function buildSpiralCoords(): ReadonlyArray<readonly [number, number]> {
  const coords: Array<readonly [number, number]> = []

  // Start at the top-left tile of the core
  let x = CORE_X - 1
  let y = CORE_Y - 1

  // Guard: starting tile must be within the valid placement area
  if (x < 1 || x > GRID_SIZE - 2 || y < 1 || y > GRID_SIZE - 2) return coords

  coords.push([x, y] as const)

  // Direction vectors for: right, down, left, up (clockwise)
  const DX = [ 1,  0, -1,  0]
  const DY = [ 0,  1,  0, -1]

  let dirIdx = 0   // start moving right
  let segLen = 2   // segment length for the current pair

  outer: while (true) {
    // Each iteration of the outer loop handles one pair of segments,
    // then increments segLen by 2.
    for (let seg = 0; seg < 2; seg++) {
      for (let step = 0; step < segLen; step++) {
        x += DX[dirIdx]
        y += DY[dirIdx]
        // Stop if we've reached the border (edge tiles are off-limits)
        if (x < 1 || x > GRID_SIZE - 2 || y < 1 || y > GRID_SIZE - 2) break outer
        coords.push([x, y] as const)
      }
      dirIdx = (dirIdx + 1) % 4
    }
    segLen += 2
  }

  return coords
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a spiral maze of towers on the grid, growing from the core
 * outward to the boundary.
 *
 * @param towerType  TowerType value. Defaults to the currently selected tower
 *                   in the UI (useUiStore().selectedTowerType), falling back to
 *                   ICE_WALL if nothing is selected.
 * @param level      Tower level to place at (1–10, defaults to the current
 *                   placement level from the UI store).
 * @param batchSize  Commands dispatched per animation frame (default 30).
 *                   Lower values keep the UI responsive during placement.
 */
export function generateSpiralMaze(
  towerType?: TowerType,
  level?: number,
  batchSize = 30,
): void {
  const uiStore = useUiStore()
  const resolvedType = towerType ?? uiStore.selectedTowerType ?? TowerType.ICE_WALL
  const resolvedLevel = level ?? uiStore.placementLevel

  const coords = buildSpiralCoords()

  let idx = 0

  function dispatchBatch(): void {
    const end = Math.min(idx + batchSize, coords.length)
    for (; idx < end; idx++) {
      const [x, y] = coords[idx]
      window.dispatchEvent(
        new CustomEvent('game:command', {
          detail: {
            type: CommandType.PLACE_TOWER,
            towerType: resolvedType,
            x,
            y,
            level: resolvedLevel,
          },
        }),
      )
    }
    if (idx < coords.length) {
      requestAnimationFrame(dispatchBatch)
    } else {
      console.info(
        `[helper] Spiral maze complete — ${coords.length} towers dispatched` +
          ` (type=${resolvedType}, level=${resolvedLevel}).`,
      )
    }
  }

  dispatchBatch()
}

/**
 * Installs shorthand helpers on `window.__dev` for quick console access.
 *
 * Call once from main.ts (dev builds only) or directly from the console:
 *   import('/src/misc/helper.js').then(m => m.installDevHelpers())
 */
export function installDevHelpers(): void {
  ;(window as unknown as Record<string, unknown>)['__dev'] = {
    /**
     * __dev.spiralMaze(towerType?, level?, batchSize?)
     * Fills the grid with a spiral maze.
     * Defaults: currently selected tower type and placement level from the UI.
     */
    spiralMaze: (towerType?: TowerType, level?: number, batchSize = 30): void =>
      generateSpiralMaze(towerType, level, batchSize),

    /** Tower type constants for convenience — same values as the TowerType enum. */
    TowerType: TOWER_TYPE_MAP,
  }

  console.info(
    '[helper] Dev helpers installed on window.__dev.\n' +
      '  __dev.spiralMaze()          → ICE_WALL L1\n' +
      '  __dev.spiralMaze(3, 5)      → DAEMON_TURRET L5\n' +
      '  __dev.TowerType             → enum reference',
  )
}
