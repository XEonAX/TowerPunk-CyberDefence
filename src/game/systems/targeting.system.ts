/**
 * Targeting System — §1.10.7
 *
 * Tower target acquisition. Runs every tick.
 * Towers with targeting: DATA_SPIKE (§5.3), DAEMON_TURRET (§5.4), ICE_SNIPER (§5.5).
 * Towers without targeting (passive / area): ICE_WALL, FIREWALL, PING, HARVESTER, BLACKWALL.
 *
 * Processing order:
 *  1. Skip TOWER_DISABLED towers.
 *  2. Skip towers without TARGETING component (non-combat towers).
 *  3. Decrement targetingCooldown if > 0; skip until ready.
 *  4. Acquire target based on tower type and targetingMode.
 *  5. Set world.targetingTarget[eid]; reset cooldown.
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'
import {
  DATA_SPIKE_COOLDOWN_TICKS,
  DATA_SPIKE_RANGE,
  DAEMON_TURRET_COOLDOWN,
  DAEMON_TURRET_RANGE,
  ICE_SNIPER_COOLDOWN,
  ICE_SNIPER_MIN_RANGE,
  ICE_SNIPER_MAX_RANGE,
} from '../constants'

/**
 * Sentinel value stored in targetingTarget for DATA_SPIKE — means
 * "fire now at all enemies in cone" (§5.3.2). Distinct from any real entity ID
 * since entity IDs start at 1 and the pool is capped at 4096.
 */
export const DATA_SPIKE_FIRE_FLAG = 0xffffffff

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Chebyshev distance between two tile positions. */
export function chebyshev(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2))
}

/**
 * Returns fire cooldown ticks for the given tower (§5.3, §5.4, §5.5).
 * §6.2 — Overclock reduces cooldown by dividing by the overclock multiplier.
 */
export function getCooldownForTower(world: World, eid: number): number {
  const level = Math.max(0, Math.min(9, world.towerLevel[eid] - 1))
  let cooldown: number
  switch (world.towerType[eid]) {
    case C.TowerType.DATA_SPIKE:
      cooldown = DATA_SPIKE_COOLDOWN_TICKS
      break
    case C.TowerType.DAEMON_TURRET:
      cooldown = DAEMON_TURRET_COOLDOWN[level] ?? 120
      break
    case C.TowerType.ICE_SNIPER:
      cooldown = ICE_SNIPER_COOLDOWN[level] ?? 180
      break
    default:
      return 0
  }
  // §6.2 — Overclock: reduce cooldown proportionally (min 1 tick)
  if (world.overclockActive[eid] !== 0) {
    cooldown = Math.max(1, Math.floor(cooldown / world.overclockMultiplier[eid]))
  }
  return cooldown
}

/**
 * Check whether (ex, ey) lies inside the DATA_SPIKE cone — §5.3.2.
 *
 * The cone widens with distance so the number of affected tiles is equal
 * for every facing direction at the same range.
 *
 * Cardinal facings — triangular wedge (width = 2×dist+1 at the tip row):
 *   N: dy < 0  AND |dx| <= |dy|   (narrows to point at tower, widens outward)
 *   S: dy > 0  AND |dx| <=  dy
 *   E: dx > 0  AND |dy| <=  dx
 *   W: dx < 0  AND |dy| <= -dx
 *
 * Diagonal facings — quadrant (both adjacent axes inclusive):
 *   NE: dx >= 0 AND dy <= 0
 *   SE: dx >= 0 AND dy >= 0
 *   SW: dx <= 0 AND dy >= 0
 *   NW: dx <= 0 AND dy <= 0
 *
 * Chebyshev(enemy, tower) in (0, range] for all cases.
 */
export function inDataSpikeCone(
  ex: number, ey: number,
  tx: number, ty: number,
  facing: number,
  range: number,
): boolean {
  const dist = chebyshev(ex, ey, tx, ty)
  if (dist === 0 || dist > range) return false
  const dx = ex - tx
  const dy = ey - ty
  switch (facing) {
    case C.Dir.N:  return dy < 0  && Math.abs(dx) <= -dy
    case C.Dir.S:  return dy > 0  && Math.abs(dx) <=  dy
    case C.Dir.E:  return dx > 0  && Math.abs(dy) <=  dx
    case C.Dir.W:  return dx < 0  && Math.abs(dy) <= -dx
    case C.Dir.NE: return dx >= 0 && dy <= 0
    case C.Dir.SE: return dx >= 0 && dy >= 0
    case C.Dir.SW: return dx <= 0 && dy >= 0
    case C.Dir.NW: return dx <= 0 && dy <= 0
    default: return false
  }
}

// ---------------------------------------------------------------------------
// Rotation / aim helpers
// ---------------------------------------------------------------------------

