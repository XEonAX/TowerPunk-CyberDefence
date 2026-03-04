/**
 * Simulation Driver — Tech.md §3.1
 *
 * Manages the fixed-timestep game world and tick pipeline.
 * All 14 systems are wired in §1.10 order.
 */

import { createWorld, type World } from './ecs/world'
import { commandSystem } from './systems/command.system'
import { eventSystem } from './systems/event.system'
import { spawnSystem } from './systems/spawn.system'
import { statusApplySystem } from './systems/statusApply.system'
import { statusExpireSystem } from './systems/statusExpire.system'
import { movementSystem } from './systems/movement.system'
import { enemyAuraSystem } from './systems/enemyAura.system'
import { targetingSystem } from './systems/targeting.system'
import { damageSystem } from './systems/damage.system'
import { statusQueueSystem } from './systems/statusQueue.system'
import { pickupDecaySystem } from './systems/pickupDecay.system'
import { cleanupSystem } from './systems/cleanup.system'
import { pickupCollectSystem } from './systems/pickupCollect.system'
import { resourceSystem } from './systems/resource.system'

export interface Simulation {
  readonly world: World
  tick(): void
  getWorld(): World
}

export function createSimulation(seed: number = 12345): Simulation {
  const world = createWorld(seed)

  function tick(): void {
    // §1.10 pipeline — exact order
    commandSystem(world)     // §1.10.0 — pre-pipeline, process player commands
    eventSystem(world)       // §1.10.1
    spawnSystem(world)       // §1.10.2
    statusApplySystem(world) // §1.10.3
    statusExpireSystem(world)// §1.10.4
    movementSystem(world)    // §1.10.5
    enemyAuraSystem(world)   // §1.10.6
    targetingSystem(world)   // §1.10.7
    damageSystem(world)      // §1.10.8–9
    statusQueueSystem(world) // §1.10.10
    pickupDecaySystem(world) // §1.10.11
    cleanupSystem(world)     // §1.10.12
    pickupCollectSystem(world)// §1.10.13
    resourceSystem(world)    // §1.10.14

    world.tickCount++
  }

  return {
    world,
    tick,
    getWorld: () => world,
  }
}
