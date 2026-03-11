/**
 * Damage System — §1.10.8–9
 *
 * Pass 1: Tower-to-enemy damage.
 * Pass 2: Enemy-to-tower damage is handled in enemyAura.system (VDB Netrunner)
 *         and in the cleanup system for enemies that reach the Core.
 *
 * Tower damage order matches tick pipeline order only; within each tower type
 * all interactions are independent.
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'
import { markForRemoval, spawnProjectile, spawnConeFx } from '../ecs/world'
import {
  TICK_RATE,
  ICE_WALL_DPS,
  ICE_WALL_SLOW,
  FIREWALL_DPS,
  FIREWALL_STUN_TICKS,
  DATA_SPIKE_DAMAGE,
  DATA_SPIKE_RANGE,
  DAEMON_TURRET_DAMAGE,
  ICE_SNIPER_DAMAGE,
  ICE_SNIPER_SLOW,
  ICE_SNIPER_SLOW_TICKS,
  SHOT_BEAM_TICKS,
  CONE_FX_TICKS,
} from '../constants'
import { DATA_SPIKE_FIRE_FLAG, chebyshev, inDataSpikeCone } from './targeting.system'
import { queueSlow, queueStun } from './statusQueue.system'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampLevel(world: World, eid: number): number {
  return Math.max(0, Math.min(9, world.towerLevel[eid] - 1))
}

/**
 * Returns effective damage after applying AI Overlord phase modifiers.
 * Returns 0 if the enemy is immune (phase 1 — no damage, §7.8.1).
 * Applies 1.5× multiplier in phase 3 (§7.8.5).
 */
function effectiveDamage(world: World, eid: number, dmg: number): number {
  if (world.enemyType[eid] === C.EnemyType.AI_OVERLORD) {
    if (world.aiOverlordPhase[eid] === 1) return 0
    return dmg * world.aiOverlordDamageMult[eid]
  }
  return dmg
}

// ---------------------------------------------------------------------------
// ICE_WALL damage — §5.1.2
// ---------------------------------------------------------------------------

/**
 * ICE_WALL applies a per-tick DOT and slow to all enemies within Chebyshev 1.
 * Skips enemies with IMMUNE_ICE_DOT.
 * Queues slow unless IMMUNE_SLOW or IMMUNE_ICE_SLOW.
 */
function applyIceWallDamage(world: World, teid: number): void {
  const level     = clampLevel(world, teid)
  const dpsPerTick = (ICE_WALL_DPS[level] ?? 3) / TICK_RATE
  const slowMag    = ICE_WALL_SLOW[level] ?? 0.5
  const tx         = world.posX[teid] | 0
  const ty         = world.posY[teid] | 0
  const N          = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue
    if (chebyshev(world.tilePosX[eid], world.tilePosY[eid], tx, ty) > 1) continue

    // DOT damage
    const immune = world.immunityFlags[eid]
    if ((immune & C.IMMUNE_ICE_DOT) === 0) {
      const actual = effectiveDamage(world, eid, dpsPerTick)
      if (actual > 0) {
        world.healthCurrent[eid] -= actual
        if (world.healthCurrent[eid] <= 0) {
          markForRemoval(world, eid)
          continue
        }
      }
    }

    // Slow — skip if immune
    if ((immune & C.IMMUNE_SLOW) === 0 && (immune & C.IMMUNE_ICE_SLOW) === 0) {
      queueSlow(world, eid, slowMag, TICK_RATE / 2)  // §5.1.2: 0.5 s duration
    }
  }
}

// ---------------------------------------------------------------------------
// FIREWALL damage — §5.2.3
// ---------------------------------------------------------------------------

/**
 * FIREWALL pair damages enemies that step on the gap tile between them.
 * Skips enemies with IMMUNE_FIREWALL_DMG.
 * Stuns enemies unless IMMUNE_STUN or IMMUNE_FIREWALL_STUN.
 */
function applyFirewallDamage(world: World, teid: number): void {
  // Both towers in the pair share responsibility; only process the one that
  // has the FIREWALL_LINK bitmask (both do, so process on every tick for each).
  // The gap tile coords are stored on both entities.
  const level    = clampLevel(world, teid)
  const dpsPerTick = (FIREWALL_DPS[level] ?? 5) / TICK_RATE
  const gapX     = world.firewallGapX[teid]
  const gapY     = world.firewallGapY[teid]
  const N        = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue
    if (world.tilePosX[eid] !== gapX || world.tilePosY[eid] !== gapY) continue

    const immune = world.immunityFlags[eid]

    // Damage
    if ((immune & C.IMMUNE_FIREWALL_DMG) === 0) {
      const actual = effectiveDamage(world, eid, dpsPerTick)
      if (actual > 0) {
        world.healthCurrent[eid] -= actual
        if (world.healthCurrent[eid] <= 0) {
          markForRemoval(world, eid)
          continue
        }
      }
    }

    // Stun
    if ((immune & C.IMMUNE_STUN) === 0 && (immune & C.IMMUNE_FIREWALL_STUN) === 0) {
      queueStun(world, eid, FIREWALL_STUN_TICKS)
    }
  }
}

// ---------------------------------------------------------------------------
// DATA_SPIKE damage — §5.3.2
// ---------------------------------------------------------------------------

/**
 * DATA_SPIKE fires when targetingTarget == DATA_SPIKE_FIRE_FLAG.
 * It pierces all enemies in the 90° cone.
 */
