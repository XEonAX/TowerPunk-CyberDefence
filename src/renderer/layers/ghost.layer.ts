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
import { canPlaceTower, canPlaceFirewallPair } from '@game/pathfinding/placement'
import { GRID_SIZE } from '@game/constants'
import { TowerType } from '@game/ecs/component'

const VALID_COLOR   = 0x00ff88  // green — valid placement
const INVALID_COLOR = 0xff2244  // red   — invalid placement
const GHOST_ALPHA   = 0.45
/** Reduced alpha for the walkable gap tile in a Firewall pair preview. */
const GAP_ALPHA     = 0.18

let ghostGfx: Graphics | null = null

// Cache last-validated state to avoid running BFS every frame
let lastX = -1
let lastY = -1
let lastTowerType: number | null = null
let lastFacing = -1
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

/** Draw a single ghost tile rect at absolute grid pixel coordinates. */
function _drawTile(gfx: Graphics, tileX: number, tileY: number, color: number, fillAlpha: number, strokeAlpha: number): void {
  const pad = 2
  const px = tileX * TILE_SIZE
  const py = tileY * TILE_SIZE
  gfx.setFillStyle({ color, alpha: fillAlpha })
  gfx.rect(px + pad, py + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2)
  gfx.fill()
  gfx.setStrokeStyle({ color, alpha: strokeAlpha, width: 1 })
  gfx.rect(px + pad, py + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2)
  gfx.stroke()
}

/**
 * Update the ghost preview layer each render frame.
 *
 * @param container          PixiJS Container for the ghost layer.
 * @param world              ECS world (read-only).
 * @param hoveredX           Hovered tile X coordinate (-1 = none).
 * @param hoveredY           Hovered tile Y coordinate (-1 = none).
 * @param selectedTowerType  Currently selected tower type (null = no placement mode).
 * @param placementFacing    Current placement facing (0–7 via Dir enum). Used for Firewall axis and Data Spike.
 */
export function updateGhostLayer(
  container: Container,
  world: World,
  hoveredX: number,
  hoveredY: number,
  selectedTowerType: number | null,
  placementFacing = 0,
): void {
  // Acquire ghost Graphics on first call
  if (!ghostGfx) {
    ghostGfx = new Graphics()
    ghostGfx.x = 0
    ghostGfx.y = 0
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
    lastFacing = -1
    return
  }

  // Re-validate and redraw only when the hovered tile, tower type, or facing changes
  if (
    hoveredX !== lastX || hoveredY !== lastY ||
    selectedTowerType !== lastTowerType || placementFacing !== lastFacing
  ) {
    lastX = hoveredX
    lastY = hoveredY
    lastTowerType = selectedTowerType
    lastFacing = placementFacing

    const grid = _worldGrid(world)
    const gatewayTiles = _gatewayTiles(world)

    ghostGfx.clear()

    if (selectedTowerType === TowerType.FIREWALL) {
      // §5.2.1 — Firewall is a 3-tile pair (t1, gap, t2).
      // The hovered tile is the walkable gap; t1/t2 are placed on either side.
      // Offsets: [t1dx, t1dy, t2dx, t2dy] per Dir value.
      const FW_OFFSETS = [
        [ 0, -1,  0,  1],  // 0: N  → Vertical
        [ 0, -1,  0,  1],  // 1: S  → Vertical (same)
        [-1,  0,  1,  0],  // 2: E  → Horizontal
        [-1,  0,  1,  0],  // 3: W  → Horizontal (same)
        [-1,  1,  1, -1],  // 4: NE → Diagonal ↗↙
        [-1, -1,  1,  1],  // 5: SE → Diagonal ↘↖
        [-1,  1,  1, -1],  // 6: SW → Diagonal ↗↙ (same)
        [-1, -1,  1,  1],  // 7: NW → Diagonal ↘↖ (same)
      ] as const
      const [t1dx, t1dy, t2dx, t2dy] = FW_OFFSETS[placementFacing] ?? FW_OFFSETS[0]
      const gapX = hoveredX
      const gapY = hoveredY
      const t1x = gapX + t1dx
      const t1y = gapY + t1dy
      const t2x = gapX + t2dx
      const t2y = gapY + t2dy

      lastValid = canPlaceFirewallPair(
        grid, gatewayTiles,
        { x: t1x, y: t1y },
        { x: gapX, y: gapY },
        { x: t2x, y: t2y },
      )

      const color = lastValid ? VALID_COLOR : INVALID_COLOR
      _drawTile(ghostGfx, t1x, t1y, color, GHOST_ALPHA, 0.8)
      _drawTile(ghostGfx, gapX, gapY, color, GAP_ALPHA, 0.35)
      _drawTile(ghostGfx, t2x, t2y, color, GHOST_ALPHA, 0.8)
    } else {
      // Standard single-tile ghost
      lastValid = canPlaceTower(grid, gatewayTiles, hoveredX, hoveredY)
      const color = lastValid ? VALID_COLOR : INVALID_COLOR
      _drawTile(ghostGfx, hoveredX, hoveredY, color, GHOST_ALPHA, 0.8)
    }
  }

  ghostGfx.visible = true
}
