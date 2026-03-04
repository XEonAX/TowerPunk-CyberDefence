/**
 * Ghost Preview Layer — Tech.md §6.6, Rulebook §2.6
 *
 * Renders a semi-transparent tower preview at the hovered tile during
 * placement mode. Green = valid placement, Red = invalid.
 * Placement validity is re-checked only when the hovered tile changes.
 */

import { Graphics, Container } from 'pixi.js'
import type { World } from '@game/ecs/world'
import { TILE_SIZE } from '../camera'
import { canPlaceTower } from '@game/pathfinding/placement'
import { GRID_SIZE } from '@game/constants'

const VALID_COLOR   = 0x00ff88  // green — valid placement
const INVALID_COLOR = 0xff2244  // red   — invalid placement
const GHOST_ALPHA   = 0.45

let ghostGfx: Graphics | null = null

// Cache last-validated tile to avoid running BFS every frame
let lastX = -1
let lastY = -1
let lastTowerType: number | null = null
let lastValid = false

/** Build a ReadonlyGrid view from the world arrays. Zero allocation. */
function _worldGrid(w: World) {
  return { blocked: w.gridBlocked, towerType: w.gridTowerType }
}

/** Collect active gateway tile positions. */
function _gatewayTiles(w: World): ReadonlyArray<readonly [number, number]> {
  const tiles: Array<readonly [number, number]> = []
  for (let i = 0; i < w.activeGatewayCount; i++) {
    const gwEid = w.activeGateways[i]
    tiles.push([w.gatewayX[gwEid], w.gatewayY[gwEid]])
  }
  return tiles
}

/**
 * Update the ghost preview layer each render frame.
 *
 * @param container        PixiJS Container for the ghost layer.
 * @param world            ECS world (read-only).
 * @param hoveredX         Hovered tile X coordinate (-1 = none).
 * @param hoveredY         Hovered tile Y coordinate (-1 = none).
 * @param selectedTowerType  Currently selected tower type (null = no placement mode).
 */
export function updateGhostLayer(
  container: Container,
  world: World,
  hoveredX: number,
  hoveredY: number,
  selectedTowerType: number | null,
): void {
  // Acquire ghost Graphics on first call
  if (!ghostGfx) {
    ghostGfx = new Graphics()
    container.addChild(ghostGfx)
  }

  // Hide ghost when not in placement mode or hovering off-grid
  if (
    selectedTowerType === null ||
    hoveredX < 0 || hoveredX >= GRID_SIZE ||
    hoveredY < 0 || hoveredY >= GRID_SIZE
  ) {
    ghostGfx.visible = false
    lastX = -1
    lastY = -1
    lastTowerType = null
    return
  }

  // Re-validate only when the hovered tile or tower type changes (not every frame)
  if (hoveredX !== lastX || hoveredY !== lastY || selectedTowerType !== lastTowerType) {
    lastX = hoveredX
    lastY = hoveredY
    lastTowerType = selectedTowerType

    const grid = _worldGrid(world)
    const gatewayTiles = _gatewayTiles(world)
    lastValid = canPlaceTower(grid, gatewayTiles, hoveredX, hoveredY)

    // Redraw ghost at new tile
    const color = lastValid ? VALID_COLOR : INVALID_COLOR
    const pad = 2
    ghostGfx.clear()
    ghostGfx.setFillStyle({ color, alpha: GHOST_ALPHA })
    ghostGfx.rect(pad, pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2)
    ghostGfx.fill()

    // Outline stroke
    ghostGfx.setStrokeStyle({ color, alpha: 0.8, width: 1 })
    ghostGfx.rect(pad, pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2)
    ghostGfx.stroke()
  }

  // Position is updated every frame in case the camera moves
  ghostGfx.visible = true
  ghostGfx.x = hoveredX * TILE_SIZE
  ghostGfx.y = hoveredY * TILE_SIZE
}
