/**
 * Ghost Preview Layer — Tech.md §6.6, Rulebook §2.6
 *
 * Renders a semi-transparent tower preview at the hovered tile during
 * placement mode. Green = valid placement, Red = invalid.
 * Placement validity is re-checked only when the hovered tile changes.
 */

import { Graphics, Container, Sprite } from 'pixi.js'
import { getTowerTexture } from '../towerTextures'
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

/**
 * Dir → PixiJS rotation (radians). All tower art faces North by default.
 * Mirrors tower.layer.ts DIR_ROTATION.
 */
const DIR_ROTATION: Record<number, number> = {
  0: 0,              // N
  1: Math.PI,        // S
  2: Math.PI / 2,    // E
  3: -Math.PI / 2,   // W
  4: Math.PI / 4,    // NE
  5: 3 * Math.PI / 4,// SE
  6: -3 * Math.PI / 4,// SW
  7: -Math.PI / 4,   // NW
}

/** Tower types whose sprites rotate around tile centre. */
const ROTATING_GHOST_TYPES = new Set([
  TowerType.DATA_SPIKE,
  TowerType.DAEMON_TURRET,
  TowerType.ICE_SNIPER,
])

const VALID_COLOR   = 0x00ff88  // green — valid placement
const INVALID_COLOR = 0xff2244  // red   — invalid placement
const GHOST_ALPHA   = 0.45
/** Reduced alpha for the walkable gap tile in a Firewall pair preview. */
const GAP_ALPHA     = 0.18

/** Tint applied to ghost sprite when placement is valid. Soft green preserves tower art colours. */
const GHOST_TINT_VALID   = 0x99ffbb
/** Tint applied to ghost sprite when placement is invalid. Soft red preserves tower art colours. */
const GHOST_TINT_INVALID = 0xff8888

