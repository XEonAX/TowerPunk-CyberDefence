/**
 * Pickup Decay System — §1.10.11
 *
 * Applies per-tick decay to all live pickups. A pickup that reaches zero
 * (both eddies and components) is marked for removal.
 *
 * Rulebook §4.2.5:
 *   Pickups outside Ping Tower range decay at (5/60) ≈ 0.083% of their
 *   initial Eddie-equivalent value per tick. Only whole-number components
 *   are tracked; the decay applies proportionally to both pools.
 *
 * Note: pickupCollect (§1.10.13) runs AFTER this step in the pipeline, so
 * any pickup still alive here has not yet been claimed by a Ping Tower.
 * Per the pipeline order, we decay ALL living pickups unconditionally here.
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'
import { markForRemoval } from '../ecs/world'

export function pickupDecaySystem(world: World): void {
  const N = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.PICKUP) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue

    // §4.2.5 — decay by pickupDecayPerTick (pre-computed at pickup creation)
    const decay = world.pickupDecayPerTick[eid]
    world.pickupEddies[eid]      -= decay
    world.pickupComponents[eid]  -= decay

    if (world.pickupEddies[eid] <= 0 && world.pickupComponents[eid] <= 0) {
      markForRemoval(world, eid)
    }
  }
}
