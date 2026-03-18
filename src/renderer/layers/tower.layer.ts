/**
 * Tower Layer — Tech.md §6.2, Rulebook §5
 *
 * Renders towers (colored rectangles), the Core, and Blackwall Gateways.
 * Uses a Graphics object pool — zero allocations during active gameplay.
 */

import { Graphics, Container, Sprite } from 'pixi.js'
import { getTowerTexture } from '../towerTextures'
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
import { inDataSpikeCone } from '@game/systems/targeting.system'
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

/** Tint applied to tower sprites when disabled by Saboteur aura (§7.7). */
const DISABLED_TINT = 0x555555
const MAX_ENTITIES = 4096

// Active sprites for placed towers indexed by eid.
// Towers are placed/removed rarely, so a simple map without a pool is sufficient.
const active = new Map<number, Sprite>()   // eid → Sprite (towers only)

// Active Graphics for Blackwall Gateways — rendered as colored rects (no art asset yet).
const activeGateways = new Map<number, Graphics>() // eid → Graphics

// Dedicated Graphics for the Core (not a tower, rendered separately)
let coreGfx: Graphics | null = null

// Dedicated Graphics for Firewall pair connector lines
let firewallLineGfx: Graphics | null = null

// Dedicated Graphics for Blackwall Tower → Gateway connector lines
let blackwallLineGfx: Graphics | null = null

// Graphics for range circle overlay (rendered on top of tower sprites)
let rangeGfx: Graphics | null = null

// ---------------------------------------------------------------------------
// Projectile beam rendering — reads PROJECTILE entities spawned by damageSystem
// ---------------------------------------------------------------------------

/** Dedicated Graphics for drawing shot beams (§5.4.2, §5.5.2). */
let projectileGfx: Graphics | null = null

/** Dedicated Graphics for drawing Data Spike cone wave FX (§5.3.2). */
let coneFxGfx: Graphics | null = null

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
 * @param alpha       Sub-tick interpolation factor [0,1] — used to smooth projectile/cone FX fades.
 * @param selectedEid Entity ID of the currently selected tower, or null.
 */
