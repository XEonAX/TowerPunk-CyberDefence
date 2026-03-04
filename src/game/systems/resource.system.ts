/**
 * Resource System — §1.10.14
 *
 * Two responsibilities:
 *   1. Harvester Eddie/Component generation (§5.8.1–5.8.2)
 *   2. Blackwall Tower passive damage + gateway damage + auto-repair (§5.6)
 *
 * Rulebook §5.7.2: Harvesters only generate if within a Ping Tower network.
 * Rulebook §5.6.2: Each Blackwall Tower deals BLACKWALL_TOWER_DPT to gateway.
 * Rulebook §5.6.6: Blackwall Tower takes BLACKWALL_PASSIVE_DPT while gateway is alive.
 * Rulebook §5.6.7: Auto-repair consumes BLACKWALL_REPAIR_COMPONENTS for full restore;
 *                  partial restore if insufficient components available.
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'
import { markForRemoval } from '../ecs/world'
import {
  BLACKWALL_PASSIVE_DPT,
  BLACKWALL_REPAIR_COMPONENTS,
} from '../constants'

export function resourceSystem(world: World): void {
  _harvestersGenerate(world)
  _blackwallTowersTick(world)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * §5.8.1–5.8.2 — Harvester generation.
 * Only generates if at least one non-disabled Ping Tower is within Chebyshev range.
 */
function _harvestersGenerate(world: World): void {
  const N = world.bitmask.length

  for (let harvEid = 1; harvEid < N; harvEid++) {
    const mask = world.bitmask[harvEid]
    if ((mask & C.HARVESTER) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.TOWER_DISABLED) !== 0) continue

    if (_isConnectedToPing(world, harvEid, N)) {
      world.eddies     += world.harvesterEddiesPerTick[harvEid]
      world.components += world.harvesterComponentsPerTick[harvEid]
    }
  }
}

/** Returns true if the given entity is within Chebyshev range of any active Ping Tower. */
function _isConnectedToPing(world: World, eid: number, N: number): boolean {
  const hx = world.posX[eid]
  const hy = world.posY[eid]

  for (let pingEid = 1; pingEid < N; pingEid++) {
    const pm = world.bitmask[pingEid]
    if ((pm & C.PING_RANGE) === 0) continue
    if ((pm & C.PENDING_REMOVAL) !== 0) continue
    if ((pm & C.TOWER_DISABLED) !== 0) continue

    const dist = Math.max(
      Math.abs(hx - world.posX[pingEid]),
      Math.abs(hy - world.posY[pingEid]),
    )
    if (dist <= world.pingRange[pingEid]) return true
  }
  return false
}

/**
 * §5.6 — Blackwall Tower per-tick logic:
 *   - Take passive damage from adjacent open gateway (§5.6.6)
 *   - Deal damage to assigned gateway (§5.6.2)
 *   - Auto-repair HP using player components (§5.6.7)
 */
function _blackwallTowersTick(world: World): void {
  const N = world.bitmask.length

  for (let bwEid = 1; bwEid < N; bwEid++) {
    const mask = world.bitmask[bwEid]
    if ((mask & C.BLACKWALL_TOWER) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue

    const gwEid = world.blackwallAssignedGateway[bwEid]
    if (gwEid === 0 || (world.bitmask[gwEid] & C.GATEWAY) === 0) continue
    if ((world.bitmask[gwEid] & C.PENDING_REMOVAL) !== 0) continue

    // §5.6.6 — Passive damage taken from gateway
    world.healthCurrent[bwEid] -= BLACKWALL_PASSIVE_DPT
    if (world.healthCurrent[bwEid] <= 0) {
      world.healthCurrent[bwEid] = 0
      markForRemoval(world, bwEid)
      continue
    }

    // §5.6.2 — Deal damage to the gateway
    world.gatewayHp[gwEid] -= world.blackwallDamagePerTick[bwEid]
    if (world.gatewayHp[gwEid] <= 0) {
      // §5.6.5 — Gateway fully closed; remove it
      markForRemoval(world, gwEid)
    } else {
      // §5.6.3 — Mark as closing so spawning is suppressed
      world.gatewayIsClosing[gwEid] = 1
    }

    // §5.6.7 — Auto-repair if below max HP
    if (world.healthCurrent[bwEid] < world.healthMax[bwEid]) {
      const repairNeeded = world.healthMax[bwEid] - world.healthCurrent[bwEid]

      if (world.components >= BLACKWALL_REPAIR_COMPONENTS) {
        // Full repair
        world.healthCurrent[bwEid] = world.healthMax[bwEid]
        world.components -= BLACKWALL_REPAIR_COMPONENTS
      } else if (world.components > 0) {
        // Partial repair proportional to available components
        const repairFraction = world.components / BLACKWALL_REPAIR_COMPONENTS
        world.healthCurrent[bwEid] += repairNeeded * repairFraction
        world.components = 0
      }
    }
  }
}
