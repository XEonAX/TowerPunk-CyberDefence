/**
 * AI Overlord Boss tests — §7.8
 *
 * Covers phase mechanics, damage immunity, vulnerability, phase transitions,
 * and tile-based spawning.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createEnemy,
  createTower,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { damageSystem } from '../damage.system'
import { eventSystem } from '../event.system'
import { movementSystem } from '../movement.system'
import { GamePhase } from '../../ecs/world'
import {
  AI_OVERLORD_PHASE_DURATION_TICKS,
  GATEWAY_HP,
} from '../../constants'
import { idx } from '../../pathfinding/grid'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

/**
 * Create an AI Overlord at (tx, ty) without spawn immunity,
 * at the given phase, with given damageMult.
 */
function makeAiOverlord(
  tx: number,
  ty: number,
  phase: number,
  damageMult = 1.0,
  phaseStartTick = 0,
): number {
  const eid = createEnemy(world)
  world.enemyType[eid] = C.EnemyType.AI_OVERLORD
  world.tilePosX[eid] = tx
  world.tilePosY[eid] = ty
  world.enemyDamage[eid] = 50
  world.healthMax[eid] = 1000
  world.healthCurrent[eid] = 1000
  world.enemySpeed[eid] = 0.5
  world.enemyTier[eid] = 8
  world.aiOverlordPhase[eid] = phase
  world.aiOverlordDamageMult[eid] = damageMult
  world.aiOverlordPhaseStartTick[eid] = phaseStartTick
  world.aiOverlordTilesTraveled[eid] = 0
  world.bitmask[eid] &= ~C.SPAWN_IMMUNITY
  world.enemiesAlive++
  return eid
}

/**
 * Create an ICE_WALL tower at (tx, ty) level 1.
 * ICE_WALL applies DoT to adjacent enemies each tick.
 */
function makeIceWall(tx: number, ty: number): number {
  const teid = createTower(world)
  world.towerType[teid] = C.TowerType.ICE_WALL
  world.towerLevel[teid] = 1
  world.posX[teid] = tx
  world.posY[teid] = ty
  world.healthMax[teid] = 200
  world.healthCurrent[teid] = 200
  return teid
}

// ---------------------------------------------------------------------------
// §7.8.1 — Phase 1 damage immunity
// ---------------------------------------------------------------------------

describe('AI Overlord §7.8.1 — phase 1 is immune to all damage', () => {
  it('takes no damage from ICE_WALL in phase 1', () => {
    const eid = makeAiOverlord(5, 5, 1)
    const hpBefore = world.healthCurrent[eid]

    // Place ICE_WALL adjacent — it deals DoT to enemies within Chebyshev 1
    makeIceWall(5, 6)

    damageSystem(world)

    expect(world.healthCurrent[eid]).toBe(hpBefore)
  })

  it('can be damaged in phase 2', () => {
    const eid = makeAiOverlord(5, 5, 2, 1.0)
    const hpBefore = world.healthCurrent[eid]

    makeIceWall(5, 6)

    damageSystem(world)

    expect(world.healthCurrent[eid]).toBeLessThan(hpBefore)
  })
})

// ---------------------------------------------------------------------------
// §7.8.5 — Phase 3 takes 50% extra damage
// ---------------------------------------------------------------------------

describe('AI Overlord §7.8.5 — phase 3 takes 50% more damage', () => {
  it('phase 3 with 1.5× multiplier takes more damage than phase 2', () => {
    // Run two separate worlds to compare
    const world2 = createWorld(42)
    const world3 = createWorld(42)

    // Phase 2 overlord
    const eid2 = createEnemy(world2)
    world2.enemyType[eid2] = C.EnemyType.AI_OVERLORD
    world2.tilePosX[eid2] = 5
    world2.tilePosY[eid2] = 5
    world2.healthMax[eid2] = 1000
    world2.healthCurrent[eid2] = 1000
    world2.enemySpeed[eid2] = 0.5
    world2.enemyTier[eid2] = 8
    world2.aiOverlordPhase[eid2] = 2
    world2.aiOverlordDamageMult[eid2] = 1.0
    world2.bitmask[eid2] &= ~C.SPAWN_IMMUNITY
    world2.enemiesAlive++
    const tw2 = createTower(world2)
    world2.towerType[tw2] = C.TowerType.ICE_WALL
    world2.towerLevel[tw2] = 1
    world2.posX[tw2] = 5
    world2.posY[tw2] = 6
    world2.healthMax[tw2] = 200
    world2.healthCurrent[tw2] = 200
    damageSystem(world2)

    // Phase 3 overlord
    const eid3 = createEnemy(world3)
    world3.enemyType[eid3] = C.EnemyType.AI_OVERLORD
    world3.tilePosX[eid3] = 5
    world3.tilePosY[eid3] = 5
    world3.healthMax[eid3] = 1000
    world3.healthCurrent[eid3] = 1000
    world3.enemySpeed[eid3] = 0.5
    world3.enemyTier[eid3] = 8
    world3.aiOverlordPhase[eid3] = 3
    world3.aiOverlordDamageMult[eid3] = 1.5
    world3.bitmask[eid3] &= ~C.SPAWN_IMMUNITY
    world3.enemiesAlive++
    const tw3 = createTower(world3)
    world3.towerType[tw3] = C.TowerType.ICE_WALL
    world3.towerLevel[tw3] = 1
    world3.posX[tw3] = 5
    world3.posY[tw3] = 6
    world3.healthMax[tw3] = 200
    world3.healthCurrent[tw3] = 200
    damageSystem(world3)

    const dmgPhase2 = 1000 - world2.healthCurrent[eid2]
    const dmgPhase3 = 1000 - world3.healthCurrent[eid3]

    expect(dmgPhase2).toBeGreaterThan(0)
    // Allow 3 decimal places tolerance — ICE_WALL DPS/tick (1/60) is Float32, so 1.5× has rounding
    expect(dmgPhase3).toBeCloseTo(dmgPhase2 * 1.5, 3)
  })
})

