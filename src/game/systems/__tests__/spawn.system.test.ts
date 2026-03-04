/**
 * Spawn System tests — §1.10.2
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createGateway,
  GamePhase,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { spawnSystem } from '../spawn.system'
import { SPAWN_INTERVAL_TICKS } from '../../wave'
import { SPAWN_IMMUNITY_TICKS } from '../../constants'

/** Helper: add a gateway at position (gx, gy) to the world's active gateways. */
function addGateway(world: World, gx: number, gy: number): number {
  const geid = createGateway(world)
  world.gatewayX[geid] = gx
  world.gatewayY[geid] = gy
  world.gatewayIsClosing[geid] = 0
  world.activeGateways[world.activeGatewayCount++] = geid
  return geid
}

let world: World

beforeEach(() => {
  world = createWorld(42)
  // Set a useful flowfield direction: north (DIR_N=0) is default (Uint8Array)
  // Place a gateway at edge tile (0, 0)
  addGateway(world, 0, 0)
})

describe('phase guard', () => {
  it('does NOT spawn enemies outside WAVE_ACTIVE phase', () => {
    world.currentPhase = GamePhase.PRE_GAME
    world.currentWave = 1
    world.waveEnemyList = [0] // DATA_LEECH
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 0
    world.tickCount = 0

    const alivesBefore = world.enemiesAlive
    spawnSystem(world)
    expect(world.enemiesAlive).toBe(alivesBefore)
    expect(world.waveSpawnIndex).toBe(0)
  })

  it('does NOT spawn when in WAVE_BREAK phase', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.waveEnemyList = [0]
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 0

    spawnSystem(world)
    expect(world.waveSpawnIndex).toBe(0)
  })
})

describe('spawn timing', () => {
  it('does not spawn if tickCount < nextSpawnTick', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    world.waveEnemyList = [0]
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 50
    world.tickCount = 30

    spawnSystem(world)

    expect(world.waveSpawnIndex).toBe(0)
    expect(world.enemiesAlive).toBe(0)
  })

  it('spawns enemy when tickCount >= nextSpawnTick', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    world.waveEnemyList = [0]  // DATA_LEECH
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 30
    world.tickCount = 30

    spawnSystem(world)

    expect(world.waveSpawnIndex).toBe(1)
    expect(world.enemiesAlive).toBe(1)
  })

  it('advances nextSpawnTick by SPAWN_INTERVAL_TICKS after spawning', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    world.waveEnemyList = [0]
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 30
    world.tickCount = 30

    spawnSystem(world)

    expect(world.nextSpawnTick).toBe(30 + SPAWN_INTERVAL_TICKS)
  })
})

describe('spawned enemy properties', () => {
  it('spawned enemy has correct enemyType set', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    // CODE_RUNNER (type 1)
    world.waveEnemyList = [1]
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 0
    world.tickCount = 0

    spawnSystem(world)

    // Find the newly created enemy entity
    let foundEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if ((world.bitmask[eid] & C.ENEMY) !== 0) {
        foundEid = eid
        break
      }
    }
    expect(foundEid).toBeGreaterThan(0)
    expect(world.enemyType[foundEid]).toBe(1) // CODE_RUNNER
  })

  it('spawned enemy has 30-tick spawn immunity (§2.10.1)', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    world.waveEnemyList = [0]  // DATA_LEECH
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 0
    world.tickCount = 0

    spawnSystem(world)

    let foundEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if ((world.bitmask[eid] & C.ENEMY) !== 0) {
        foundEid = eid
        break
      }
    }
    expect(foundEid).toBeGreaterThan(0)
    expect(world.spawnImmunityTicks[foundEid]).toBe(SPAWN_IMMUNITY_TICKS)
    expect(world.bitmask[foundEid] & C.SPAWN_IMMUNITY).toBeTruthy()
  })

  it('spawned enemy starts at gateway tile position', () => {
    // Gateway is at (0, 0) from beforeEach
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    world.waveEnemyList = [0]
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 0
    world.tickCount = 0

    spawnSystem(world)

    let foundEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if ((world.bitmask[eid] & C.ENEMY) !== 0) {
        foundEid = eid
        break
      }
    }
    expect(foundEid).toBeGreaterThan(0)
    expect(world.tilePosX[foundEid]).toBe(0)
    expect(world.tilePosY[foundEid]).toBe(0)
  })

  it('spawned enemy has HEALTH component with scaled HP', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1  // scaling = 1 + 0.1*1 = 1.1
    world.waveEnemyList = [0]  // DATA_LEECH base health = 10
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 0
    world.tickCount = 0

    spawnSystem(world)

    let foundEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if ((world.bitmask[eid] & C.ENEMY) !== 0) {
        foundEid = eid
        break
      }
    }
    expect(foundEid).toBeGreaterThan(0)
    // DATA_LEECH base health = 10, wave 1 scaling = 1.1 → 11
    expect(world.healthMax[foundEid]).toBeCloseTo(11, 4)
    expect(world.healthCurrent[foundEid]).toBeCloseTo(11, 4)
  })
})

describe('no active gateways', () => {
  it('does not spawn when no active gateways', () => {
    // Remove the gateway added in beforeEach
    world.activeGatewayCount = 0
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.waveEnemyList = [0]
    world.waveSpawnIndex = 0
    world.nextSpawnTick = 0
    world.tickCount = 0

    spawnSystem(world)

    expect(world.enemiesAlive).toBe(0)
  })
})
