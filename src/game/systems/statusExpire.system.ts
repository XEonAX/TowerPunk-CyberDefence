/**
 * Status Expire System — §1.10.4
 *
 * Decrements the remaining tick counters for slow, stun (enemies) and
 * tower-disable (towers). Clears associated flags/magnitudes when timers
 * reach zero.
 *
 * Rule references:
 *   §7.0.15 — Slow: decrement per tick, clear magnitude at 0
 *   §7.0.11 — Stun: decrement per tick
 *   §7.7    — Tower disable: decrement per tick, clear TOWER_DISABLED flag at 0
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'

export function statusExpireSystem(world: World): void {
  const N = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if (mask === 0 || (mask & C.PENDING_REMOVAL) !== 0) continue

    // --- Enemy status effects ---
    if ((mask & C.ENEMY) !== 0) {
      // §7.0.15 — Slow countdown
      if (world.slowTicks[eid] > 0) {
        world.slowTicks[eid]--
        if (world.slowTicks[eid] === 0) {
          world.slowMagnitude[eid] = 0
        }
      }

      // §7.0.11 — Stun countdown
      if (world.stunTicks[eid] > 0) {
        world.stunTicks[eid]--
      }
    }

    // --- Tower disable countdown (§7.7) ---
    if ((mask & C.TOWER) !== 0) {
      if (world.towerDisableTicks[eid] > 0) {
        world.towerDisableTicks[eid]--
        if (world.towerDisableTicks[eid] === 0) {
          world.bitmask[eid] &= ~C.TOWER_DISABLED
        }
      }
    }
  }
}
