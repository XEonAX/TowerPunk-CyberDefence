/**
 * Tower Layer — Tech.md §6.2, Rulebook §5
 *
 * Renders towers (colored rectangles), the Core, and Blackwall Gateways.
 * Uses a Graphics object pool — zero allocations during active gameplay.
 */

import { Graphics, Container } from 'pixi.js'
import type { World } from '@game/ecs/world'
import * as C from '@game/ecs/component'
import { TILE_SIZE } from '../camera'
import {
  DATA_SPIKE_RANGE,
  DAEMON_TURRET_RANGE,
  ICE_SNIPER_MIN_RANGE,
  ICE_SNIPER_MAX_RANGE,
} from '@game/constants'

/** Rulebook §5 — placeholder colors per tower type */
const TOWER_COLORS: Record<number, number> = {
  [C.TowerType.ICE_WALL]:     0x4488ff, // blue
  [C.TowerType.FIREWALL]:     0xff8800, // orange
  [C.TowerType.DATA_SPIKE]:   0xff00ff, // magenta
  [C.TowerType.DAEMON_TURRET]:0x00ff88, // green
  [C.TowerType.ICE_SNIPER]:   0xaaddff, // light blue
  [C.TowerType.BLACKWALL]:    0xff0044, // red
  [C.TowerType.PING]:         0xffdd00, // yellow
  [C.TowerType.HARVESTER]:    0x44ff44, // bright green
}

const DISABLED_COLOR = 0x444444
const MAX_ENTITIES = 4096

// Tower + gateway object pool
const pool: Graphics[] = []
const active = new Map<number, Graphics>() // eid → Graphics

// Dedicated Graphics for the Core (not a tower, rendered separately)
let coreGfx: Graphics | null = null

// Dedicated Graphics for range circle overlay
let rangeGfx: Graphics | null = null

function acquire(): Graphics {
  return pool.pop() ?? new Graphics()
}

function release(g: Graphics): void {
  g.clear()
  g.visible = false
  pool.push(g)
}

/**
 * Return the attack range in tiles for a tower, or null if it has no range.
 * ICE_SNIPER returns [min, max] as a tuple.
 */
function getTowerRange(world: World, eid: number): number | [number, number] | null {
  const towerType = world.towerType[eid]
  const level = Math.max(0, Math.min(9, (world.towerLevel[eid] ?? 1) - 1))
  switch (towerType) {
    case C.TowerType.DATA_SPIKE:   return DATA_SPIKE_RANGE[level] ?? 2
    case C.TowerType.DAEMON_TURRET: return DAEMON_TURRET_RANGE[level] ?? 1
    case C.TowerType.ICE_SNIPER:   return [ICE_SNIPER_MIN_RANGE, ICE_SNIPER_MAX_RANGE]
    default: return null
  }
}

/**
 * Update tower layer each render frame.
 * @param container   The PixiJS Container for this layer.
 * @param world       Current ECS world (read-only in renderer).
 * @param _alpha      Interpolation factor — towers don't interpolate position.
 * @param selectedEid Entity ID of the currently selected tower, or null.
 */
