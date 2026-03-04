/**
 * Pickup Decay System — §1.10.11
 *
 * Applies per-tick decay to all live pickups that are NOT within range of any
 * active Ping Tower. Pickups inside Ping Tower range are exempt from decay
 * (Rulebook §4.2.5: “Pickups outside Ping Tower range will decay”).
 *
 * Note: pickupCollect (§1.10.13) runs AFTER this step in the pipeline, so
 * a pickup still alive here has not yet been claimed. We apply decay only to
 * pickups outside all Ping-Tower radii.
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

    // §4.2.5 — pickups inside Ping Tower range do NOT decay
    if (_isInPingRange(world, world.posX[eid], world.posY[eid], N)) continue

    // Apply decay by pickupDecayPerTick (pre-computed at pickup creation)
    const decay = world.pickupDecayPerTick[eid]
    world.pickupEddies[eid]     -= decay
    world.pickupComponents[eid] -= decay

    if (world.pickupEddies[eid] <= 0 && world.pickupComponents[eid] <= 0) {
      markForRemoval(world, eid)
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return true if (x, y) is within Chebyshev range of any active, non-disabled
 * Ping Tower. Used to skip decay on covered pickups (§4.2.5).
 */
function _isInPingRange(
  world: World,
  x: number,
  y: number,
  N: number,
): boolean {
  for (let pingEid = 1; pingEid < N; pingEid++) {
    const m = world.bitmask[pingEid]
    if ((m & C.PING_RANGE) === 0) continue
    if ((m & C.PENDING_REMOVAL) !== 0) continue
    if ((m & C.TOWER_DISABLED) !== 0) continue
    const dist = Math.max(
      Math.abs(world.posX[pingEid] - x),
      Math.abs(world.posY[pingEid] - y),
    )
    if (dist <= world.pingRange[pingEid]) return true
  }
  return false
}