/**
 * Signed shortest angular delta from `from` to `to`, in (-π, π].
 * Both inputs are expected to be outputs of Math.atan2 (i.e. in [-π, π]).
 */
function angleDelta(from: number, to: number): number {
  let d = to - from
  if (d >  Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return d
}

/** Unsigned angular difference between two angles (0 to π). */
export function angleDiff(a: number, b: number): number {
  return Math.abs(angleDelta(a, b))
}

/**
 * Step angle `current` toward `target` by at most `speed` radians.
 * Snaps exactly to `target` when the remaining gap is within `speed`.
 */
export function stepAngle(current: number, target: number, speed: number): number {
  const delta = angleDelta(current, target)
  if (Math.abs(delta) <= speed) return target
  return current + Math.sign(delta) * speed
}

/**
 * Returns true when the tower's current rotationAngle is within one rotationSpeed
 * step of the angle required to face its `targetingTarget`.
 * Used by damageSystem to gate firing for DAEMON_TURRET and ICE_SNIPER.
 */
export function isAimed(world: World, teid: number): boolean {
  const targetEid = world.targetingTarget[teid]
  if (targetEid === 0) return false
  const tx = world.posX[teid] | 0
  const ty = world.posY[teid] | 0
  const ex = world.tilePosX[targetEid]
  const ey = world.tilePosY[targetEid]
  const desiredAngle = Math.atan2(ex - tx, -(ey - ty))
  // rotationSpeed is stored in degrees/tick; rotationAngle is in radians.
  const speedRad = world.rotationSpeed[teid] * (Math.PI / 180)
  return angleDiff(world.rotationAngle[teid], desiredAngle) <= speedRad
}

// ---------------------------------------------------------------------------
// Main system
// ---------------------------------------------------------------------------

export function targetingSystem(world: World): void {
  const N = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]

    // Must be a tower
    if ((mask & C.TOWER) === 0) continue
    // Skip pending removal
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    // §1.10.7: Skip disabled towers
    if ((mask & C.TOWER_DISABLED) !== 0) continue
    // Must have TARGETING component
    if ((mask & C.TARGETING) === 0) continue

    const towerType = world.towerType[eid]

    // Only DATA_SPIKE, DAEMON_TURRET, ICE_SNIPER use targetingSystem
    if (
      towerType !== C.TowerType.DATA_SPIKE &&
      towerType !== C.TowerType.DAEMON_TURRET &&
      towerType !== C.TowerType.ICE_SNIPER
    ) continue

    const tx = world.posX[eid] | 0
    const ty = world.posY[eid] | 0
    const level = Math.max(0, Math.min(9, world.towerLevel[eid] - 1))

    // --- DATA_SPIKE: unchanged cooldown-gated logic ---
    if (towerType === C.TowerType.DATA_SPIKE) {
      if (world.targetingCooldown[eid] > 0) {
        world.targetingCooldown[eid]--
        continue
      }
      const target = acquireDataSpikeTarget(world, eid, tx, ty, level)
      if (target > 0) {
        world.targetingTarget[eid] = target
        world.targetingCooldown[eid] = getCooldownForTower(world, eid)
      }
      continue
    }

    // --- DAEMON_TURRET / ICE_SNIPER: rotation-aware tracking (§5.4.2, §5.5.1) ---
    // The tower tracks a target every tick (regardless of cooldown) and rotates
    // incrementally. damageSystem (§1.10.8) fires once isAimed() is true and
    // the fire cooldown has expired.

    // 1. Decrement fire cooldown
    if (world.targetingCooldown[eid] > 0) {
      world.targetingCooldown[eid]--
    }

    // 2. Validate existing target or acquire a new one
    let targetEid = world.targetingTarget[eid]
    if (targetEid > 0) {
      const tmask = world.bitmask[targetEid]
      let valid = (tmask & C.ENEMY) !== 0
                && (tmask & C.PENDING_REMOVAL) === 0
                && (tmask & C.SPAWN_IMMUNITY) === 0
      if (valid) {
        const dist = chebyshev(world.tilePosX[targetEid], world.tilePosY[targetEid], tx, ty)
        valid = towerType === C.TowerType.DAEMON_TURRET
          ? dist <= (DAEMON_TURRET_RANGE[level] ?? 1)
          : dist >= ICE_SNIPER_MIN_RANGE[level] && dist <= ICE_SNIPER_MAX_RANGE[level]
      }
      if (!valid) {
        targetEid = 0
        world.targetingTarget[eid] = 0
      }
    }
    if (targetEid === 0) {
      targetEid = towerType === C.TowerType.DAEMON_TURRET
        ? acquireDaemonTurretTarget(world, eid, tx, ty, level)
        : acquireIceSniperTarget(world, eid, tx, ty, level)
      world.targetingTarget[eid] = targetEid
    }

    // 3. Rotate incrementally toward target — never snap instantly
    if (targetEid > 0) {
      const ex = world.tilePosX[targetEid]
      const ey = world.tilePosY[targetEid]
      const desiredAngle = Math.atan2(ex - tx, -(ey - ty))
      // rotationSpeed is stored in degrees/tick; convert to radians for angle math.
      const speedRad = world.rotationSpeed[eid] * (Math.PI / 180)
      world.rotationAngle[eid] = stepAngle(world.rotationAngle[eid], desiredAngle, speedRad)
    }
    // NOTE: cooldown reset + actual firing are handled in damageSystem (§1.10.8)
    // once isAimed() confirms the barrel is on target.
  }
}

