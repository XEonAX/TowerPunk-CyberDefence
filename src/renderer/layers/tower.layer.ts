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
  PING_TOWER_RANGE,
} from '@game/constants'
import { chebyshev, inDataSpikeCone } from '@game/systems/targeting.system'
import { GRID_SIZE } from '@game/constants'

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

// Dedicated Graphics for Firewall pair connector lines
let firewallLineGfx: Graphics | null = null

// Dedicated Graphics for range circle overlay
let rangeGfx: Graphics | null = null

// ---------------------------------------------------------------------------
// Projectile rendering (Daemon Turret shots)
// ---------------------------------------------------------------------------

interface Projectile {
  fromX: number; fromY: number
  toX: number;   toY: number
  ticksLeft: number; maxTicks: number
  color: number
}

/** Travelling projectiles (render-only, never mutates ECS) */
const activeProjectiles: Projectile[] = []
/** Frames a shot-beam stays visible before fully fading */
const PROJ_TICKS = 8
/**
 * Last-seen targetingCooldown per tower eid.
 * A shot fires when cooldown jumps UP (damageSystem resets it after firing).
 */
const prevCooldown = new Float32Array(MAX_ENTITIES)
/** Dedicated Graphics for drawing projectile dots */
let projectileGfx: Graphics | null = null

/**
 * Find the closest enemy to (tx,ty) within Chebyshev range — render-only,
 * mirrors acquireDaemonTurretTarget without mutating state.
 */
