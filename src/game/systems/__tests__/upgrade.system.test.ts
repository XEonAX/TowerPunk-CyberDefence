/**
 * Tower Upgrade System tests — §5.0.5, §6.0.1
 *
 * Covers UPGRADE_TOWER command handling inside commandSystem:
 *   - Resource deduction (§5.x cost tables)
 *   - Rejection at MAX_TOWER_LEVEL
 *   - Rejection with insufficient resources
 *   - HP increase on upgrade
 *   - Ability unlock at level 5 (§6.0.1)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createTower, CommandType, type World } from '../../ecs/world'
import * as C from '../../ecs/component'
import { commandSystem } from '../command.system'
import {
  MAX_TOWER_LEVEL,
  MAX_ABILITY_LEVEL,
  ICE_WALL_HP,
  ICE_WALL_COST,
  FIREWALL_HP,
  FIREWALL_COST,
  PING_TOWER_HP,
  PING_TOWER_RANGE,
  ORACLE_MULTIPLIER,
  ABILITY_UPGRADE_COST,
} from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a bare tower entity (no grid interaction needed for upgrade tests). */
function makeIceWallAtLevel(w: World, level: number): number {
  const eid = createTower(w, 0)
  w.towerType[eid]          = C.TowerType.ICE_WALL
  w.towerLevel[eid]         = level
  w.posX[eid]               = 10
  w.posY[eid]               = 10
  w.healthCurrent[eid]      = ICE_WALL_HP[level - 1]
  w.healthMax[eid]          = ICE_WALL_HP[level - 1]
  return eid
}

function makePingAtLevel(w: World, level: number): number {
  const eid = createTower(w, C.PING_RANGE)
  w.towerType[eid]     = C.TowerType.PING
  w.towerLevel[eid]    = level
  w.posX[eid]          = 10
  w.posY[eid]          = 10
  w.healthCurrent[eid] = PING_TOWER_HP[level - 1]
  w.healthMax[eid]     = PING_TOWER_HP[level - 1]
  w.pingRange[eid]     = PING_TOWER_RANGE[level - 1]
  return eid
}

// ---------------------------------------------------------------------------
// Resource deduction
// ---------------------------------------------------------------------------

describe('UPGRADE_TOWER — resource deduction', () => {
  it('deducts 0 Eddies and 1 Component upgrading ICE Wall L1→L2 (§5.1 cost table)', () => {
    const eid = makeIceWallAtLevel(world, 1)
    world.eddies     = 1000
    world.components = 10

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    const [eddyCost, compCost] = ICE_WALL_COST[1]  // index 1 = L2 upgrade cost
    expect(world.eddies).toBe(1000 - eddyCost)
    expect(world.components).toBe(10 - compCost)
  })

  it('deducts 1 Component upgrading ICE Wall L1→L2', () => {
    const eid = makeIceWallAtLevel(world, 1)
    world.components = 5

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    // ICE_WALL L2 cost = 0 eddies, 1 component (index 1)
    expect(world.components).toBe(4)
    expect(world.towerLevel[eid]).toBe(2)
  })

  it('rejects upgrade with insufficient Components', () => {
    const eid = makeIceWallAtLevel(world, 1)
    world.components = 0  // L2 costs 1 component

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.towerLevel[eid]).toBe(1)  // unchanged
    expect(world.components).toBe(0)
  })

  it('rejects upgrade at MAX_TOWER_LEVEL (§5.0.5)', () => {
    const eid = makeIceWallAtLevel(world, MAX_TOWER_LEVEL)
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.towerLevel[eid]).toBe(MAX_TOWER_LEVEL)  // unchanged
    expect(world.components).toBe(9999)
  })
})

// ---------------------------------------------------------------------------
// HP increase
// ---------------------------------------------------------------------------

describe('UPGRADE_TOWER — HP increase', () => {
  it('increases healthMax and healthCurrent by the HP delta on upgrade (§5.1)', () => {
    const eid = makeIceWallAtLevel(world, 1)
    const oldHp = ICE_WALL_HP[0]
    world.components = 999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    const newHp = ICE_WALL_HP[1]
    const delta = newHp - oldHp
    expect(world.healthMax[eid]).toBe(newHp)
    expect(world.healthCurrent[eid]).toBe(Math.min(oldHp + delta, newHp))
  })

  it('caps healthCurrent at healthMax even if tower was at full HP', () => {
    const eid = makeIceWallAtLevel(world, 1)
    world.healthCurrent[eid] = ICE_WALL_HP[0]  // full HP
    world.components = 999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.healthCurrent[eid]).toBeLessThanOrEqual(world.healthMax[eid])
  })
})

// ---------------------------------------------------------------------------
// Ability unlock at level 5 (§6.0.1)
// ---------------------------------------------------------------------------