// ---------------------------------------------------------------------------
// Per-tower acquisition helpers
// ---------------------------------------------------------------------------

/**
 * DATA_SPIKE — §5.3.2
 * If any valid enemy exists in the 90° facing cone within range, return the
 * DATA_SPIKE_FIRE_FLAG sentinel so damageSystem fires at all enemies in cone.
 */
function acquireDataSpikeTarget(
  world: World,
  towerEid: number,
  tx: number,
  ty: number,
  level: number,
): number {
  const facing = world.towerFacing[towerEid]
  const range  = DATA_SPIKE_RANGE[level] ?? 2
  const N      = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue
    const ex = world.tilePosX[eid]
    const ey = world.tilePosY[eid]
    if (inDataSpikeCone(ex, ey, tx, ty, facing, range)) {
      return DATA_SPIKE_FIRE_FLAG
    }
  }
  return 0
}

/**
 * DAEMON_TURRET — §5.4.2
 * Selects a target tile based on targetingMode:
 *   CLOSEST       — enemy closest to turret (Chebyshev)
 *   HIGHEST_HP    — enemy with most current HP
 *   LOWEST_HP     — enemy with least current HP
 * Returns entity ID of selected enemy, or 0 if none in range.
 */
function acquireDaemonTurretTarget(
  world: World,
  towerEid: number,
  tx: number,
  ty: number,
  level: number,
): number {
  const range = DAEMON_TURRET_RANGE[level] ?? 1
  const mode  = world.targetingMode[towerEid]
  const N     = world.bitmask.length

  let bestEid   = 0
  let bestScore = mode === C.TargetingMode.LOWEST_HP ? Infinity : -Infinity

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue
    const dist = chebyshev(world.tilePosX[eid], world.tilePosY[eid], tx, ty)
    if (dist > range) continue

    let score: number
    switch (mode) {
      case C.TargetingMode.CLOSEST:
        // Invert so that smaller distance = higher score
        score = -dist
        if (score > bestScore) { bestScore = score; bestEid = eid }
        break
      case C.TargetingMode.HIGHEST_HP:
        score = world.healthCurrent[eid]
        if (score > bestScore) { bestScore = score; bestEid = eid }
        break
      case C.TargetingMode.LOWEST_HP:
        score = world.healthCurrent[eid]
        if (score < bestScore) { bestScore = score; bestEid = eid }
        break
    }
  }
  return bestEid
}

/**
 * ICE_SNIPER — §5.5.2
 * Selects target with Chebyshev distance in [ICE_SNIPER_MIN_RANGE, ICE_SNIPER_MAX_RANGE].
 * Target selection respects targetingMode (CLOSEST/HIGHEST_HP/LOWEST_HP).
 */
function acquireIceSniperTarget(
  world: World,
  towerEid: number,
  tx: number,
  ty: number,
  level: number,
): number {
  const mode = world.targetingMode[towerEid]
  const N    = world.bitmask.length

  let bestEid   = 0
  let bestScore = mode === C.TargetingMode.LOWEST_HP ? Infinity : -Infinity

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue
    const dist = chebyshev(world.tilePosX[eid], world.tilePosY[eid], tx, ty)
    if (dist < ICE_SNIPER_MIN_RANGE[level] || dist > ICE_SNIPER_MAX_RANGE[level]) continue

    let score: number
    switch (mode) {
      case C.TargetingMode.CLOSEST:
        score = -dist
        if (score > bestScore) { bestScore = score; bestEid = eid }
        break
      case C.TargetingMode.HIGHEST_HP:
        score = world.healthCurrent[eid]
        if (score > bestScore) { bestScore = score; bestEid = eid }
        break
      case C.TargetingMode.LOWEST_HP:
        score = world.healthCurrent[eid]
        if (score < bestScore) { bestScore = score; bestEid = eid }
        break
    }
  }
  return bestEid
}
