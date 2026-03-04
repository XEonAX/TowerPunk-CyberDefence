/**
 * Pickup Collect System — §1.10.13
 *
 * For each active (non-disabled) Ping Tower, collect all live pickups that
 * fall within its Chebyshev range (§2.8). Collected eddies are added directly
 * to the player pool; fractional components are floored before addition.
 *
 * Rulebook §5.7.1, §4.2.4
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'
import { markForRemoval } from '../ecs/world'

export function pickupCollectSystem(world: World): void {
  const N = world.bitmask.length

  for (let pingEid = 1; pingEid < N; pingEid++) {
    const pingMask = world.bitmask[pingEid]

    // Must have PING_RANGE and be alive
    if ((pingMask & C.PING_RANGE) === 0) continue
    if ((pingMask & C.PENDING_REMOVAL) !== 0) continue
    // §7.7 — disabled towers do not collect
    if ((pingMask & C.TOWER_DISABLED) !== 0) continue

    const px    = world.posX[pingEid]
    const py    = world.posY[pingEid]
    const range = world.pingRange[pingEid]

    for (let pickupEid = 1; pickupEid < N; pickupEid++) {
      const pickupMask = world.bitmask[pickupEid]

      if ((pickupMask & C.PICKUP) === 0) continue
      if ((pickupMask & C.PENDING_REMOVAL) !== 0) continue

      // §2.8 — Chebyshev distance
      const dx   = world.posX[pickupEid] - px
      const dy   = world.posY[pickupEid] - py
      const dist = dx < 0 ? (dy < 0 ? (dx < dy ? -dx : -dy) : (dx < -dy ? -dx : dy)) :
                            (dy < 0 ? (dy < -dx ? -dy : dx) : (dx > dy ? dx : dy))
      // simpler: Math.max(Math.abs(dx), Math.abs(dy))
      const chebyDist = Math.max(Math.abs(dx), Math.abs(dy))

      if (chebyDist <= range) {
        world.eddies     += world.pickupEddies[pickupEid]
        world.components += Math.floor(world.pickupComponents[pickupEid])
        markForRemoval(world, pickupEid)
      }
    }
  }
}
