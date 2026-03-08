/**
 * Command System tests — Pre-§1.10
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  GamePhase,
  CommandType,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { commandSystem } from '../command.system'
import {
  TICK_RATE,
  ICE_WALL_COST,
  ICE_WALL_HP,
  SKIP_BONUS_TICKS,
} from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// PLACE_TOWER
// ---------------------------------------------------------------------------

describe('PLACE_TOWER', () => {
  it('creates tower entity at correct position (§5.1)', () => {
    world.eddies = 1000
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    let towerEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.TOWER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerEid = eid
        break
      }
    }
    expect(towerEid).toBeGreaterThan(0)
    expect(world.posX[towerEid]).toBe(10)
    expect(world.posY[towerEid]).toBe(10)
    expect(world.towerType[towerEid]).toBe(C.TowerType.ICE_WALL)
    expect(world.towerLevel[towerEid]).toBe(1)
    expect(world.healthCurrent[towerEid]).toBe(ICE_WALL_HP[0])
    expect(world.healthMax[towerEid]).toBe(ICE_WALL_HP[0])
  })

  it('deducts resources when placing a tower (§4.1, §4.2)', () => {
    world.eddies = 1000
    world.components = 10
    const [eddyCost, compCost] = ICE_WALL_COST[0]

    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    expect(world.eddies).toBe(1000 - eddyCost)
    expect(world.components).toBe(10 - compCost)
  })

  it('does nothing when player has insufficient eddies (§4.3)', () => {
    world.eddies = 0 // ICE_WALL costs 50 eddies at L1
    world.components = 0

    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    expect(world.eddies).toBe(0)
    // No tower entity should exist beyond core
    let towerFound = false
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.TOWER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerFound = true
        break
      }
    }
    expect(towerFound).toBe(false)
  })

  it('blocks the grid tile (§2.6.1)', () => {
    world.eddies = 1000
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    const tileIdx = 10 + 10 * 51
    expect(world.gridBlocked[tileIdx]).toBeGreaterThan(0)
    expect(world.gridTowerType[tileIdx]).toBe(C.TowerType.ICE_WALL)
  })

  it('rejects placement on edge tile (§2.6.3)', () => {
    world.eddies = 1000
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 0,
      y: 5,
    })
    commandSystem(world)

    const tileIdx = 0 + 5 * 51
    expect(world.gridBlocked[tileIdx]).toBe(0)
  })

  it('sets TARGETING flag and cooldown for DATA_SPIKE (§5.3)', () => {
    world.eddies = 1000
    world.components = 100
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.DATA_SPIKE,
      x: 10,
      y: 10,
      facing: 2,
    })
    commandSystem(world)

    let towerEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.TOWER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerEid = eid
        break
      }
    }
    expect(towerEid).toBeGreaterThan(0)
    expect(world.bitmask[towerEid] & C.TARGETING).toBeTruthy()
    expect(world.towerFacing[towerEid]).toBe(2)
  })

  it('sets PING_RANGE flag and range for PING tower (§5.7)', () => {
    world.eddies = 100
    world.components = 10
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.PING,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    let towerEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.PING_RANGE) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerEid = eid
        break
      }
    }
    expect(towerEid).toBeGreaterThan(0)
    expect(world.pingRange[towerEid]).toBe(3)
  })

  it('sets HARVESTER flag and eddies/tick for HARVESTER tower (§5.8)', () => {
    world.eddies = 100
    world.components = 10
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.HARVESTER,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    let towerEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.HARVESTER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerEid = eid
        break
      }
    }
    expect(towerEid).toBeGreaterThan(0)
    expect(world.harvesterEddiesPerTick[towerEid]).toBeCloseTo(1 / TICK_RATE, 6)
  })
})

// ---------------------------------------------------------------------------
// UPGRADE_TOWER
// ---------------------------------------------------------------------------

describe('UPGRADE_TOWER', () => {
  it('increments tower level and updates HP (§5.0.5)', () => {
    world.eddies = 1000
    world.components = 100
    // Place an ICE_WALL
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    let towerEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.TOWER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerEid = eid
        break
      }
    }
    expect(towerEid).toBeGreaterThan(0)

    const hpBefore = world.healthMax[towerEid]
    world.commandQueue.push({
      type: CommandType.UPGRADE_TOWER,
      eid: towerEid,
    })
    commandSystem(world)

    expect(world.towerLevel[towerEid]).toBe(2)
    expect(world.healthMax[towerEid]).toBeGreaterThan(hpBefore)
  })

  it('does not upgrade beyond MAX_TOWER_LEVEL', () => {
    world.eddies = 1000
    world.components = 100
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    let towerEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.TOWER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerEid = eid
        break
      }
    }

    // Forcibly set to max level
    world.towerLevel[towerEid] = 10
    world.commandQueue.push({
      type: CommandType.UPGRADE_TOWER,
      eid: towerEid,
    })
    commandSystem(world)

    expect(world.towerLevel[towerEid]).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// DISMANTLE_TOWER
// ---------------------------------------------------------------------------

describe('DISMANTLE_TOWER', () => {
  it('frees grid tile and marks tower for removal (§2.6, §4.2.7)', () => {
    world.eddies = 1000
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.ICE_WALL,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    let towerEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.TOWER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        towerEid = eid
        break
      }
    }
    expect(towerEid).toBeGreaterThan(0)

    world.commandQueue.push({
      type: CommandType.DISMANTLE_TOWER,
      eid: towerEid,
    })
    commandSystem(world)

    const tileIdx = 10 + 10 * 51
    expect(world.gridBlocked[tileIdx]).toBe(0)
    expect(world.gridTowerType[tileIdx]).toBe(0)
    expect(world.bitmask[towerEid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('creates component pickup when tower dismantled within Ping range (§4.2.6)', () => {
    world.eddies = 1000
    world.components = 100

    // Place a Ping Tower near (10,10)
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.PING,
      x: 8,
      y: 10,
    })
    commandSystem(world)

    // Place a Harvester near the Ping Tower
    world.commandQueue.push({
      type: CommandType.PLACE_TOWER,
      towerType: C.TowerType.HARVESTER,
      x: 10,
      y: 10,
    })
    commandSystem(world)

    let harvEid = -1
    for (let eid = 1; eid < world.bitmask.length; eid++) {
      if (
        (world.bitmask[eid] & C.HARVESTER) !== 0 &&
        (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
      ) {
        harvEid = eid
        break
      }
    }
    expect(harvEid).toBeGreaterThan(0)

    const pickupsBefore = countPickups(world)
    world.commandQueue.push({
      type: CommandType.DISMANTLE_TOWER,
      eid: harvEid,
    })
    commandSystem(world)

    expect(countPickups(world)).toBeGreaterThan(pickupsBefore)
  })
})

// ---------------------------------------------------------------------------
// SKIP_BREAK
// ---------------------------------------------------------------------------

describe('SKIP_BREAK', () => {
  it('sets breakTicksRemaining to 0 in WAVE_BREAK phase (§8.3)', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.breakTicksRemaining = 1200

    world.commandQueue.push({ type: CommandType.SKIP_BREAK })
    commandSystem(world)

    expect(world.breakTicksRemaining).toBe(0)
  })

  it('adds SKIP_BONUS_TICKS to skipBonusTicks (§8.3.1)', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.breakTicksRemaining = 1200
    world.skipBonusTicks = 0

    world.commandQueue.push({ type: CommandType.SKIP_BREAK })
    commandSystem(world)

    expect(world.skipBonusTicks).toBe(SKIP_BONUS_TICKS)
  })

  it('does nothing in PRE_GAME phase', () => {
    world.currentPhase = GamePhase.PRE_GAME
    world.breakTicksRemaining = 0
    world.skipBonusTicks = 0

    world.commandQueue.push({ type: CommandType.SKIP_BREAK })
    commandSystem(world)

    expect(world.skipBonusTicks).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// START_WAVE
// ---------------------------------------------------------------------------

describe('START_WAVE', () => {
  it('transitions from PRE_GAME to WAVE_BREAK (§8.2.1)', () => {
    world.currentPhase = GamePhase.PRE_GAME

    world.commandQueue.push({ type: CommandType.START_WAVE })
    commandSystem(world)

    expect(world.currentPhase).toBe(GamePhase.WAVE_BREAK)
    expect(world.breakTicksRemaining).toBeGreaterThan(0)
  })

  it('does nothing outside PRE_GAME phase', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE

    world.commandQueue.push({ type: CommandType.START_WAVE })
    commandSystem(world)

    expect(world.currentPhase).toBe(GamePhase.WAVE_ACTIVE)
  })
})

// ---------------------------------------------------------------------------
// CONVERT_EDDIES
// ---------------------------------------------------------------------------

describe('CONVERT_EDDIES (§4.2.9)', () => {
  it('converts 100 eddies into 1 component', () => {
    world.eddies = 200
    world.components = 0

    world.commandQueue.push({ type: CommandType.CONVERT_EDDIES })
    commandSystem(world)

    expect(world.eddies).toBe(100)
    expect(world.components).toBe(1)
  })

  it('does nothing when player has fewer than 100 eddies', () => {
    world.eddies = 99
    world.components = 5

    world.commandQueue.push({ type: CommandType.CONVERT_EDDIES })
    commandSystem(world)

    expect(world.eddies).toBe(99)
    expect(world.components).toBe(5)
  })

  it('converts exactly 100 eddies when available', () => {
    world.eddies = 100
    world.components = 3

    world.commandQueue.push({ type: CommandType.CONVERT_EDDIES })
    commandSystem(world)

    expect(world.eddies).toBe(0)
    expect(world.components).toBe(4)
  })

  it('converts multiple times in sequence (3 conversions)', () => {
    world.eddies = 300
    world.components = 0

    world.commandQueue.push({ type: CommandType.CONVERT_EDDIES })
    world.commandQueue.push({ type: CommandType.CONVERT_EDDIES })
    world.commandQueue.push({ type: CommandType.CONVERT_EDDIES })
    commandSystem(world)

    expect(world.eddies).toBe(0)
    expect(world.components).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function countPickups(world: World): number {
  let count = 0
  for (let eid = 1; eid < world.bitmask.length; eid++) {
    if (
      (world.bitmask[eid] & C.PICKUP) !== 0 &&
      (world.bitmask[eid] & C.PENDING_REMOVAL) === 0
    ) {
      count++
    }
  }
  return count
}
