/**
 * Enemy Aura System — §1.10.6
 *
 * VDB Netrunner (§7.6) damages all towers within Chebyshev distance 1 every tick.
 * This represents a persistent "hack aura" that radiates from the enemy as it moves.
 *
 * Rules:
 *  - Only VDB_NETRUNNER enemies have an aura (§7.6.2).
 *  - Enemies with SPAWN_IMMUNITY do not deal aura damage (§2.10.1).
 *  - Aura damage value is world.enemyDamage[eid] (wave-scaled at spawn, §7.0.5).
 *  - Towers that reach 0 HP are marked for removal (handled in cleanupSystem).
 *  - PENDING_REMOVAL enemies and towers are skipped.
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'
import { markForRemoval } from '../ecs/world'
import { chebyshev } from './targeting.system'
import { SABOTEUR_PULSE_INTERVAL_TICKS, SABOTEUR_DISABLE_DURATION_TICKS } from '../constants'
import { queueDisable } from './statusQueue.system'

export function enemyAuraSystem(world: World): void {
  const N = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]

    // Must be an active enemy, not yet removed, not in spawn immunity window
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue

    // Only VDB Netrunner has an aura — §7.6.2
    if (world.enemyType[eid] !== C.EnemyType.VDB_NETRUNNER) continue

    const auraDmg = world.enemyDamage[eid]
    const ex      = world.tilePosX[eid]
    const ey      = world.tilePosY[eid]

    // Damage all towers within Chebyshev 1
    for (let teid = 1; teid < N; teid++) {
      const tmask = world.bitmask[teid]
      if ((tmask & C.TOWER) === 0) continue
      if ((tmask & C.PENDING_REMOVAL) !== 0) continue

      if (chebyshev(ex, ey, world.posX[teid] | 0, world.posY[teid] | 0) > 1) continue

      world.healthCurrent[teid] -= auraDmg
      if (world.healthCurrent[teid] <= 0) {
        markForRemoval(world, teid)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Saboteur disable pulse (§7.7.1)
  // ---------------------------------------------------------------------------

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]

    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue

    // Only Saboteur has a disable pulse
    if (world.enemyType[eid] !== C.EnemyType.SABOTEUR) continue

    const lastPulse = world.saboteurPulseTick[eid]
    // Fire on first encounter (lastPulse === 0) or when interval has elapsed
    if (lastPulse !== 0 && (world.tickCount - lastPulse) < SABOTEUR_PULSE_INTERVAL_TICKS) continue

    const sabX = world.tilePosX[eid]
    const sabY = world.tilePosY[eid]

    for (let teid = 1; teid < N; teid++) {
      const tmask = world.bitmask[teid]
      if ((tmask & C.TOWER) === 0) continue
      if ((tmask & C.PENDING_REMOVAL) !== 0) continue
      if (chebyshev(sabX, sabY, world.posX[teid] | 0, world.posY[teid] | 0) > 1) continue

      queueDisable(world, teid, SABOTEUR_DISABLE_DURATION_TICKS)
    }

    world.saboteurPulseTick[eid] = world.tickCount
  }
}