function applyDataSpikeDamage(world: World, teid: number): void {
  // Clear the fire flag
  world.targetingTarget[teid] = 0

  const level   = clampLevel(world, teid)
  const damage  = DATA_SPIKE_DAMAGE[level] ?? 50
  const tx      = world.posX[teid] | 0
  const ty      = world.posY[teid] | 0
  const facing  = world.towerFacing[teid]
  const range   = DATA_SPIKE_RANGE[level] ?? 2  // §5.3 — grows with level
  const N       = world.bitmask.length

  // Spawn a render-only sweeping cone wave effect
  spawnConeFx(world, tx, ty, facing, range, C.TowerType.DATA_SPIKE, CONE_FX_TICKS)

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    // Spawn immunity does NOT protect from data spike (it fires into the cone)
    const ex = world.tilePosX[eid]
    const ey = world.tilePosY[eid]
    if (!inDataSpikeCone(ex, ey, tx, ty, facing, range)) continue

    const actual = effectiveDamage(world, eid, damage)
    if (actual > 0) {
      world.healthCurrent[eid] -= actual
      if (world.healthCurrent[eid] <= 0) {
        markForRemoval(world, eid)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DAEMON_TURRET damage — §5.4.2
// ---------------------------------------------------------------------------

/**
 * DAEMON_TURRET fires at the targeted entity and damages ALL enemies on the same tile.
 */
function applyDaemonTurretDamage(world: World, teid: number): void {
  const targetEid = world.targetingTarget[teid]
  world.targetingTarget[teid] = 0

  // Target must still be alive
  if ((world.bitmask[targetEid] & C.PENDING_REMOVAL) !== 0) return
  if ((world.bitmask[targetEid] & C.ENEMY) === 0) return

  const level  = clampLevel(world, teid)
  const damage = DAEMON_TURRET_DAMAGE[level] ?? 25
  const tx     = world.tilePosX[targetEid]
  const ty     = world.tilePosY[targetEid]
  const N      = world.bitmask.length

  // Spawn a render-only shot beam from tower to target tile
  spawnProjectile(world, world.posX[teid], world.posY[teid], tx, ty, C.TowerType.DAEMON_TURRET, SHOT_BEAM_TICKS)

  // Hit ALL enemies on the target tile (splash — §5.4.2)
  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if (world.tilePosX[eid] !== tx || world.tilePosY[eid] !== ty) continue

    const actual = effectiveDamage(world, eid, damage)
    if (actual > 0) {
      world.healthCurrent[eid] -= actual
      if (world.healthCurrent[eid] <= 0) {
        markForRemoval(world, eid)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ICE_SNIPER damage — §5.5.2
// ---------------------------------------------------------------------------

/**
 * ICE_SNIPER fires at the targeted single enemy, dealing damage and queuing a slow.
 */
function applyIceSniperDamage(world: World, teid: number): void {
  const targetEid = world.targetingTarget[teid]
  world.targetingTarget[teid] = 0

  const mask = world.bitmask[targetEid]
  if ((mask & C.PENDING_REMOVAL) !== 0) return
  if ((mask & C.ENEMY) === 0) return

  // Capture target position before damage may mark it for removal
  const targetTileX = world.tilePosX[targetEid]
  const targetTileY = world.tilePosY[targetEid]

  // Spawn a render-only shot beam from tower to target tile
  spawnProjectile(world, world.posX[teid], world.posY[teid], targetTileX, targetTileY, C.TowerType.ICE_SNIPER, SHOT_BEAM_TICKS)

  const level  = clampLevel(world, teid)
  const damage = ICE_SNIPER_DAMAGE[level] ?? 100

  const actual = effectiveDamage(world, targetEid, damage)
  if (actual > 0) {
    world.healthCurrent[targetEid] -= actual
    if (world.healthCurrent[targetEid] <= 0) {
      markForRemoval(world, targetEid)
      return
    }
  }

  // Slow — skip if immune (still applies even if damage was blocked by phase 1)
  const immune = world.immunityFlags[targetEid]
  if ((immune & C.IMMUNE_SLOW) === 0) {
    queueSlow(world, targetEid, ICE_SNIPER_SLOW[level] ?? 0.5, ICE_SNIPER_SLOW_TICKS)
  }
}

// ---------------------------------------------------------------------------
// Main system entry point
// ---------------------------------------------------------------------------

export function damageSystem(world: World): void {
  const N = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]

    // Must be a non-disabled, non-removed tower
    if ((mask & C.TOWER) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.TOWER_DISABLED) !== 0) continue

    const towerType = world.towerType[eid]

    switch (towerType) {
      case C.TowerType.ICE_WALL:
        applyIceWallDamage(world, eid)
        break

      case C.TowerType.FIREWALL:
        if ((mask & C.FIREWALL_LINK) !== 0) {
          applyFirewallDamage(world, eid)
        }
        break

      case C.TowerType.DATA_SPIKE:
        if (world.targetingTarget[eid] === DATA_SPIKE_FIRE_FLAG) {
          applyDataSpikeDamage(world, eid)
        }
        break

      case C.TowerType.DAEMON_TURRET:
        if (world.targetingTarget[eid] > 0) {
          applyDaemonTurretDamage(world, eid)
        }
        break

      case C.TowerType.ICE_SNIPER:
        if (world.targetingTarget[eid] > 0) {
          applyIceSniperDamage(world, eid)
        }
        break
    }
  }
}