// ---------------------------------------------------------------------------
// §7.8.7/7.8.8 — Phase transitions every 1800 ticks
// ---------------------------------------------------------------------------

describe('AI Overlord §7.8.7/7.8.8 — phase transitions', () => {
  it('transitions from phase 1 → phase 2 after 1800 ticks', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    const eid = makeAiOverlord(5, 5, 1, 1.0, 0)
    world.tickCount = AI_OVERLORD_PHASE_DURATION_TICKS

    eventSystem(world)

    expect(world.aiOverlordPhase[eid]).toBe(2)
    expect(world.aiOverlordPhaseStartTick[eid]).toBe(AI_OVERLORD_PHASE_DURATION_TICKS)
  })

  it('does NOT transition before 1800 ticks', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    const eid = makeAiOverlord(5, 5, 1, 1.0, 0)
    world.tickCount = AI_OVERLORD_PHASE_DURATION_TICKS - 1

    eventSystem(world)

    expect(world.aiOverlordPhase[eid]).toBe(1)
  })

  it('transitions from phase 2 → phase 3 after another 1800 ticks and sets damageMult to 1.5', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    const eid = makeAiOverlord(5, 5, 2, 1.0, 0)
    world.tickCount = AI_OVERLORD_PHASE_DURATION_TICKS

    eventSystem(world)

    expect(world.aiOverlordPhase[eid]).toBe(3)
    expect(world.aiOverlordDamageMult[eid]).toBe(1.5)
  })

  it('does NOT transition past phase 3', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    const eid = makeAiOverlord(5, 5, 3, 1.5, 0)
    world.tickCount = AI_OVERLORD_PHASE_DURATION_TICKS * 10

    eventSystem(world)

    expect(world.aiOverlordPhase[eid]).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// §7.8.2 — Spawns Gateway every 5 tiles (phase 1)
// ---------------------------------------------------------------------------

describe('AI Overlord §7.8.2 — spawns Gateway every 5 tiles in phase 1', () => {
  it('spawns a Gateway when aiOverlordTilesTraveled reaches a multiple of 5', () => {
    // Set up flowfield: position (10,10) points East
    const DIR_E = 2
    world.flowDir[idx(10, 10)] = DIR_E

    const eid = makeAiOverlord(10, 10, 1, 1.0)
    // Set tilesTraveled to 4 so next tile-entry (#5) triggers spawn
    world.aiOverlordTilesTraveled[eid] = 4
    // Speed high enough for a tile transition in one tick
    world.enemySpeed[eid] = 60  // 60 tiles/sec → 1 tile/tick
    world.tileProgress[eid] = 0

    const gwCountBefore = world.activeGatewayCount
    movementSystem(world)

    expect(world.activeGatewayCount).toBe(gwCountBefore + 1)
    expect(world.aiOverlordTilesTraveled[eid]).toBe(5)

    // Check gateway was placed at (11,10) — the new tile
    let found = false
    for (let i = 0; i < world.activeGatewayCount; i++) {
      const gwEid = world.activeGateways[i]
      if (world.gatewayX[gwEid] === 11 && world.gatewayY[gwEid] === 10) {
        expect(world.gatewayHp[gwEid]).toBe(GATEWAY_HP)
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })

  it('does NOT spawn on non-multiples of 5', () => {
    const DIR_E = 2
    world.flowDir[idx(10, 10)] = DIR_E

    const eid = makeAiOverlord(10, 10, 1, 1.0)
    world.aiOverlordTilesTraveled[eid] = 3  // next will be 4 — not a multiple of 5
    world.enemySpeed[eid] = 60
    world.tileProgress[eid] = 0

    const gwCountBefore = world.activeGatewayCount
    movementSystem(world)

    expect(world.activeGatewayCount).toBe(gwCountBefore)
  })
})