export function updateTowerLayer(container: Container, world: World, _alpha: number, selectedEid: number | null = null): void {
  // Release Graphics for removed towers / gateways
  const toRelease: number[] = []
  for (const [eid, g] of active) {
    const mask = world.bitmask[eid]
    const stillValid = ((mask & C.TOWER) || (mask & C.GATEWAY)) && !(mask & C.PENDING_REMOVAL)
    if (!stillValid) {
      container.removeChild(g)
      release(g)
      toRelease.push(eid)
    }
  }
  for (const eid of toRelease) active.delete(eid)

  // Render towers
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.TOWER)) continue
    if (mask & C.PENDING_REMOVAL) continue

    let g = active.get(eid)
    if (!g) {
      g = acquire()
      g.visible = true
      container.addChild(g)
      active.set(eid, g)
    }

    const towerType = world.towerType[eid]
    const isDisabled = world.towerDisableTicks[eid] > 0
    const color = isDisabled ? DISABLED_COLOR : (TOWER_COLORS[towerType] ?? 0xffffff)

    const pad = 1
    g.clear()
    g.setFillStyle({ color, alpha: 0.85 })
    g.rect(pad, pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2)
    g.fill()

    g.x = world.posX[eid] * TILE_SIZE
    g.y = world.posY[eid] * TILE_SIZE
  }

  // Render Blackwall Gateways (§9.2)
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.GATEWAY)) continue
    if (mask & C.PENDING_REMOVAL) continue

    let g = active.get(eid)
    if (!g) {
      g = acquire()
      g.visible = true
      container.addChild(g)
      active.set(eid, g)
    }

    const hpFrac = world.gatewayMaxHp[eid] > 0
      ? Math.max(0, world.gatewayHp[eid] / world.gatewayMaxHp[eid])
      : 1
    const gatewayColor = hpFrac > 0.5 ? 0xcc0022 : 0xff4400 // Rulebook §9 Blackwall color

    g.clear()
    g.setFillStyle({ color: gatewayColor, alpha: 0.9 })
    g.rect(0, 0, TILE_SIZE, TILE_SIZE)
    g.fill()
    g.setStrokeStyle({ width: 1, color: 0xff6666, alpha: 1 })
    g.rect(0, 0, TILE_SIZE, TILE_SIZE)
    g.stroke()

    g.x = world.gatewayX[eid] * TILE_SIZE
    g.y = world.gatewayY[eid] * TILE_SIZE
  }

  // Render Core (§3) — not a tower, uses C.POSITION | C.HEALTH
  const ceid = world.coreEid
  if (ceid > 0) {
    if (!coreGfx) {
      coreGfx = new Graphics()
      coreGfx.visible = true
      container.addChild(coreGfx)
    }

    const hpFrac = world.healthMax[ceid] > 0
      ? Math.max(0, world.healthCurrent[ceid] / world.healthMax[ceid])
      : 1
    const coreColor = hpFrac > 0.6 ? 0x0088ff : hpFrac > 0.3 ? 0xffaa00 : 0xff2244

    coreGfx.clear()
    coreGfx.setFillStyle({ color: coreColor, alpha: 0.9 })
    coreGfx.rect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2)
    coreGfx.fill()
    coreGfx.setStrokeStyle({ width: 1, color: 0x00ccff, alpha: 1 })
    coreGfx.rect(0, 0, TILE_SIZE, TILE_SIZE)
    coreGfx.stroke()

    coreGfx.x = world.posX[ceid] * TILE_SIZE
    coreGfx.y = world.posY[ceid] * TILE_SIZE
  }

  // Range circle overlay for selected tower
  if (!rangeGfx) {
    rangeGfx = new Graphics()
    container.addChild(rangeGfx)
  }
  rangeGfx.clear()

  if (
    selectedEid !== null &&
    selectedEid > 0 &&
    (world.bitmask[selectedEid] & C.TOWER) !== 0 &&
    (world.bitmask[selectedEid] & C.PENDING_REMOVAL) === 0
  ) {
    const cx = (world.posX[selectedEid] + 0.5) * TILE_SIZE
    const cy = (world.posY[selectedEid] + 0.5) * TILE_SIZE
    const range = getTowerRange(world, selectedEid)

    if (range !== null) {
      if (Array.isArray(range)) {
        // ICE_SNIPER — min dead-zone (dashed inner) + max range circle
        const [minR, maxR] = range
        // Outer range
        rangeGfx.setStrokeStyle({ width: 1, color: 0xaaddff, alpha: 0.6 })
        rangeGfx.circle(cx, cy, (maxR + 0.5) * TILE_SIZE)
        rangeGfx.stroke()
        // Inner dead-zone
        rangeGfx.setStrokeStyle({ width: 1, color: 0xff4444, alpha: 0.45 })
        rangeGfx.circle(cx, cy, (minR - 0.5) * TILE_SIZE)
        rangeGfx.stroke()
        // Dim fill between min and max
        rangeGfx.setFillStyle({ color: 0xaaddff, alpha: 0.05 })
        rangeGfx.circle(cx, cy, (maxR + 0.5) * TILE_SIZE)
        rangeGfx.fill()
      } else {
        // Standard range circle
        const towerColor = TOWER_COLORS[world.towerType[selectedEid]] ?? 0xffffff
        rangeGfx.setFillStyle({ color: towerColor, alpha: 0.07 })
        rangeGfx.circle(cx, cy, (range + 0.5) * TILE_SIZE)
        rangeGfx.fill()
        rangeGfx.setStrokeStyle({ width: 1, color: towerColor, alpha: 0.55 })
        rangeGfx.circle(cx, cy, (range + 0.5) * TILE_SIZE)
        rangeGfx.stroke()
      }
    }
  }
}

/** @internal — exported for testing only */
export function _clearTowerPool(): void {
  active.clear()
  pool.length = 0
  coreGfx = null
  rangeGfx = null
}
