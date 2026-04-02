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
 * Rulebook §6.2.2: Overclock on Harvester boosts Eddie generation.
 * Rulebook §6.4:   Boosted Ping Tower multiplies connected Harvester Eddie generation.
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'
import { CommandType, GamePhase, markForRemoval } from '../ecs/world'
import {
  BLACKWALL_PASSIVE_DPT,
  BLACKWALL_REPAIR_COMPONENTS,
  BLACKWALL_REPAIR_THRESHOLD,
  BOOSTED_MULTIPLIER,
  EDDIES_PER_COMPONENT,
} from '../constants'

export function resourceSystem(world: World): void {
  _harvestersGenerate(world)
  _blackwallTowersTick(world)
  _autoConvertEddies(world)
}

/**
 * §4.2.9 — Auto-convert Eddies into Components whenever the balance crosses 10000.
 * Every full 100-Eddie batch is converted; the remainder (< 100) stays as Eddies.
 */
function _autoConvertEddies(world: World): void {
  if (world.eddies < 10000) return
  const batches = Math.floor(world.eddies / EDDIES_PER_COMPONENT)
  world.eddies     -= batches * EDDIES_PER_COMPONENT
  world.components += batches
  // Auto-start the wave when the player farms enough Eddies to convert in PRE_GAME.
  if (world.currentPhase === GamePhase.PRE_GAME) {
    world.commandQueue.push({ type: CommandType.START_WAVE })
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Result of checking whether a Harvester is connected to a Ping Tower. */
interface PingConnection {
  connected: boolean
  /** Best Eddie-generation multiplier from any Boosted Ping Tower in range (§6.4) */
  boostMultiplier: number
}

/**
 * Scan all Ping Towers and return connection info for the given Harvester entity.
 * Iterates all ping towers (not just the first) to find the best Boosted multiplier.
 */
function _getHarvesterConnection(
  world: World,
  eid: number,
  N: number,
): PingConnection {
  const hx = world.posX[eid]
  const hy = world.posY[eid]
  let connected      = false
  let boostMultiplier = 1.0

  for (let pingEid = 1; pingEid < N; pingEid++) {
    const pm = world.bitmask[pingEid]
    if ((pm & C.PING_RANGE) === 0) continue
    if ((pm & C.PENDING_REMOVAL) !== 0) continue
    if ((pm & C.TOWER_DISABLED) !== 0) continue

    const dist = Math.max(
      Math.abs(hx - world.posX[pingEid]),
      Math.abs(hy - world.posY[pingEid]),
    )
    if (dist > world.pingRange[pingEid]) continue

    connected = true

    // §6.4 — Check for Boosted ability (passive, no activation needed)
    if (
      (pm & C.ABILITY) !== 0 &&
      world.abilityType[pingEid] === C.AbilityType.BOOSTED &&
      world.abilityLevel[pingEid] > 0
    ) {
      const bm = BOOSTED_MULTIPLIER[world.abilityLevel[pingEid] - 1] ?? 1.0
      if (bm > boostMultiplier) boostMultiplier = bm
    }
  }

  return { connected, boostMultiplier }
}

/**
 * §5.8.1–5.8.2 — Harvester generation.
 * Only generates if at least one non-disabled Ping Tower is within Chebyshev range.
 * §6.2.2 — Overclock on Harvester boosts Eddie generation.
 * §6.4   — Boosted Ping Tower multiplies Eddie generation of connected Harvesters.
 */
function _harvestersGenerate(world: World): void {
  const N = world.bitmask.length

  for (let harvEid = 1; harvEid < N; harvEid++) {
    const mask = world.bitmask[harvEid]
    if ((mask & C.HARVESTER) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if ((mask & C.TOWER_DISABLED) !== 0) continue

    const conn = _getHarvesterConnection(world, harvEid, N)
    if (!conn.connected) continue

    let eddiesThisTick = world.harvesterEddiesPerTick[harvEid]

    // §6.4 — Boosted multiplier from connected Ping Tower
    if (conn.boostMultiplier > 1.0) {
      eddiesThisTick *= conn.boostMultiplier
    }

    // §6.2.2 — Overclock on Harvester boosts Eddie generation
    if (
      (mask & C.ABILITY) !== 0 &&
      world.overclockActive[harvEid] !== 0
    ) {
      eddiesThisTick *= world.overclockMultiplier[harvEid]
    }

    // §8.3.1 — Skip Break bonus: 2× Eddie generation for SKIP_BONUS_TICKS after skipping break
    if (world.skipBonusTicks > 0) {
      eddiesThisTick *= 2
    }

    world.eddies     += eddiesThisTick
    world.components += world.harvesterComponentsPerTick[harvEid]
  }
}

/**
 * §5.6 — Blackwall Tower per-tick logic:
 *   - Take passive damage from each adjacent open gateway (§5.6.6)
 *   - Deal damage to each adjacent gateway (§5.6.2)
 *   - Auto-repair HP using player components (§5.6.7)
 *
 * Adjacency is evaluated dynamically every tick (Chebyshev ≤ 1) so that:
 *   - A tower adjacent to multiple gateways affects all of them.
 *   - When a gateway closes, towers automatically stop targeting it (§9.2.7).
 *   - No stale stored-assignment can point to a recycled gateway entity.
 */
function _blackwallTowersTick(world: World): void {
  const N = world.bitmask.length

  // §9.2.7 — Reset gatewayIsClosing each tick; re-set below only while a tower
  // is actively adjacent.  This ensures gateways reopen immediately when all
  // adjacent Blackwall Towers are destroyed.
  for (let i = 0; i < world.activeGatewayCount; i++) {
    const gwEid = world.activeGateways[i]
    if ((world.bitmask[gwEid] & C.PENDING_REMOVAL) === 0) {
      world.gatewayIsClosing[gwEid] = 0
    }
  }

  for (let bwEid = 1; bwEid < N; bwEid++) {
    const mask = world.bitmask[bwEid]
    if ((mask & C.BLACKWALL_TOWER) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue

    const bwX = world.posX[bwEid]
    const bwY = world.posY[bwEid]

    // §5.6.1 — Affect all adjacent (Chebyshev ≤ 1) open gateways
    for (let i = 0; i < world.activeGatewayCount; i++) {
      const gwEid = world.activeGateways[i]
      if ((world.bitmask[gwEid] & C.GATEWAY) === 0) continue
      if ((world.bitmask[gwEid] & C.PENDING_REMOVAL) !== 0) continue
      const dx = Math.abs(bwX - world.gatewayX[gwEid])
      const dy = Math.abs(bwY - world.gatewayY[gwEid])
      if (Math.max(dx, dy) > 1) continue

      // §5.6.6 — Passive damage taken per adjacent open gateway
      world.healthCurrent[bwEid] -= BLACKWALL_PASSIVE_DPT
      if (world.healthCurrent[bwEid] <= 0) {
        world.healthCurrent[bwEid] = 0
        markForRemoval(world, bwEid)
        break // tower is dead — stop processing further gateways
      }

      // §5.6.2 — Deal damage to this gateway
      world.gatewayHp[gwEid] -= world.blackwallDamagePerTick[bwEid]
      if (world.gatewayHp[gwEid] <= 0) {
        // §5.6.5 — Gateway fully closed; remove it
        markForRemoval(world, gwEid)
      } else {
        // §5.6.3 — Mark as closing so spawning is suppressed
        world.gatewayIsClosing[gwEid] = 1
      }
    }

    if ((world.bitmask[bwEid] & C.PENDING_REMOVAL) !== 0) continue

    // §5.6.7 — Auto-repair triggers when HP drops to BLACKWALL_REPAIR_THRESHOLD (10%)
    if (world.healthCurrent[bwEid] <= world.healthMax[bwEid] * BLACKWALL_REPAIR_THRESHOLD) {
      const repairNeeded = world.healthMax[bwEid] - world.healthCurrent[bwEid]
      // Cost per HP: BLACKWALL_REPAIR_COMPONENTS buys a full restore.
      const costPerHp = BLACKWALL_REPAIR_COMPONENTS / world.healthMax[bwEid]
      const affordableHp = world.components / costPerHp

      if (world.components >= BLACKWALL_REPAIR_COMPONENTS) {
        // Full repair
        world.healthCurrent[bwEid] = world.healthMax[bwEid]
        world.components -= BLACKWALL_REPAIR_COMPONENTS
      } else if (world.components > 0) {
        // Partial repair — cost is proportional to HP actually restored,
        // not a flat drain of all available components.
        const actualHeal = Math.min(repairNeeded, affordableHp)
        world.healthCurrent[bwEid] += actualHeal
        world.components -= actualHeal * costPerHp
      }
    }
  }
}