describe('UPGRADE_TOWER — ability unlock at level 5', () => {
  it('sets ABILITY bitmask flag when ICE Wall reaches level 5', () => {
    const eid = makeIceWallAtLevel(world, 4)
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.towerLevel[eid]).toBe(5)
    expect(world.bitmask[eid] & C.ABILITY).not.toBe(0)
  })

  it('sets abilityType to EMP_BLAST for ICE Wall (§6.1)', () => {
    const eid = makeIceWallAtLevel(world, 4)
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.abilityType[eid]).toBe(C.AbilityType.EMP_BLAST)
  })

  it('initialises abilityLevel to 0 (unlocked but not yet upgraded) on level 5', () => {
    const eid = makeIceWallAtLevel(world, 4)
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.abilityLevel[eid]).toBe(0)
  })

  it('does NOT set ABILITY flag when upgrading to level 4', () => {
    const eid = makeIceWallAtLevel(world, 3)
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.towerLevel[eid]).toBe(4)
    expect(world.bitmask[eid] & C.ABILITY).toBe(0)
  })

  it('sets OVERCLOCK as abilityType for Daemon Turret at level 5 (§6.2)', () => {
    const eid = createTower(world, C.TARGETING | C.ROTATION)
    world.towerType[eid]   = C.TowerType.DAEMON_TURRET
    world.towerLevel[eid]  = 4
    world.healthCurrent[eid] = 400
    world.healthMax[eid]     = 400
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.abilityType[eid]).toBe(C.AbilityType.OVERCLOCK)
  })

  it('sets ORACLE as default abilityType for Ping Tower at level 5 (§6.5)', () => {
    const eid = makePingAtLevel(world, 4)
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    expect(world.abilityType[eid]).toBe(C.AbilityType.ORACLE)
  })
})

// ---------------------------------------------------------------------------
// UPGRADE_ABILITY — §6.0.2
// ---------------------------------------------------------------------------

describe('UPGRADE_ABILITY', () => {
  it('deducts correct Component cost (level 0→1 costs 1 Component)', () => {
    const eid = makeIceWallAtLevel(world, 4)
    world.components = 9999
    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)  // unlock ability at L5

    const compBefore = world.components
    world.commandQueue.push({ type: CommandType.UPGRADE_ABILITY, eid })
    commandSystem(world)

    const cost = ABILITY_UPGRADE_COST[0]  // 1 component
    expect(world.components).toBe(compBefore - cost)
    expect(world.abilityLevel[eid]).toBe(1)
  })

  it('rejects upgrade when Components are insufficient', () => {
    const eid = makeIceWallAtLevel(world, 4)
    world.components = 9999
    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    world.components = 0  // can't afford even 1 component
    world.commandQueue.push({ type: CommandType.UPGRADE_ABILITY, eid })
    commandSystem(world)

    expect(world.abilityLevel[eid]).toBe(0)  // unchanged
  })

  it('rejects upgrade at MAX_ABILITY_LEVEL (§6.0.4)', () => {
    const eid = makeIceWallAtLevel(world, 4)
    world.components = 9999
    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    // Upgrade all 5 levels
    for (let i = 0; i < MAX_ABILITY_LEVEL; i++) {
      world.commandQueue.push({ type: CommandType.UPGRADE_ABILITY, eid })
    }
    commandSystem(world)

    expect(world.abilityLevel[eid]).toBe(MAX_ABILITY_LEVEL)

    // One more should be rejected
    const compBefore = world.components
    world.commandQueue.push({ type: CommandType.UPGRADE_ABILITY, eid })
    commandSystem(world)

    expect(world.abilityLevel[eid]).toBe(MAX_ABILITY_LEVEL)
    expect(world.components).toBe(compBefore)
  })

  it('increases Oracle Ping Tower range on upgrade (§6.5)', () => {
    const eid = makePingAtLevel(world, 5)
    // Manually set ABILITY flag since we bypassed commands
    world.bitmask[eid] |= C.ABILITY
    world.abilityType[eid]  = C.AbilityType.ORACLE
    world.abilityLevel[eid] = 0
    world.components = 999

    world.commandQueue.push({ type: CommandType.UPGRADE_ABILITY, eid })
    commandSystem(world)

    const expectedRange = PING_TOWER_RANGE[4] * ORACLE_MULTIPLIER[0]  // L5 base × 1.5
    expect(world.pingRange[eid]).toBeCloseTo(expectedRange, 5)
  })

  it('Tuned damage bonus updates on upgrade (§6.3)', () => {
    // Create a Firewall-style tower at level 5
    const eid = createTower(world, C.FIREWALL_LINK)
    world.towerType[eid]     = C.TowerType.FIREWALL
    world.towerLevel[eid]    = 5
    world.healthCurrent[eid] = FIREWALL_HP[4]
    world.healthMax[eid]     = FIREWALL_HP[4]
    world.bitmask[eid]      |= C.ABILITY
    world.abilityType[eid]   = C.AbilityType.TUNED
    world.abilityLevel[eid]  = 0
    world.components = 999

    world.commandQueue.push({ type: CommandType.UPGRADE_ABILITY, eid })
    commandSystem(world)

    // L1 bonus = base DPS (level5 FIREWALL_DPS = 50) × 1.0
    expect(world.tunedDamageBonus[eid]).toBeCloseTo(50, 5)
    expect(world.abilityLevel[eid]).toBe(1)
  })
})
