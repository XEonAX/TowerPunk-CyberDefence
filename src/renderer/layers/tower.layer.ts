/**
 * Tower Layer — Tech.md §6.2, Rulebook §5
 *
 * Renders towers (colored rectangles), the Core, and Blackwall Gateways.
 * Uses a Graphics object pool — zero allocations during active gameplay.
 */

import { Graphics, Container, Sprite } from 'pixi.js'
import { getTowerTexture, getGatewayTexture } from '../towerTextures'
import type { World } from '@game/ecs/world'
import * as C from '@game/ecs/component'
import { TILE_SIZE, shakeCamera } from '../camera'
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
  [C.TowerType.ICE_WALL]: 0x4488ff, // blue
  [C.TowerType.FIREWALL]: 0xff8800, // orange
  [C.TowerType.DATA_SPIKE]: 0xff00ff, // magenta
  [C.TowerType.DAEMON_TURRET]: 0x00ff88, // green
  [C.TowerType.ICE_SNIPER]: 0xaaddff, // light blue
  [C.TowerType.BLACKWALL]: 0xff0044, // red
  [C.TowerType.PING]: 0xffdd00, // yellow
  [C.TowerType.HARVESTER]: 0x44ff44, // bright green
}

/**
 * Converts a Dir enum value to a PixiJS rotation angle in radians.
 * All tower art assets face North (up) by default.
 * PixiJS rotation: 0 = no rotation (up), positive = clockwise.
 */
const DIR_ROTATION: Record<number, number> = {
  [C.Dir.N]: 0,
  [C.Dir.S]: Math.PI,
  [C.Dir.E]: Math.PI / 2,
  [C.Dir.W]: -Math.PI / 2,
  [C.Dir.NE]: Math.PI / 4,
  [C.Dir.SE]: 3 * Math.PI / 4,
  [C.Dir.SW]: -3 * Math.PI / 4,
  [C.Dir.NW]: -Math.PI / 4,
}

/** Tower types whose sprites rotate. Uses anchor(0.5) and center-based positioning. */
const ROTATING_TOWERS = new Set([
  C.TowerType.DATA_SPIKE,
  C.TowerType.DAEMON_TURRET,
  C.TowerType.ICE_SNIPER,
])

/** Tint applied to tower sprites when disabled by Saboteur aura (§7.7). */
const DISABLED_TINT = 0x555555
const MAX_ENTITIES = 4096

// Active sprites for placed towers indexed by eid.
// Towers are placed/removed rarely, so a simple map without a pool is sufficient.
const active = new Map<number, Sprite>()   // eid → Sprite (towers only)

// Active Sprites for Blackwall Gateways — rendered using BlackwallGateway.png (§9.2).
const activeGateways = new Map<number, Sprite>() // eid → Sprite

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

// ---------------------------------------------------------------------------
// Muzzle flash, impact flare, Core glow, Gateway pulse
// ---------------------------------------------------------------------------

interface Flash { x: number; y: number; frames: number; color: number }

/** Short muzzle-flash at the tower origin when a projectile/cone_fx fires. */
const muzzleFlashes: Flash[] = []
/** Short impact flare at the projectile target when the beam expires. */
const impactFlashes: Flash[] = []

/** IDs visible last frame — used to detect newly-fired projectiles. */
const prevProjectileEids = new Set<number>()
const prevConeFxEids = new Set<number>()
/** Cache target & color while a projectile lives so we can draw the impact flare on expiry. */
const projTargetCache = new Map<number, { toX: number; toY: number; color: number }>()

/** Dedicated Graphics for muzzle/impact flashes. */
let flashGfx: Graphics | null = null

/** Pulsing beacon glow around the Core tile. */
let coreGlowGfx: Graphics | null = null
/** Last observed Core HP — used to trigger screen shake on damage. */
let lastCoreHp = -1

