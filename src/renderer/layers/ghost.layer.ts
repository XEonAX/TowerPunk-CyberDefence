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
import {
  GRID_SIZE,
  DATA_SPIKE_RANGE,
  DAEMON_TURRET_RANGE,
  ICE_SNIPER_MIN_RANGE,
  ICE_SNIPER_MAX_RANGE,
  PING_TOWER_RANGE,
} from '@game/constants'
import { TowerType } from '@game/ecs/component'
import { inDataSpikeCone } from '@game/systems/targeting.system'

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
let lastLevel = -1
let lastValid = false

/** Tower accent colours mirroring tower.layer.ts TOWER_COLORS — render-only. */
const RANGE_COLORS: Partial<Record<TowerType, number>> = {
  [TowerType.ICE_WALL]:     0x4488ff,
  [TowerType.DAEMON_TURRET]:0x00ff88,
  [TowerType.ICE_SNIPER]:   0xaaddff,
  [TowerType.PING]:         0xffdd00,
}

/** Draw a filled + stroked range circle centred on a tile. */
function _drawRangeCircle(
  gfx: Graphics,
  tileX: number, tileY: number,
  radiusTiles: number,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
): void {
  const cx = (tileX + 0.5) * TILE_SIZE
  const cy = (tileY + 0.5) * TILE_SIZE
  const r  = (radiusTiles + 0.5) * TILE_SIZE
  gfx.setFillStyle({ color, alpha: fillAlpha })
  gfx.circle(cx, cy, r)
  gfx.fill()
  gfx.setStrokeStyle({ width: 1, color, alpha: strokeAlpha })
  gfx.circle(cx, cy, r)
  gfx.stroke()
}

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
 * @param placementLevel     Intended placement level (1–10). Used for Data Spike range preview.
 */
export function updateGhostLayer(
  container: Container,
  world: World,
  hoveredX: number,
  hoveredY: number,
  selectedTowerType: number | null,
  placementFacing = 0,
  placementLevel = 1,
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
    lastLevel = -1
    return
  }

  // Re-validate and redraw only when the hovered tile, tower type, facing, or level changes
  if (
    hoveredX !== lastX || hoveredY !== lastY ||
    selectedTowerType !== lastTowerType || placementFacing !== lastFacing ||
    placementLevel !== lastLevel
  ) {
    lastX = hoveredX
    lastY = hoveredY
    lastTowerType = selectedTowerType
    lastFacing = placementFacing
    lastLevel = placementLevel

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
    } else if (selectedTowerType === TowerType.DATA_SPIKE) {
      // §5.3.2 — show tower tile + cone of affected tiles at L1 range.
      // Ghost is always placed at L1, range can only grow on upgrade.
      lastValid = canPlaceTower(grid, gatewayTiles, hoveredX, hoveredY)
      const color = lastValid ? VALID_COLOR : INVALID_COLOR
      _drawTile(ghostGfx, hoveredX, hoveredY, color, GHOST_ALPHA, 0.8)
      const levelIdx = Math.max(0, Math.min(9, placementLevel - 1))
      const range = DATA_SPIKE_RANGE[levelIdx] ?? 2
      for (let cy = hoveredY - range; cy <= hoveredY + range; cy++) {
        for (let cx = hoveredX - range; cx <= hoveredX + range; cx++) {
          if (cx < 0 || cy < 0 || cx >= GRID_SIZE || cy >= GRID_SIZE) continue
          if (!inDataSpikeCone(cx, cy, hoveredX, hoveredY, placementFacing, range)) continue
          _drawTile(ghostGfx, cx, cy, 0xff00ff, 0.22, 0.5)
        }
      }
    } else {
      // Standard single-tile ghost
      lastValid = canPlaceTower(grid, gatewayTiles, hoveredX, hoveredY)
      const color = lastValid ? VALID_COLOR : INVALID_COLOR
      const levelIdx = Math.max(0, Math.min(9, placementLevel - 1))

      // Range overlay — draw before the ghost tile so it sits underneath
      if (selectedTowerType === TowerType.ICE_WALL) {
        // §5.1.2 — Chebyshev 1 aura, constant across all levels
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, 1, RANGE_COLORS[TowerType.ICE_WALL]!, 0.07, 0.45)

      } else if (selectedTowerType === TowerType.DAEMON_TURRET) {
        const range = DAEMON_TURRET_RANGE[levelIdx] ?? 3
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, range, RANGE_COLORS[TowerType.DAEMON_TURRET]!, 0.07, 0.45)

      } else if (selectedTowerType === TowerType.ICE_SNIPER) {
        // §5.5.2 — fixed min/max range, not level-dependent
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, ICE_SNIPER_MAX_RANGE, RANGE_COLORS[TowerType.ICE_SNIPER]!, 0.05, 0.45)
        // Dead-zone inner ring in red
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, ICE_SNIPER_MIN_RANGE - 1, 0xff4444, 0.08, 0.4)

      } else if (selectedTowerType === TowerType.PING) {
        const range = PING_TOWER_RANGE[levelIdx] ?? 3
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, range, RANGE_COLORS[TowerType.PING]!, 0.07, 0.45)
      }

      _drawTile(ghostGfx, hoveredX, hoveredY, color, GHOST_ALPHA, 0.8)
    }
  }

  ghostGfx.visible = true
}
