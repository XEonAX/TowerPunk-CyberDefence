/**
 * Gateway Lifecycle tests — §9.2
 *
 * Verifies gateway creation, HP tracking, Blackwall Tower damage interaction,
 * closing suppression of spawning, and cleanup registry behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createGateway,
  createTower,
  GamePhase,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { resourceSystem } from '../resource.system'
import { spawnSystem } from '../spawn.system'
import { cleanupSystem } from '../cleanup.system'
import { computeDualFlowfields } from '../../pathfinding/flowfield'
import {
  GATEWAY_HP,
  BLACKWALL_TOWER_HP,
  BLACKWALL_TOWER_DPT,
} from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// Entity creation helpers
// ---------------------------------------------------------------------------

function makeOpenGateway(world: World, x: number, y: number): number {
  const gwEid = createGateway(world)
  world.posX[gwEid] = x
  world.posY[gwEid] = y
  world.gatewayX[gwEid] = x
  world.gatewayY[gwEid] = y
  world.gatewayHp[gwEid] = GATEWAY_HP
  world.gatewayMaxHp[gwEid] = GATEWAY_HP
  world.gatewayIsClosing[gwEid] = 0
  world.activeGateways[world.activeGatewayCount++] = gwEid
  world.totalGatewaysCreated++
  return gwEid
}

function makeBlackwallTower(
  world: World,
  x: number,
  y: number,
  assignedGateway: number,
): number {
  const eid = createTower(world, C.BLACKWALL_TOWER)
  world.posX[eid] = x
  world.posY[eid] = y
  world.healthMax[eid] = BLACKWALL_TOWER_HP[0]
  world.healthCurrent[eid] = BLACKWALL_TOWER_HP[0]
  world.towerLevel[eid] = 1
  world.blackwallAssignedGateway[eid] = assignedGateway
  world.blackwallDamagePerTick[eid] = BLACKWALL_TOWER_DPT[0]
  return eid
}

function computeFlowfields(world: World): void {
  computeDualFlowfields(
    { blocked: world.gridBlocked, towerType: world.gridTowerType },
    world.flowCost, world.flowDir,
    world.glitchCost, world.glitchDir,
  )
}

// ---------------------------------------------------------------------------
// §9.2 — Gateway entity creation
// ---------------------------------------------------------------------------

describe('§9.2 — Gateway entity creation', () => {
  it('createGateway produces entity with GATEWAY bitmask', () => {
    const eid = createGateway(world)
    expect(world.bitmask[eid] & C.GATEWAY).toBeTruthy()
  })

  it('createGateway produces entity with POSITION bitmask', () => {
    const eid = createGateway(world)
    expect(world.bitmask[eid] & C.POSITION).toBeTruthy()
  })

  it('new gateway starts with full HP (§9.2.9)', () => {
    const eid = makeOpenGateway(world, 5, 5)
    expect(world.gatewayHp[eid]).toBe(GATEWAY_HP)
    expect(world.gatewayMaxHp[eid]).toBe(GATEWAY_HP)
  })

  it('GATEWAY_HP constant equals 10000 (§9.2.9)', () => {
    expect(GATEWAY_HP).toBe(10000)
  })

  it('new gateway starts with gatewayIsClosing = 0', () => {
    const eid = makeOpenGateway(world, 5, 5)
    expect(world.gatewayIsClosing[eid]).toBe(0)
  })

  it('makeOpenGateway registers in activeGateways', () => {
    const eid = makeOpenGateway(world, 5, 5)
    let found = false
    for (let i = 0; i < world.activeGatewayCount; i++) {
      if (world.activeGateways[i] === eid) { found = true; break }
    }
    expect(found).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// §5.6.2 / §9.2.6 — Blackwall Tower reduces gateway HP
// ---------------------------------------------------------------------------

describe('§5.6.2 — Blackwall Tower reduces gateway HP per tick', () => {
  it('gateway HP decreases each tick when Blackwall Tower is assigned', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    makeBlackwallTower(world, 10, 11, gwEid)
    world.components = 0  // prevent auto-repair confounding results

    resourceSystem(world)

    expect(world.gatewayHp[gwEid]).toBeLessThan(GATEWAY_HP)
    expect(world.gatewayHp[gwEid]).toBeCloseTo(
      GATEWAY_HP - BLACKWALL_TOWER_DPT[0],
      2,
    )
  })

  it('gatewayIsClosing = 1 while Blackwall Tower is working (§5.6.3)', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    makeBlackwallTower(world, 10, 11, gwEid)
    world.components = 0

    resourceSystem(world)

    const isClosingOrDead =
      world.gatewayIsClosing[gwEid] !== 0 ||
      (world.bitmask[gwEid] & C.PENDING_REMOVAL) !== 0
    expect(isClosingOrDead).toBe(true)
  })

  it('gateway is marked PENDING_REMOVAL when HP reaches 0 (§5.6.5)', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    world.gatewayHp[gwEid] = 0.0001  // near-zero
    makeBlackwallTower(world, 10, 11, gwEid)
    world.components = 0

    resourceSystem(world)

    expect(world.bitmask[gwEid] & C.PENDING_REMOVAL).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// §9.2.6 — Closing gateway suppresses spawning
// ---------------------------------------------------------------------------

describe('§9.2.6 — Closing gateway suppresses enemy spawning', () => {
  it('spawn system skips a closing gateway and creates no enemy', () => {
    const gwEid = makeOpenGateway(world, 25, 0)
    world.gatewayIsClosing[gwEid] = 1  // mark as closing

    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave  = 1
    world.waveEnemyList   = [0]  // DATA_LEECH
    world.waveSpawnIndex  = 0
    world.nextSpawnTick   = 0
    world.tickCount       = 0
    world.enemiesAlive    = 0

    spawnSystem(world)

    // No enemy spawned — gateway was suppressed (§9.2.6)
    expect(world.enemiesAlive).toBe(0)
  })

  it('open gateway spawns an enemy (control: not closing)', () => {
    computeFlowfields(world)

    makeOpenGateway(world, 25, 0)  // North edge, open gateway
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave  = 1
    world.waveEnemyList   = [0]  // DATA_LEECH
    world.waveSpawnIndex  = 0
    world.nextSpawnTick   = 0
    world.tickCount       = 0
    world.enemiesAlive    = 0

    spawnSystem(world)

    expect(world.enemiesAlive).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// §1.10.12 — cleanupSystem removes gateway from activeGateways registry
// ---------------------------------------------------------------------------

describe('§1.10.12 — Gateway removal updates activeGateways registry', () => {
  it('cleanupSystem removes closed gateway from activeGateways', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    const countBefore = world.activeGatewayCount

    // Mark for removal
    world.bitmask[gwEid] |= C.PENDING_REMOVAL
    world.removalQueue[world.removalQueueLen++] = gwEid

    cleanupSystem(world)

    expect(world.activeGatewayCount).toBe(countBefore - 1)
    let found = false
    for (let i = 0; i < world.activeGatewayCount; i++) {
      if (world.activeGateways[i] === gwEid) { found = true; break }
    }
    expect(found).toBe(false)
  })
})


