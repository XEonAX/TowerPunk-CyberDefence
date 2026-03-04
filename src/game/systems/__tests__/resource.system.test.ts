/**
 * Resource System tests — §1.10.14
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createTower,
  createGateway,
  markForRemoval,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { resourceSystem } from '../resource.system'
import {
  HARVESTER_EDDIES_PER_TICK,
  HARVESTER_COMPONENTS_PER_TICK,
  BLACKWALL_PASSIVE_DPT,
  BLACKWALL_TOWER_DPT,
  BLACKWALL_TOWER_HP,
  BLACKWALL_REPAIR_COMPONENTS,
} from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

function makePingTower(
  world: World,
  x: number,
  y: number,
  range: number,
): number {
  const eid = createTower(world, C.PING_RANGE)
  world.posX[eid] = x
  world.posY[eid] = y
  world.pingRange[eid] = range
  return eid
}

function makeHarvester(world: World, x: number, y: number): number {
  const eid = createTower(world, C.HARVESTER)
  world.posX[eid] = x
  world.posY[eid] = y
  world.harvesterEddiesPerTick[eid] = HARVESTER_EDDIES_PER_TICK[0]
  world.harvesterComponentsPerTick[eid] = HARVESTER_COMPONENTS_PER_TICK[0]
  return eid
}

function makeOpenGateway(world: World, x: number, y: number): number {
  const gwEid = createGateway(world)
  world.gatewayX[gwEid] = x
  world.gatewayY[gwEid] = y
  world.gatewayIsClosing[gwEid] = 0
  world.gatewayHp[gwEid] = 10000
  world.gatewayMaxHp[gwEid] = 10000
  world.activeGateways[world.activeGatewayCount++] = gwEid
  return gwEid
}

function makeBlackwallTower(
  world: World,
  x: number,
  y: number,
  hp: number,
  assignedGateway: number,
): number {
  const eid = createTower(world, C.BLACKWALL_TOWER)
  world.posX[eid] = x
  world.posY[eid] = y
  world.healthMax[eid] = hp
  world.healthCurrent[eid] = hp
  world.towerLevel[eid] = 1
  world.blackwallAssignedGateway[eid] = assignedGateway
  world.blackwallDamagePerTick[eid] = BLACKWALL_TOWER_DPT[0]
  return eid
}

// ---------------------------------------------------------------------------
// Harvester Generation (§5.8.1)
// ---------------------------------------------------------------------------

describe('Harvester generation (§5.8.1)', () => {
  it('generates eddies per tick when connected to Ping Tower', () => {
    makePingTower(world, 5, 5, 3)
    makeHarvester(world, 6, 5)
    world.eddies = 0

    resourceSystem(world)

    expect(world.eddies).toBeCloseTo(HARVESTER_EDDIES_PER_TICK[0], 6)
  })

  it('does NOT generate eddies without Ping Tower connection (§5.7.2)', () => {
    makeHarvester(world, 6, 5)
    world.eddies = 0

    resourceSystem(world)

    expect(world.eddies).toBe(0)
  })

  it('does not generate when Ping Tower is out of range', () => {
    makePingTower(world, 5, 5, 1) // range 1 tile
    makeHarvester(world, 20, 5) // far away
    world.eddies = 0

    resourceSystem(world)

    expect(world.eddies).toBe(0)
  })

  it('does not generate when harvester is disabled (§7.7)', () => {
    makePingTower(world, 5, 5, 3)
    const harvEid = makeHarvester(world, 6, 5)
    world.bitmask[harvEid] |= C.TOWER_DISABLED
    world.eddies = 0

    resourceSystem(world)

    expect(world.eddies).toBe(0)
  })

  it('generates components when set on harvester (§5.8.2)', () => {
    makePingTower(world, 5, 5, 3)
    const harvEid = makeHarvester(world, 6, 5)
    world.harvesterComponentsPerTick[harvEid] = HARVESTER_COMPONENTS_PER_TICK[2] // L3
    world.components = 0

    resourceSystem(world)

    expect(world.components).toBeCloseTo(HARVESTER_COMPONENTS_PER_TICK[2], 6)
  })

  it('accumulates eddies from multiple harvesters', () => {
    makePingTower(world, 5, 5, 5)
    makeHarvester(world, 6, 5)
    makeHarvester(world, 7, 5)
    world.eddies = 0

    resourceSystem(world)

    expect(world.eddies).toBeCloseTo(2 * HARVESTER_EDDIES_PER_TICK[0], 6)
  })
})

// ---------------------------------------------------------------------------
// Blackwall Tower (§5.6)
// ---------------------------------------------------------------------------

describe('Blackwall Tower — passive damage (§5.6.6)', () => {
  it('takes damage each tick from adjacent open gateway', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    const bwEid = makeBlackwallTower(world, 10, 11, BLACKWALL_TOWER_HP[0], gwEid)
    world.components = 0  // prevent auto-repair affecting the expectation

    resourceSystem(world)

    expect(world.healthCurrent[bwEid]).toBeCloseTo(
      BLACKWALL_TOWER_HP[0] - BLACKWALL_PASSIVE_DPT,
      2, // Float32 precision at ~1000 ≈ ±0.005
    )
  })

  it('is marked for removal when HP reaches 0', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    const bwEid = makeBlackwallTower(world, 10, 11, 0.0001, gwEid)

    resourceSystem(world)

    expect(world.bitmask[bwEid] & C.PENDING_REMOVAL).toBeTruthy()
  })
})

describe('Blackwall Tower — damages gateway (§5.6.2)', () => {
  it('damages assigned gateway per tick', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    makeBlackwallTower(world, 10, 11, BLACKWALL_TOWER_HP[0], gwEid)

    const hpBefore = world.gatewayHp[gwEid]
    resourceSystem(world)

    expect(world.gatewayHp[gwEid]).toBeLessThan(hpBefore)
    expect(world.gatewayHp[gwEid]).toBeCloseTo(
      hpBefore - BLACKWALL_TOWER_DPT[0],
      2, // Float32 precision at ~10000 ≈ ±0.005
    )
  })

  it('marks gateway PENDING_REMOVAL when HP reaches 0 (§5.6.5)', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    world.gatewayHp[gwEid] = 0.0001
    makeBlackwallTower(world, 10, 11, BLACKWALL_TOWER_HP[0], gwEid)

    resourceSystem(world)

    expect(world.bitmask[gwEid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('sets gatewayIsClosing flag (§5.6.3)', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    makeBlackwallTower(world, 10, 11, BLACKWALL_TOWER_HP[0], gwEid)

    resourceSystem(world)

    // Either the gateway is marked closing OR fully destroyed
    const isClosing = world.gatewayIsClosing[gwEid] !== 0
    const isDestroyed = (world.bitmask[gwEid] & C.PENDING_REMOVAL) !== 0
    expect(isClosing || isDestroyed).toBe(true)
  })

  it('does not damage gateway with no assigned gateway (eid = 0)', () => {
    // Blackwall tower with no gateway assigned
    const bwEid = createTower(world, C.BLACKWALL_TOWER)
    world.posX[bwEid] = 10
    world.posY[bwEid] = 10
    world.healthMax[bwEid] = BLACKWALL_TOWER_HP[0]
    world.healthCurrent[bwEid] = BLACKWALL_TOWER_HP[0]
    world.towerLevel[bwEid] = 1
    world.blackwallAssignedGateway[bwEid] = 0 // no assignment
    world.blackwallDamagePerTick[bwEid] = BLACKWALL_TOWER_DPT[0]

    const hpBefore = world.healthCurrent[bwEid]
    resourceSystem(world)

    // Without an assigned gateway, no damage should be taken either
    expect(world.healthCurrent[bwEid]).toBe(hpBefore)
  })
})

describe('Blackwall Tower — auto-repair (§5.6.7)', () => {
  it('repairs tower if player has enough components', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    const bwEid = makeBlackwallTower(world, 10, 11, BLACKWALL_TOWER_HP[0], gwEid)
    world.healthCurrent[bwEid] = 500 // damaged
    world.components = BLACKWALL_REPAIR_COMPONENTS + 1 // enough to repair

    resourceSystem(world)

    expect(world.healthCurrent[bwEid]).toBeCloseTo(BLACKWALL_TOWER_HP[0], 0)
    expect(world.components).toBeCloseTo(1, 0)
  })

  it('partial repair when components are insufficient', () => {
    const gwEid = makeOpenGateway(world, 10, 10)
    const bwEid = makeBlackwallTower(world, 10, 11, BLACKWALL_TOWER_HP[0], gwEid)

    // Force some damage so it's below max
    // Set HP after passive damage would have hit (we run resourceSystem once so just pre-damage it)
    // The passive damage will also happen, but let's set enough damage first
    world.healthCurrent[bwEid] = 200
    world.components = 5 // only 5, need 10 for full restore

    resourceSystem(world)

    // Should be > 200 (partial repair applied with 5 / 10 = 50% of missing HP)
    expect(world.healthCurrent[bwEid]).toBeGreaterThan(200)
    expect(world.components).toBeCloseTo(0, 1)
  })
})