export function updateTowerLayer(container: Container, world: World, alpha: number, selectedEid: number | null = null): void {
  // Destroy sprites for towers that have been removed
  const toRelease: number[] = []
  for (const [eid, sprite] of active) {
    const mask = world.bitmask[eid]
    if (!(mask & C.TOWER) || (mask & C.PENDING_REMOVAL)) {
      container.removeChild(sprite)
      sprite.destroy()
      toRelease.push(eid)
    }
  }
  for (const eid of toRelease) active.delete(eid)

  // Release Graphics for gateways that have been removed
  const toReleaseGw: number[] = []
  for (const [eid, g] of activeGateways) {
    const mask = world.bitmask[eid]
    if (!(mask & C.GATEWAY) || (mask & C.PENDING_REMOVAL)) {
      container.removeChild(g)
      g.destroy()
      toReleaseGw.push(eid)
    }
  }
  for (const eid of toReleaseGw) activeGateways.delete(eid)

  // Render towers
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.TOWER)) continue
    if (mask & C.PENDING_REMOVAL) continue

    const towerType = world.towerType[eid]
    let sprite = active.get(eid)
    if (!sprite) {
      sprite = new Sprite(getTowerTexture(towerType))
      sprite.width  = TILE_SIZE
      sprite.height = TILE_SIZE
      sprite.visible = true
      container.addChild(sprite)
      active.set(eid, sprite)
    }

    const isDisabled = world.towerDisableTicks[eid] > 0
    sprite.tint = isDisabled ? DISABLED_TINT : 0xffffff
    sprite.x = world.posX[eid] * TILE_SIZE
    sprite.y = world.posY[eid] * TILE_SIZE
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

  // Draw red connector lines between each Blackwall Tower and its adjacent gateways (§5.6.1)
  if (!blackwallLineGfx) {
    blackwallLineGfx = new Graphics()
    container.addChild(blackwallLineGfx)
  }
  blackwallLineGfx.clear()
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.BLACKWALL_TOWER)) continue
    if (mask & C.PENDING_REMOVAL) continue
    const bwX = world.posX[eid]
    const bwY = world.posY[eid]
    for (let i = 0; i < world.activeGatewayCount; i++) {
      const gwEid = world.activeGateways[i]
      if (world.bitmask[gwEid] & C.PENDING_REMOVAL) continue
      const dx = Math.abs(bwX - world.gatewayX[gwEid])
      const dy = Math.abs(bwY - world.gatewayY[gwEid])
      if (Math.max(dx, dy) > 1) continue
      const x1 = (bwX + 0.5) * TILE_SIZE
      const y1 = (bwY + 0.5) * TILE_SIZE
      const x2 = (world.gatewayX[gwEid] + 0.5) * TILE_SIZE
      const y2 = (world.gatewayY[gwEid] + 0.5) * TILE_SIZE
      // Glow outer line
      blackwallLineGfx.setStrokeStyle({ width: 4, color: 0xff0044, alpha: 0.25 })
      blackwallLineGfx.moveTo(x1, y1)
      blackwallLineGfx.lineTo(x2, y2)
      blackwallLineGfx.stroke()
      // Core bright line
      blackwallLineGfx.setStrokeStyle({ width: 2, color: 0xff0044, alpha: 0.85 })
      blackwallLineGfx.moveTo(x1, y1)
      blackwallLineGfx.lineTo(x2, y2)
      blackwallLineGfx.stroke()
    }
  }

  // Render Blackwall Gateways (§9.2)
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.GATEWAY)) continue
    if (mask & C.PENDING_REMOVAL) continue

    let g = activeGateways.get(eid)
    if (!g) {
      g = new Graphics()
      g.visible = true
      container.addChild(g)
      activeGateways.set(eid, g)
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

  // Draw Data Spike cone FX (§5.3.2)
  // A single leading stroke sweeps smoothly outward at the continuous progress position.
  // Cardinal: one widening horizontal/vertical stroke perpendicular to the axis.
  // Diagonal: one L-shape at the current reach.
  if (!coneFxGfx) {
    coneFxGfx = new Graphics()
    container.addChild(coneFxGfx)
  }
  coneFxGfx.clear()
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    if (!(world.bitmask[eid] & C.CONE_FX)) continue
    const tx        = world.projFromX[eid] | 0
    const ty        = world.projFromY[eid] | 0
    const facing    = world.projFacing[eid]
    const range     = world.projRange[eid]
    const color     = TOWER_COLORS[world.projTowerType[eid]] ?? 0xff00ff
    const maxTicks  = world.projMaxTicks[eid]
    const ticksLeft = world.projTicksLeft[eid]
    // Interpolate ticksLeft toward (ticksLeft - 1) using sub-tick alpha for fluid animation
    const interpLeft = ticksLeft - alpha
    const fade      = maxTicks > 0 ? interpLeft / maxTicks : 1
    const progress  = maxTicks > 1 ? (maxTicks - interpLeft) / (maxTicks - 1) : 1
    // Continuous pixel reach from tower center
    const r = progress * range * TILE_SIZE

    const T = TILE_SIZE
    const pc = (n: number): number => (n + 0.5) * T
    const ox = pc(tx)
    const oy = pc(ty)

    const seg = (x0: number, y0: number, x1: number, y1: number): void => {
      coneFxGfx!.setStrokeStyle({ width: 4, color, alpha: fade * 0.3 })
      coneFxGfx!.moveTo(x0, y0); coneFxGfx!.lineTo(x1, y1); coneFxGfx!.stroke()
      coneFxGfx!.setStrokeStyle({ width: 2, color, alpha: fade * 0.85 })
      coneFxGfx!.moveTo(x0, y0); coneFxGfx!.lineTo(x1, y1); coneFxGfx!.stroke()
      coneFxGfx!.setStrokeStyle({ width: 1, color: 0xffffff, alpha: fade * 0.55 })
      coneFxGfx!.moveTo(x0, y0); coneFxGfx!.lineTo(x1, y1); coneFxGfx!.stroke()
    }

    switch (facing) {
      case C.Dir.N: seg(ox - r, oy - r, ox + r, oy - r); break
      case C.Dir.S: seg(ox - r, oy + r, ox + r, oy + r); break
      case C.Dir.E: seg(ox + r, oy - r, ox + r, oy + r); break
      case C.Dir.W: seg(ox - r, oy - r, ox - r, oy + r); break
      case C.Dir.NE:
        seg(ox,     oy - r, ox + r, oy - r)  // top edge →
        seg(ox + r, oy,     ox + r, oy - r)  // right edge ↑
        break
      case C.Dir.SE:
        seg(ox,     oy + r, ox + r, oy + r)  // bottom edge →
        seg(ox + r, oy,     ox + r, oy + r)  // right edge ↓
        break
      case C.Dir.SW:
        seg(ox,     oy + r, ox - r, oy + r)  // bottom edge ←
        seg(ox - r, oy,     ox - r, oy + r)  // left edge ↓
        break
      case C.Dir.NW:
        seg(ox,     oy - r, ox - r, oy - r)  // top edge ←
        seg(ox - r, oy,     ox - r, oy - r)  // left edge ↑
        break
    }
  }

  // Draw shot beams for ECS PROJECTILE entities (§5.4.2 Daemon Turret, §5.5.2 ICE Sniper)
  if (!projectileGfx) {
    projectileGfx = new Graphics()
    container.addChild(projectileGfx)
  }
  projectileGfx.clear()
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    if (!(world.bitmask[eid] & C.PROJECTILE)) continue
    // Interpolate fade using sub-tick alpha for fluid animation
    const beamAlpha = world.projMaxTicks[eid] > 0
      ? (world.projTicksLeft[eid] - alpha) / world.projMaxTicks[eid]
      : 1
    const fromPx = (world.projFromX[eid] + 0.5) * TILE_SIZE
    const fromPy = (world.projFromY[eid] + 0.5) * TILE_SIZE
    const toPx   = (world.projToX[eid]   + 0.5) * TILE_SIZE
    const toPy   = (world.projToY[eid]   + 0.5) * TILE_SIZE
    const color  = TOWER_COLORS[world.projTowerType[eid]] ?? 0xffffff
    // Outer glow line
    projectileGfx.setStrokeStyle({ width: 2, color, alpha: beamAlpha })
    projectileGfx.moveTo(fromPx, fromPy)
    projectileGfx.lineTo(toPx, toPy)
    projectileGfx.stroke()
    // Bright core highlight
    projectileGfx.setStrokeStyle({ width: 1, color: 0xffffff, alpha: beamAlpha * 0.6 })
    projectileGfx.moveTo(fromPx, fromPy)
    projectileGfx.lineTo(toPx, toPy)
    projectileGfx.stroke()
    // Impact dot at target end
    projectileGfx.setFillStyle({ color, alpha: beamAlpha })
    projectileGfx.circle(toPx, toPy, 3)
    projectileGfx.fill()
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
  for (const sprite of active.values()) sprite.destroy()
  active.clear()
  for (const g of activeGateways.values()) g.destroy()
  activeGateways.clear()
  coreGfx = null
  firewallLineGfx = null
  blackwallLineGfx = null
  rangeGfx = null
  projectileGfx = null
  coneFxGfx = null
}
