/**
 * Simulation Driver — Tech.md §3.1
 *
 * Manages the fixed-timestep game world and tick pipeline.
 */

import { createWorld, type World } from './ecs/world'
import type { System } from './ecs/system'
import { noopSystem } from './ecs/system'

// ---------------------------------------------------------------------------
// Tick pipeline — §1.10
// Systems will be replaced as they are implemented in later phases.
// ---------------------------------------------------------------------------

let commandSystem: System = noopSystem
let eventSystem: System = noopSystem
let spawnSystem: System = noopSystem
let statusApplySystem: System = noopSystem
let statusExpireSystem: System = noopSystem
let movementSystem: System = noopSystem
let enemyAuraSystem: System = noopSystem
let targetingSystem: System = noopSystem
let damageSystem: System = noopSystem
let statusQueueSystem: System = noopSystem
let pickupDecaySystem: System = noopSystem
let cleanupSystem: System = noopSystem
let pickupCollectSystem: System = noopSystem
let resourceSystem: System = noopSystem

/** Replace a pipeline system (used when real systems are wired in). */
export function registerSystem(
  slot: keyof typeof PIPELINE_SLOTS,
  system: System,
): void {
  switch (slot) {
    case 'command': commandSystem = system; break
    case 'event': eventSystem = system; break
    case 'spawn': spawnSystem = system; break
    case 'statusApply': statusApplySystem = system; break
    case 'statusExpire': statusExpireSystem = system; break
    case 'movement': movementSystem = system; break
    case 'enemyAura': enemyAuraSystem = system; break
    case 'targeting': targetingSystem = system; break
    case 'damage': damageSystem = system; break
    case 'statusQueue': statusQueueSystem = system; break
    case 'pickupDecay': pickupDecaySystem = system; break
    case 'cleanup': cleanupSystem = system; break
    case 'pickupCollect': pickupCollectSystem = system; break
    case 'resource': resourceSystem = system; break
  }
}

const PIPELINE_SLOTS = {
  command: 0, event: 1, spawn: 2, statusApply: 3,
  statusExpire: 4, movement: 5, enemyAura: 6, targeting: 7,
  damage: 8, statusQueue: 9, pickupDecay: 10, cleanup: 11,
  pickupCollect: 12, resource: 13,
} as const

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