let ghostGfx: Graphics | null = null
/** Ghost sprite for the primary tower tile (all tower types). */
let ghostSprite: Sprite | null = null
/** Ghost sprite for the second Firewall tower tile (§5.2.1). */
let ghostSprite2: Sprite | null = null

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
  // Acquire ghost Graphics on first call (range overlays — added first, sits underneath sprites)
  if (!ghostGfx) {
    ghostGfx = new Graphics()
    ghostGfx.x = 0
    ghostGfx.y = 0
    container.addChild(ghostGfx)
  }
  // Primary ghost sprite — all tower types show their art here
  if (!ghostSprite) {
    ghostSprite = new Sprite()
    ghostSprite.width  = TILE_SIZE
    ghostSprite.height = TILE_SIZE
    ghostSprite.visible = false
    container.addChild(ghostSprite)
  }
  // Secondary ghost sprite — Firewall second tower tile (§5.2.1)
  if (!ghostSprite2) {
    ghostSprite2 = new Sprite()
    ghostSprite2.width  = TILE_SIZE
    ghostSprite2.height = TILE_SIZE
    ghostSprite2.visible = false
    container.addChild(ghostSprite2)
  }

  // Hide ghost when not in placement mode or hovering off-grid
  if (
    selectedTowerType === null ||
    hoveredX < 0 || hoveredX >= GRID_SIZE ||
    hoveredY < 0 || hoveredY >= GRID_SIZE
  ) {
    ghostGfx.visible = false
    if (ghostSprite)  ghostSprite.visible  = false
    if (ghostSprite2) ghostSprite2.visible = false
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
    // Reset sprite visibility — each branch below re-enables what it needs
    ghostSprite!.visible  = false
    ghostSprite2!.visible = false

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
      const tint  = lastValid ? GHOST_TINT_VALID : GHOST_TINT_INVALID
      // Gap tile — dimmer graphics rect (walkable gap, not a tower)
      _drawTile(ghostGfx, gapX, gapY, color, GAP_ALPHA, 0.35)
      // t1 sprite
      const fwTex = getTowerTexture(TowerType.FIREWALL)
      ghostSprite!.texture  = fwTex
      ghostSprite!.anchor.set(0)
      ghostSprite!.rotation = 0
      ghostSprite!.width    = TILE_SIZE
      ghostSprite!.height   = TILE_SIZE
      ghostSprite!.tint     = tint
      ghostSprite!.alpha    = GHOST_ALPHA
      ghostSprite!.x        = t1x * TILE_SIZE
      ghostSprite!.y        = t1y * TILE_SIZE
      ghostSprite!.visible  = true
      // t2 sprite
      ghostSprite2!.texture  = fwTex
      ghostSprite2!.anchor.set(0)
      ghostSprite2!.rotation = 0
      ghostSprite2!.width    = TILE_SIZE
      ghostSprite2!.height   = TILE_SIZE
      ghostSprite2!.tint     = tint
      ghostSprite2!.alpha    = GHOST_ALPHA
      ghostSprite2!.x        = t2x * TILE_SIZE
      ghostSprite2!.y        = t2y * TILE_SIZE
      ghostSprite2!.visible  = true
    } else if (selectedTowerType === TowerType.DATA_SPIKE) {
      // §5.3.2 — show tower tile + cone of affected tiles at L1 range.
      // Ghost is always placed at L1, range can only grow on upgrade.
      lastValid = canPlaceTower(grid, gatewayTiles, hoveredX, hoveredY)
      const color = lastValid ? VALID_COLOR : INVALID_COLOR
      const tint  = lastValid ? GHOST_TINT_VALID : GHOST_TINT_INVALID
      const levelIdx = Math.max(0, Math.min(9, placementLevel - 1))
      const range = DATA_SPIKE_RANGE[levelIdx] ?? 2
      // Cone tile highlights (drawn under the sprite)
      for (let cy = hoveredY - range; cy <= hoveredY + range; cy++) {
        for (let cx = hoveredX - range; cx <= hoveredX + range; cx++) {
          if (cx < 0 || cy < 0 || cx >= GRID_SIZE || cy >= GRID_SIZE) continue
          if (!inDataSpikeCone(cx, cy, hoveredX, hoveredY, placementFacing, range)) continue
          _drawTile(ghostGfx, cx, cy, color, 0.22, 0.5)
        }
      }
      // Tower tile as sprite — rotated around tile centre
      ghostSprite!.texture = getTowerTexture(TowerType.DATA_SPIKE)
      ghostSprite!.width   = TILE_SIZE
      ghostSprite!.height  = TILE_SIZE
      ghostSprite!.anchor.set(0.5)
      ghostSprite!.rotation = DIR_ROTATION[placementFacing] ?? 0
      ghostSprite!.tint    = tint
      ghostSprite!.alpha   = GHOST_ALPHA
      ghostSprite!.x       = hoveredX * TILE_SIZE + TILE_SIZE / 2
      ghostSprite!.y       = hoveredY * TILE_SIZE + TILE_SIZE / 2
      ghostSprite!.visible = true
    } else {
      // Standard single-tile ghost
      lastValid = canPlaceTower(grid, gatewayTiles, hoveredX, hoveredY)
      const levelIdx = Math.max(0, Math.min(9, placementLevel - 1))

      // Range overlay — draw before the ghost tile so it sits underneath
      const tint  = lastValid ? GHOST_TINT_VALID : GHOST_TINT_INVALID

      if (selectedTowerType === TowerType.ICE_WALL) {
        // §5.1.2 — Chebyshev 1 aura, constant across all levels
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, 1, RANGE_COLORS[TowerType.ICE_WALL]!, 0.07, 0.45)

      } else if (selectedTowerType === TowerType.DAEMON_TURRET) {
        const range = DAEMON_TURRET_RANGE[levelIdx] ?? 3
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, range, RANGE_COLORS[TowerType.DAEMON_TURRET]!, 0.07, 0.45)

      } else if (selectedTowerType === TowerType.ICE_SNIPER) {
        // §5.5.2 — fixed min/max range, not level-dependent
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, ICE_SNIPER_MAX_RANGE[levelIdx], RANGE_COLORS[TowerType.ICE_SNIPER]!, 0.05, 0.45)
        // Dead-zone inner ring in red
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, ICE_SNIPER_MIN_RANGE[levelIdx] - 1, 0xff4444, 0.08, 0.4)

      } else if (selectedTowerType === TowerType.PING) {
        const range = PING_TOWER_RANGE[levelIdx] ?? 3
        _drawRangeCircle(ghostGfx, hoveredX, hoveredY, range, RANGE_COLORS[TowerType.PING]!, 0.07, 0.45)
      }

      // Tower tile as sprite (on top of range overlay)
      ghostSprite!.texture = getTowerTexture(selectedTowerType as TowerType)
      ghostSprite!.width   = TILE_SIZE
      ghostSprite!.height  = TILE_SIZE
      ghostSprite!.tint    = tint
      ghostSprite!.alpha   = GHOST_ALPHA
      if (ROTATING_GHOST_TYPES.has(selectedTowerType as TowerType)) {
        ghostSprite!.anchor.set(0.5)
        ghostSprite!.rotation = DIR_ROTATION[placementFacing] ?? 0
        ghostSprite!.x = hoveredX * TILE_SIZE + TILE_SIZE / 2
        ghostSprite!.y = hoveredY * TILE_SIZE + TILE_SIZE / 2
      } else {
        ghostSprite!.anchor.set(0)
        ghostSprite!.rotation = 0
        ghostSprite!.x = hoveredX * TILE_SIZE
        ghostSprite!.y = hoveredY * TILE_SIZE
      }
      ghostSprite!.visible = true
    }
  }

  ghostGfx.visible = true
}