function findClosestEnemyInRange(world: World, tx: number, ty: number, range: number): number {
  let bestEid = 0
  let bestDist = Infinity
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY) || (mask & C.PENDING_REMOVAL) || (mask & C.SPAWN_IMMUNITY)) continue
    const d = chebyshev(world.tilePosX[eid], world.tilePosY[eid], tx, ty)
    if (d <= range && d < bestDist) { bestDist = d; bestEid = eid }
  }
  return bestEid
}

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
    // DATA_SPIKE uses a directional cone — no circle overlay (§5.3.2)
    case C.TowerType.DAEMON_TURRET: return DAEMON_TURRET_RANGE[level] ?? 1
    case C.TowerType.ICE_SNIPER:    return [ICE_SNIPER_MIN_RANGE, ICE_SNIPER_MAX_RANGE]
    case C.TowerType.PING:          return PING_TOWER_RANGE[level] ?? 3
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

  // Draw orange connector lines between placed Firewall pairs (§5.2.1)
  if (!firewallLineGfx) {
    firewallLineGfx = new Graphics()
    container.addChild(firewallLineGfx)
  }
  firewallLineGfx.clear()
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.FIREWALL_LINK)) continue
    if (mask & C.PENDING_REMOVAL) continue
    const partner = world.firewallPartner[eid]
    // Draw once per pair — lower eid wins
    if (eid >= partner) continue
    const partnerMask = world.bitmask[partner]
    if (partnerMask & C.PENDING_REMOVAL) continue
    const x1 = (world.posX[eid]     + 0.5) * TILE_SIZE
    const y1 = (world.posY[eid]     + 0.5) * TILE_SIZE
    const x2 = (world.posX[partner] + 0.5) * TILE_SIZE
    const y2 = (world.posY[partner] + 0.5) * TILE_SIZE
    // Glow outer line
    firewallLineGfx.setStrokeStyle({ width: 4, color: 0xff8800, alpha: 0.25 })
    firewallLineGfx.moveTo(x1, y1)
    firewallLineGfx.lineTo(x2, y2)
    firewallLineGfx.stroke()
    // Core bright line
    firewallLineGfx.setStrokeStyle({ width: 2, color: 0xff8800, alpha: 0.85 })
    firewallLineGfx.moveTo(x1, y1)
    firewallLineGfx.lineTo(x2, y2)
    firewallLineGfx.stroke()
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

  // Spawn projectiles for newly-fired Daemon Turret shots
  // Detection: damageSystem clears targetingTarget same tick it fires, but it also
  // resets targetingCooldown to full. A cooldown jump up = shot just fired.
  if (!projectileGfx) {
    projectileGfx = new Graphics()
    container.addChild(projectileGfx)
  }
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.TOWER)) continue
    if (world.towerType[eid] !== C.TowerType.DAEMON_TURRET) continue
    if (mask & C.PENDING_REMOVAL) { prevCooldown[eid] = 0; continue }

    const currentCooldown = world.targetingCooldown[eid]
    const prev = prevCooldown[eid]
    // Shot fired when cooldown jumps up from a lower value
    if (currentCooldown > prev && prev >= 0) {
      const tx = world.posX[eid] | 0
      const ty = world.posY[eid] | 0
      const level = Math.max(0, Math.min(9, (world.towerLevel[eid] ?? 1) - 1))
      const range = DAEMON_TURRET_RANGE[level] ?? 3
      const targetEid = findClosestEnemyInRange(world, tx, ty, range)
      if (targetEid > 0) {
        activeProjectiles.push({
          fromX: (world.posX[eid] + 0.5) * TILE_SIZE,
          fromY: (world.posY[eid] + 0.5) * TILE_SIZE,
          toX: (world.tilePosX[targetEid] + 0.5) * TILE_SIZE,
          toY: (world.tilePosY[targetEid] + 0.5) * TILE_SIZE,
          ticksLeft: PROJ_TICKS,
          maxTicks: PROJ_TICKS,
          color: TOWER_COLORS[C.TowerType.DAEMON_TURRET] ?? 0x00ff88,
        })
      }
    }
    prevCooldown[eid] = currentCooldown
  }

  // Advance and draw all active beam traces
  projectileGfx.clear()
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const p = activeProjectiles[i]
    const alpha = p.ticksLeft / p.maxTicks  // 1 (fresh) → 0 (faded)
    // Core beam line
    projectileGfx.setStrokeStyle({ width: 2, color: p.color, alpha })
    projectileGfx.moveTo(p.fromX, p.fromY)
    projectileGfx.lineTo(p.toX, p.toY)
    projectileGfx.stroke()
    // Bright core highlight
    projectileGfx.setStrokeStyle({ width: 1, color: 0xffffff, alpha: alpha * 0.6 })
    projectileGfx.moveTo(p.fromX, p.fromY)
    projectileGfx.lineTo(p.toX, p.toY)
    projectileGfx.stroke()
    // Impact dot at target end
    projectileGfx.setFillStyle({ color: p.color, alpha })
    projectileGfx.circle(p.toX, p.toY, 3)
    projectileGfx.fill()
    p.ticksLeft--
    if (p.ticksLeft <= 0) activeProjectiles.splice(i, 1)
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
    const towerType = world.towerType[selectedEid]
    const level = Math.max(0, Math.min(9, (world.towerLevel[selectedEid] ?? 1) - 1))

    if (towerType === C.TowerType.DATA_SPIKE) {
      // §5.3.2 — per-tile highlight for the exact cone shape at current level
      const range = DATA_SPIKE_RANGE[level] ?? 2
      const tx = world.posX[selectedEid] | 0
      const ty = world.posY[selectedEid] | 0
      const facing = world.towerFacing[selectedEid]
      const color = TOWER_COLORS[C.TowerType.DATA_SPIKE] ?? 0xff00ff
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          const tileX = tx + dx
          const tileY = ty + dy
          if (tileX < 0 || tileY < 0 || tileX >= GRID_SIZE || tileY >= GRID_SIZE) continue
          if (!inDataSpikeCone(tileX, tileY, tx, ty, facing, range)) continue
          const px = tileX * TILE_SIZE
          const py = tileY * TILE_SIZE
          rangeGfx.setFillStyle({ color, alpha: 0.15 })
          rangeGfx.rect(px, py, TILE_SIZE, TILE_SIZE)
          rangeGfx.fill()
          rangeGfx.setStrokeStyle({ width: 1, color, alpha: 0.5 })
          rangeGfx.rect(px, py, TILE_SIZE, TILE_SIZE)
          rangeGfx.stroke()
        }
      }
    } else {
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
          const towerColor = TOWER_COLORS[towerType] ?? 0xffffff
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
}

/** @internal — exported for testing only */
export function _clearTowerPool(): void {
  active.clear()
  pool.length = 0
  coreGfx = null
  firewallLineGfx = null
  rangeGfx = null
  projectileGfx = null
  activeProjectiles.length = 0
  prevCooldown.fill(0)
}