/** Expanding ring pulses radiating from active Blackwall Gateways. */
let gatewayPulseGfx: Graphics | null = null

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
    case C.TowerType.ICE_SNIPER: return [ICE_SNIPER_MIN_RANGE[level] ?? 3, ICE_SNIPER_MAX_RANGE[level] ?? 5]
    case C.TowerType.PING: return PING_TOWER_RANGE[level] ?? 3
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

  // Release Sprites for gateways that have been removed
  const toReleaseGw: number[] = []
  for (const [eid, sprite] of activeGateways) {
    const mask = world.bitmask[eid]
    if (!(mask & C.GATEWAY) || (mask & C.PENDING_REMOVAL)) {
      if (mask & C.PENDING_REMOVAL) shakeCamera(5, 15)  // gateway destroyed
      container.removeChild(sprite)
      sprite.destroy()
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
      sprite.width = TILE_SIZE
      sprite.height = TILE_SIZE
      // Rotating towers need center anchor so rotation pivots around the tile centre
      if (ROTATING_TOWERS.has(towerType)) {
        sprite.anchor.set(0.5)
      }
      sprite.visible = true
      container.addChild(sprite)
      active.set(eid, sprite)
    }

    const isDisabled = world.towerDisableTicks[eid] > 0
    sprite.tint = isDisabled ? DISABLED_TINT : 0xffffff

    if (ROTATING_TOWERS.has(towerType)) {
      // Centre-based position (anchor is 0.5)
      sprite.x = (world.posX[eid] + 0.5) * TILE_SIZE
      sprite.y = (world.posY[eid] + 0.5) * TILE_SIZE
      if (towerType === C.TowerType.DATA_SPIKE) {
        // Fixed facing set at placement time (Dir enum)
        sprite.rotation = DIR_ROTATION[world.towerFacing[eid]] ?? 0
      } else {
        // Daemon Turret / ICE Sniper — continuously updated by targetingSystem
        sprite.rotation = world.rotationAngle[eid]
      }
    } else {
      // Non-rotating towers — top-left anchor, no rotation
      sprite.x = world.posX[eid] * TILE_SIZE
      sprite.y = world.posY[eid] * TILE_SIZE
    }
  } // end tower render loop

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
    const x1 = (world.posX[eid] + 0.5) * TILE_SIZE
    const y1 = (world.posY[eid] + 0.5) * TILE_SIZE
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

    let sprite = activeGateways.get(eid)
    if (!sprite) {
      sprite = new Sprite(getGatewayTexture())
      sprite.width = TILE_SIZE
      sprite.height = TILE_SIZE
      sprite.visible = true
      container.addChild(sprite)
      activeGateways.set(eid, sprite)
    }

    // Tint the gateway sprite based on remaining HP (§9.2) — full health = no tint, low health = orange
    const hpFrac = world.gatewayMaxHp[eid] > 0
      ? Math.max(0, world.gatewayHp[eid] / world.gatewayMaxHp[eid])
      : 1
    sprite.tint = hpFrac > 0.5 ? 0xffffff : 0xff4400

    sprite.x = world.gatewayX[eid] * TILE_SIZE
    sprite.y = world.gatewayY[eid] * TILE_SIZE
  }

  // Gateway pulse rings — radiating outward from each active gateway
  if (!gatewayPulseGfx) {
    gatewayPulseGfx = new Graphics()
    container.addChild(gatewayPulseGfx)
  }
  gatewayPulseGfx.clear()
  const gtime = performance.now() / 1000
  for (let i = 0; i < world.activeGatewayCount; i++) {
    const gwEid = world.activeGateways[i]
    if (world.bitmask[gwEid] & C.PENDING_REMOVAL) continue
    const gwCx = (world.gatewayX[gwEid] + 0.5) * TILE_SIZE
    const gwCy = (world.gatewayY[gwEid] + 0.5) * TILE_SIZE
    // Two rings offset by half-period for a shimmer effect
    for (let r = 0; r < 2; r++) {
      const t = (gtime * 0.85 + i * 0.33 + r * 0.5) % 1
      const radius = t * TILE_SIZE * 2.4
      const ringAlpha = (1 - t) * 0.45
      gatewayPulseGfx.setStrokeStyle({ width: 1.5, color: 0xff2244, alpha: ringAlpha })
      gatewayPulseGfx.circle(gwCx, gwCy, radius)
      gatewayPulseGfx.stroke()
    }
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

    // --- Core HP shake trigger ---
    const coreHpNow = world.healthCurrent[ceid]
    if (lastCoreHp >= 0 && coreHpNow < lastCoreHp) {
      shakeCamera(Math.min(7, 2 + (lastCoreHp - coreHpNow) * 0.15), 18)
    }
    lastCoreHp = coreHpNow

    // --- Core beacon glow (pulsing rings) ---
    if (!coreGlowGfx) {
      coreGlowGfx = new Graphics()
      container.addChild(coreGlowGfx)
    }
    const ct = performance.now() / 1000
    const pulse1 = 0.5 + 0.5 * Math.sin(ct * 2.2)
    const pulse2 = 0.5 + 0.5 * Math.sin(ct * 4.6 + Math.PI * 0.7)
    const glowCx = (world.posX[ceid] + 0.5) * TILE_SIZE
    const glowCy = (world.posY[ceid] + 0.5) * TILE_SIZE
    coreGlowGfx.clear()
    coreGlowGfx.setStrokeStyle({ width: 1.5, color: coreColor, alpha: pulse1 * 0.50 })
    coreGlowGfx.circle(glowCx, glowCy, TILE_SIZE * (1.1 + pulse1 * 0.35))
    coreGlowGfx.stroke()
    coreGlowGfx.setStrokeStyle({ width: 1, color: 0x00ccff, alpha: pulse2 * 0.35 })
    coreGlowGfx.circle(glowCx, glowCy, TILE_SIZE * (0.7 + pulse2 * 0.20))
    coreGlowGfx.stroke()
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
    const tx = world.projFromX[eid] | 0
    const ty = world.projFromY[eid] | 0
    const facing = world.projFacing[eid]
    const range = world.projRange[eid]
    const color = TOWER_COLORS[world.projTowerType[eid]] ?? 0xff00ff
    const maxTicks = world.projMaxTicks[eid]
    const ticksLeft = world.projTicksLeft[eid]
    // Interpolate ticksLeft toward (ticksLeft - 1) using sub-tick alpha for fluid animation
    const interpLeft = ticksLeft - alpha
    const fade = maxTicks > 0 ? interpLeft / maxTicks : 1
    const progress = maxTicks > 1 ? (maxTicks - interpLeft) / (maxTicks - 1) : 1
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
        seg(ox, oy - r, ox + r, oy - r)  // top edge →
        seg(ox + r, oy, ox + r, oy - r)  // right edge ↑
        break
      case C.Dir.SE:
        seg(ox, oy + r, ox + r, oy + r)  // bottom edge →
        seg(ox + r, oy, ox + r, oy + r)  // right edge ↓
        break
      case C.Dir.SW:
        seg(ox, oy + r, ox - r, oy + r)  // bottom edge ←
        seg(ox - r, oy, ox - r, oy + r)  // left edge ↓
        break
      case C.Dir.NW:
        seg(ox, oy - r, ox - r, oy - r)  // top edge ←
        seg(ox - r, oy, ox - r, oy - r)  // left edge ↑
        break
    }
  }

  // ---- Detect new PROJECTILE / CONE_FX entities → muzzle flash; expired → impact flare ----
  const curProjEids = new Set<number>()
  const curConeFxEids = new Set<number>()
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const m = world.bitmask[eid]
    if (m & C.PROJECTILE) {
      curProjEids.add(eid)
      if (!prevProjectileEids.has(eid)) {
        // Newly spawned — muzzle flash at origin
        const color = TOWER_COLORS[world.projTowerType[eid]] ?? 0xffffff
        muzzleFlashes.push({ x: world.projFromX[eid], y: world.projFromY[eid], frames: 3, color })
        projTargetCache.set(eid, { toX: world.projToX[eid], toY: world.projToY[eid], color })
      }
    }
    if (m & C.CONE_FX) {
      curConeFxEids.add(eid)
      if (!prevConeFxEids.has(eid)) {
        const color = TOWER_COLORS[world.projTowerType[eid]] ?? 0xffffff
        muzzleFlashes.push({ x: world.projFromX[eid], y: world.projFromY[eid], frames: 3, color })
      }
    }
  }
  for (const eid of prevProjectileEids) {
    if (!curProjEids.has(eid)) {
      const cached = projTargetCache.get(eid)
      if (cached) {
        impactFlashes.push({ x: cached.toX, y: cached.toY, frames: 4, color: cached.color })
        projTargetCache.delete(eid)
      }
    }
  }
  prevProjectileEids.clear()
  curProjEids.forEach(id => prevProjectileEids.add(id))
  prevConeFxEids.clear()
  curConeFxEids.forEach(id => prevConeFxEids.add(id))

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
    const toPx = (world.projToX[eid] + 0.5) * TILE_SIZE
    const toPy = (world.projToY[eid] + 0.5) * TILE_SIZE
    const color = TOWER_COLORS[world.projTowerType[eid]] ?? 0xffffff
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

  // ---- Muzzle flashes and impact flares ----
  if (!flashGfx) {
    flashGfx = new Graphics()
    container.addChild(flashGfx)
  }
  flashGfx.clear()
  for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
    const fl = muzzleFlashes[i]
    const a = fl.frames / 3
    const px = (fl.x + 0.5) * TILE_SIZE
    const py = (fl.y + 0.5) * TILE_SIZE
    flashGfx.setFillStyle({ color: fl.color, alpha: a * 0.45 })
    flashGfx.circle(px, py, 5.5)
    flashGfx.fill()
    flashGfx.setFillStyle({ color: 0xffffff, alpha: a })
    flashGfx.circle(px, py, 2.5)
    flashGfx.fill()
    fl.frames--
    if (fl.frames <= 0) muzzleFlashes.splice(i, 1)
  }
  for (let i = impactFlashes.length - 1; i >= 0; i--) {
    const fl = impactFlashes[i]
    const a = fl.frames / 4
    const px = (fl.x + 0.5) * TILE_SIZE
    const py = (fl.y + 0.5) * TILE_SIZE
    flashGfx.setFillStyle({ color: fl.color, alpha: a * 0.55 })
    flashGfx.circle(px, py, 6)
    flashGfx.fill()
    flashGfx.setFillStyle({ color: 0xffffff, alpha: a * 0.85 })
    flashGfx.circle(px, py, 2.5)
    flashGfx.fill()
    fl.frames--
    if (fl.frames <= 0) impactFlashes.splice(i, 1)
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
  for (const sprite of activeGateways.values()) sprite.destroy()
  activeGateways.clear()
  coreGfx = null
  firewallLineGfx = null
  blackwallLineGfx = null
  rangeGfx = null
  projectileGfx = null
  coneFxGfx = null
  flashGfx = null
  coreGlowGfx = null
  gatewayPulseGfx = null
  muzzleFlashes.length = 0
  impactFlashes.length = 0
  prevProjectileEids.clear()
  prevConeFxEids.clear()
  projTargetCache.clear()
  lastCoreHp = -1
}
