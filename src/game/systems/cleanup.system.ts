/**
 * Cleanup System — §1.10.12
 *
 * Processes all entities in the removalQueue:
 *  - Enemies: compute Eddie/Component drop value (§7.0.7–7.0.8), create
 *    Pickup entity at death tile position.
 *  - Towers with FIREWALL_LINK: destroy both towers simultaneously (§5.2.4).
 *  - Gateways: remove from activeGateways registry.
 *  - All marked entities: pool.destroy + bitmask cleared.
 */

import { markForRemoval, createPickup, spawnInteriorGateway, type World } from '../ecs/world'
import * as C from '../ecs/component'
import { CORE_X, CORE_Y, TICK_RATE } from '../constants'
import { idx } from '../pathfinding/grid'
import { computeDualFlowfields } from '../pathfinding/flowfield'

export function cleanupSystem(world: World): void {
  // First pass: ensure Firewall partners are also queued (§5.2.4)
  const initialLen = world.removalQueueLen
  for (let i = 0; i < initialLen; i++) {
    const eid = world.removalQueue[i]
    if ((world.bitmask[eid] & C.FIREWALL_LINK) !== 0) {
      const partner = world.firewallPartner[eid]
      if (partner !== 0 && (world.bitmask[partner] & C.PENDING_REMOVAL) === 0) {
        markForRemoval(world, partner)
      }
    }
  }

  // Second pass: destroy all queued entities (including newly added Firewall partners)
  const totalLen = world.removalQueueLen
  let gridChanged = false
  for (let i = 0; i < totalLen; i++) {
    const eid = world.removalQueue[i]
    const mask = world.bitmask[eid]

    // ----- Tower destruction — free grid tile(s) -----
    // This handles towers destroyed by enemy aura or other non-command paths.
    // (Command handlers already clear the grid before queuing removal, so
    // clearing here a second time is harmless — idempotent zeroing.)
    if ((mask & C.TOWER) !== 0) {
      const tx = world.posX[eid] | 0
      const ty = world.posY[eid] | 0
      const ti = idx(tx, ty)
      if (world.gridBlocked[ti] !== 0) {
        world.gridBlocked[ti]   = 0
        world.gridTowerType[ti] = 0
        gridChanged = true
      }
    }

    // ----- Enemy death -----
    if ((mask & C.ENEMY) !== 0) {
      world.enemiesAlive = Math.max(0, world.enemiesAlive - 1)

      // §7.0.7: Enemies reaching the Core do NOT drop resources.
      // movement system places them on Core tile before marking for removal.
      const reachedCore =
        world.tilePosX[eid] === CORE_X && world.tilePosY[eid] === CORE_Y
      if (!reachedCore) {
        dropEnemyPickup(world, eid)
      }

      // §7.5.1: Orchestrator spawns a Gateway at its death tile
      if (world.enemyType[eid] === C.EnemyType.ORCHESTRATOR) {
        spawnInteriorGateway(world, world.tilePosX[eid], world.tilePosY[eid])
      }
    }

    // ----- Gateway removal -----
    if ((mask & C.GATEWAY) !== 0) {
      removeFromActiveGateways(world, eid)
    }

    // ----- Destroy entity -----
    world.bitmask[eid] = 0
    world.pool.destroy(eid)
  }

  // Recompute flowfields once if any tower tile was freed
  if (gridChanged) {
    computeDualFlowfields(
      { blocked: world.gridBlocked, towerType: world.gridTowerType },
      world.flowCost, world.flowDir,
      world.glitchCost, world.glitchDir,
    )
  }

  world.removalQueueLen = 0
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Drop an Eddie/Component pickup at the enemy's current tile position.
 * §7.0.8: Value = (Damage + Health) × Speed × Tier
 *         (using already-scaled stats stored on the entity)
 * §7.0.8: Every full 100 Eddies converts to 1 Component.
 */
function dropEnemyPickup(world: World, eid: number): void {
  const scaledDmg  = world.enemyDamage[eid]
  const scaledHp   = world.healthMax[eid]
  const speedPerSec = world.enemySpeed[eid]  // tiles/sec (stored at spawn)
  const tier        = world.enemyTier[eid]

  const value = (scaledDmg + scaledHp) * speedPerSec * tier
  if (value <= 0) return

  const componentDrop = Math.floor(value / 100)
  const eddyDrop      = value % 100

  const px = world.tilePosX[eid]
  const py = world.tilePosY[eid]

  const pickupEid = createPickup(world)
  world.posX[pickupEid]             = px
  world.posY[pickupEid]             = py
  world.pickupEddies[pickupEid]     = eddyDrop
  world.pickupComponents[pickupEid] = componentDrop

  // §4.2.5: Pickup decays at 5/60/100 per tick as fraction of initial value
  const initialValue = eddyDrop + componentDrop * 100
  world.pickupInitialValue[pickupEid]   = initialValue
  world.pickupDecayPerTick[pickupEid]   = (5 / TICK_RATE / 100) * initialValue
}

/** Remove a gateway entity from the activeGateways round-robin registry. */
function removeFromActiveGateways(world: World, eid: number): void {
  for (let i = 0; i < world.activeGatewayCount; i++) {
    if (world.activeGateways[i] === eid) {
      // Swap with last to keep array dense
      world.activeGateways[i] = world.activeGateways[world.activeGatewayCount - 1]
      world.activeGatewayCount--
      if (world.activeGatewayCount > 0) {
        world.spawnGatewayIndex = world.spawnGatewayIndex % world.activeGatewayCount
      } else {
        world.spawnGatewayIndex = 0
      }
      break
    }
  }
}
