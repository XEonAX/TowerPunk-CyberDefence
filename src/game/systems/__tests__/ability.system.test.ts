/**
 * Ability System tests — §6.1–6.5
 *
 * Covers ACTIVATE_ABILITY and related effects:
 *   §6.1  — EMP Blast: stun enemies in range, Data Leech immunity
 *   §6.2  — Overclock: activate flag, tick countdown, fire-rate boost
 *   §6.3  — Tuned: target type switch, cooldown
 *   §6.4  — Boosted: passive Eddie generation multiplier
 *   §6.5  — Oracle: passive range increase
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createTower, createEnemy, CommandType, type World } from '../../ecs/world'
import * as C from '../../ecs/component'
import { commandSystem } from '../command.system'
import { statusExpireSystem } from '../statusExpire.system'
import { resourceSystem } from '../resource.system'
import {
  EMP_BLAST_STUN_TICKS_BASE,
  EMP_BLAST_COOLDOWN_BASE,
  OVERCLOCK_DURATION_TICKS,
  OVERCLOCK_COOLDOWN_TICKS,
  OVERCLOCK_MULTIPLIER_BASE,
  OVERCLOCK_MULTIPLIER_PER_LEVEL,
  BOOSTED_MULTIPLIER,
  HARVESTER_EDDIES_PER_TICK,
  PING_TOWER_RANGE,
  ORACLE_MULTIPLIER,
} from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an ICE Wall entity at the given level with EMP_BLAST ability unlocked. */
function makeIceWallWithAbility(w: World, tx: number, ty: number, abilityLvl: number): number {
  const eid = createTower(w, 0)
  w.towerType[eid]      = C.TowerType.ICE_WALL
  w.towerLevel[eid]     = 5
  w.posX[eid]           = tx
  w.posY[eid]           = ty
  w.bitmask[eid]       |= C.ABILITY
  w.abilityType[eid]    = C.AbilityType.EMP_BLAST
  w.abilityLevel[eid]   = abilityLvl
  w.abilityCooldown[eid] = 0
  return eid
}

/** Build an enemy not adjacent to spawn point (no immunity). */
function makeEnemy(w: World, ex: number, ey: number, immunityFlags: number = 0): number {
  const eid = createEnemy(w)
  w.tilePosX[eid]        = ex
  w.tilePosY[eid]        = ey
  w.healthCurrent[eid]   = 10
  w.healthMax[eid]       = 10
  w.immunityFlags[eid]   = immunityFlags
  w.enemyType[eid]       = C.EnemyType.CODE_RUNNER
  // Clear spawn immunity so targeting applies
  w.bitmask[eid] &= ~C.SPAWN_IMMUNITY
  w.spawnImmunityTicks[eid] = 0
  return eid
}

/** Build a Data Leech (immune to stun). */
function makeDataLeech(w: World, ex: number, ey: number): number {
  const eid = makeEnemy(w, ex, ey, C.IMMUNE_STUN)
  w.enemyType[eid] = C.EnemyType.DATA_LEECH
  return eid
}

/** Build a Daemon Turret with Overclock ability. */
function makeTurretWithOverclock(w: World, abilityLvl: number): number {
  const eid = createTower(w, C.TARGETING | C.ROTATION)
  w.towerType[eid]       = C.TowerType.DAEMON_TURRET
  w.towerLevel[eid]      = 5
  w.posX[eid]            = 10
  w.posY[eid]            = 10
  w.bitmask[eid]        |= C.ABILITY
  w.abilityType[eid]     = C.AbilityType.OVERCLOCK
  w.abilityLevel[eid]    = abilityLvl
  w.abilityCooldown[eid] = 0
  w.overclockActive[eid] = 0
  w.overclockTicks[eid]  = 0
  w.overclockMultiplier[eid] = 1.0
  return eid
}

// ---------------------------------------------------------------------------
// §6.1 EMP Blast
// ---------------------------------------------------------------------------

describe('EMP Blast (§6.1)', () => {
  it('stuns all enemies within Chebyshev 1 of ICE Wall', () => {
    const towerEid = makeIceWallWithAbility(world, 10, 10, 1)

    // Adjacent enemies (Chebyshev 1)
    const e1 = makeEnemy(world, 10, 9)   // N
    const e2 = makeEnemy(world, 11, 10)  // E
    const e3 = makeEnemy(world, 10, 11)  // S

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid: towerEid })
    commandSystem(world)

    // Stuns are queued — apply them via statusApplySystem would normally consume them,
    // but we can verify the stun queue was populated
    expect(world.statusStunQueueLen).toBeGreaterThanOrEqual(3)

    // Check that stun was queued for correct enemies
    const queuedEids: number[] = []
    for (let i = 0; i < world.statusStunQueueLen; i++) {
      queuedEids.push(world.statusStunQueue[i * 2])
    }
    expect(queuedEids).toContain(e1)
    expect(queuedEids).toContain(e2)
    expect(queuedEids).toContain(e3)
  })

  it('does NOT stun enemy outside range (Chebyshev 2)', () => {
    const towerEid = makeIceWallWithAbility(world, 10, 10, 1)
    const farEnemy = makeEnemy(world, 12, 10)  // Chebyshev 2

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid: towerEid })
    commandSystem(world)

    const queuedEids: number[] = []
    for (let i = 0; i < world.statusStunQueueLen; i++) {
      queuedEids.push(world.statusStunQueue[i * 2])
    }
    expect(queuedEids).not.toContain(farEnemy)
  })

  it('does NOT stun Data Leech (§6.1.3, §7.1.3 — IMMUNE_STUN)', () => {
    const towerEid = makeIceWallWithAbility(world, 10, 10, 1)
    const leech    = makeDataLeech(world, 10, 9)   // adjacent

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid: towerEid })
    commandSystem(world)

    const queuedEids: number[] = []
    for (let i = 0; i < world.statusStunQueueLen; i++) {
      queuedEids.push(world.statusStunQueue[i * 2])
    }
    expect(queuedEids).not.toContain(leech)
  })

  it('queues stun duration of EMP_BLAST_STUN_TICKS_BASE at level 1', () => {
    const towerEid = makeIceWallWithAbility(world, 10, 10, 1)
    makeEnemy(world, 10, 9)  // adjacent

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid: towerEid })
    commandSystem(world)

    expect(world.statusStunQueueLen).toBeGreaterThan(0)
    const queuedTicks = world.statusStunQueue[1]  // second entry = ticks value
    expect(queuedTicks).toBe(EMP_BLAST_STUN_TICKS_BASE)
  })

  it('sets abilityCooldown = EMP_BLAST_COOLDOWN_BASE at level 1 (§6.1.5)', () => {
    const towerEid = makeIceWallWithAbility(world, 10, 10, 1)
    makeEnemy(world, 10, 9)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid: towerEid })
    commandSystem(world)

    expect(world.abilityCooldown[towerEid]).toBe(EMP_BLAST_COOLDOWN_BASE)
  })

  it('rejects activation when abilityLevel === 0 (not yet upgraded)', () => {
    const towerEid = makeIceWallWithAbility(world, 10, 10, 0)  // level 0
    makeEnemy(world, 10, 9)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid: towerEid })
    commandSystem(world)

    // No stun queued, no cooldown set
    expect(world.statusStunQueueLen).toBe(0)
    expect(world.abilityCooldown[towerEid]).toBe(0)
  })

  it('rejects activation when abilityCooldown > 0', () => {
    const towerEid = makeIceWallWithAbility(world, 10, 10, 1)
    world.abilityCooldown[towerEid] = 100  // on cooldown
    makeEnemy(world, 10, 9)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid: towerEid })
    commandSystem(world)

    expect(world.statusStunQueueLen).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// §6.2 Overclock
// ---------------------------------------------------------------------------

describe('Overclock (§6.2)', () => {
  it('sets overclockActive flag on activation', () => {
    const eid = makeTurretWithOverclock(world, 1)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid })
    commandSystem(world)

    expect(world.overclockActive[eid]).toBe(1)
  })

  it('sets overclockTicks = OVERCLOCK_DURATION_TICKS on activation', () => {
    const eid = makeTurretWithOverclock(world, 1)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid })
    commandSystem(world)

    expect(world.overclockTicks[eid]).toBe(OVERCLOCK_DURATION_TICKS)
  })

  it('sets overclockMultiplier = 1.5 at ability level 1 (§6.2 +50%)', () => {
    const eid = makeTurretWithOverclock(world, 1)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid })
    commandSystem(world)

    expect(world.overclockMultiplier[eid]).toBeCloseTo(OVERCLOCK_MULTIPLIER_BASE, 5)
  })

  it('sets overclockMultiplier = 1.75 at ability level 2 (+25% per level)', () => {
    const eid = makeTurretWithOverclock(world, 2)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid })
    commandSystem(world)

    const expected = OVERCLOCK_MULTIPLIER_BASE + OVERCLOCK_MULTIPLIER_PER_LEVEL
    expect(world.overclockMultiplier[eid]).toBeCloseTo(expected, 5)
  })

  it('sets abilityCooldown = OVERCLOCK_COOLDOWN_TICKS on activation', () => {
    const eid = makeTurretWithOverclock(world, 1)

    world.commandQueue.push({ type: CommandType.ACTIVATE_ABILITY, eid })
    commandSystem(world)

    expect(world.abilityCooldown[eid]).toBe(OVERCLOCK_COOLDOWN_TICKS)
  })

  it('overclockTicks decrements via statusExpireSystem (§1.10.4)', () => {
    const eid = makeTurretWithOverclock(world, 1)
    world.overclockActive[eid]     = 1
    world.overclockTicks[eid]      = 3
    world.overclockMultiplier[eid] = 1.5

    statusExpireSystem(world)

    expect(world.overclockTicks[eid]).toBe(2)
    expect(world.overclockActive[eid]).toBe(1)
  })

  it('deactivates overclock when overclockTicks reaches 0 (§6.2)', () => {
    const eid = makeTurretWithOverclock(world, 1)
    world.overclockActive[eid]     = 1
    world.overclockTicks[eid]      = 1
    world.overclockMultiplier[eid] = 1.5

    statusExpireSystem(world)

    expect(world.overclockTicks[eid]).toBe(0)
    expect(world.overclockActive[eid]).toBe(0)
    expect(world.overclockMultiplier[eid]).toBeCloseTo(1.0, 5)
  })

  it('ability cooldown decrements in statusExpireSystem (§6.0.3)', () => {
    const eid = makeTurretWithOverclock(world, 1)
    world.abilityCooldown[eid] = 10

    statusExpireSystem(world)

    expect(world.abilityCooldown[eid]).toBe(9)
  })
})

// ---------------------------------------------------------------------------
// §6.4 Boosted (passive multiplier via resourceSystem)
// ---------------------------------------------------------------------------

describe('Boosted (§6.4)', () => {
  it('applies Boosted multiplier to Harvester Eddie generation', () => {
    // Ping Tower with Boosted L1 at same location as Harvester
    const pingEid = createTower(world, C.PING_RANGE)
    world.towerType[pingEid]     = C.TowerType.PING
    world.posX[pingEid]          = 5
    world.posY[pingEid]          = 5
    world.pingRange[pingEid]     = 3
    world.bitmask[pingEid]      |= C.ABILITY
    world.abilityType[pingEid]   = C.AbilityType.BOOSTED
    world.abilityLevel[pingEid]  = 1  // L1 = +50%

    const harvEid = createTower(world, C.HARVESTER)
    world.towerType[harvEid]                  = C.TowerType.HARVESTER
    world.posX[harvEid]                       = 5
    world.posY[harvEid]                       = 5
    world.harvesterEddiesPerTick[harvEid]     = HARVESTER_EDDIES_PER_TICK[0]
    world.harvesterComponentsPerTick[harvEid] = 0

    const ediesBefore = world.eddies

    resourceSystem(world)

    const expected = HARVESTER_EDDIES_PER_TICK[0] * BOOSTED_MULTIPLIER[0]
    expect(world.eddies - ediesBefore).toBeCloseTo(expected, 5)
  })

  it('without Boosted ability the base Eddie rate applies', () => {
    const pingEid = createTower(world, C.PING_RANGE)
    world.towerType[pingEid]  = C.TowerType.PING
    world.posX[pingEid]       = 5
    world.posY[pingEid]       = 5
    world.pingRange[pingEid]  = 3
    // No ABILITY flag — plain Ping Tower

    const harvEid = createTower(world, C.HARVESTER)
    world.towerType[harvEid]                  = C.TowerType.HARVESTER
    world.posX[harvEid]                       = 5
    world.posY[harvEid]                       = 5
    world.harvesterEddiesPerTick[harvEid]     = HARVESTER_EDDIES_PER_TICK[0]
    world.harvesterComponentsPerTick[harvEid] = 0

    const ediesBefore = world.eddies

    resourceSystem(world)

    expect(world.eddies - ediesBefore).toBeCloseTo(HARVESTER_EDDIES_PER_TICK[0], 5)
  })
})

// ---------------------------------------------------------------------------
// §6.5 Oracle (passive range via UPGRADE_ABILITY)
// ---------------------------------------------------------------------------

describe('Oracle (§6.5)', () => {
  it('UPGRADE_ABILITY increases Ping Tower range by 50% at L1 (§6.5)', () => {
    const eid = createTower(world, C.PING_RANGE)
    world.towerType[eid]     = C.TowerType.PING
    world.towerLevel[eid]    = 5
    world.posX[eid]          = 10
    world.posY[eid]          = 10
    world.pingRange[eid]     = PING_TOWER_RANGE[4]
    world.bitmask[eid]      |= C.ABILITY
    world.abilityType[eid]   = C.AbilityType.ORACLE
    world.abilityLevel[eid]  = 0
    world.components = 999

    world.commandQueue.push({ type: CommandType.UPGRADE_ABILITY, eid })
    commandSystem(world)

    const expectedRange = PING_TOWER_RANGE[4] * ORACLE_MULTIPLIER[0]
    expect(world.pingRange[eid]).toBeCloseTo(expectedRange, 5)
  })

  it('Oracle range updates when tower level is upgraded while ability is active', () => {
    const eid = createTower(world, C.PING_RANGE)
    world.towerType[eid]     = C.TowerType.PING
    world.towerLevel[eid]    = 5
    world.posX[eid]          = 10
    world.posY[eid]          = 10
    world.pingRange[eid]     = PING_TOWER_RANGE[4] * ORACLE_MULTIPLIER[0]
    world.healthCurrent[eid] = 500
    world.healthMax[eid]     = 500
    world.bitmask[eid]      |= C.ABILITY
    world.abilityType[eid]   = C.AbilityType.ORACLE
    world.abilityLevel[eid]  = 1  // already L1
    world.components = 9999

    world.commandQueue.push({ type: CommandType.UPGRADE_TOWER, eid })
    commandSystem(world)

    // After tower level 6, base range = PING_TOWER_RANGE[5]; Oracle L1 = ×1.5
    const expectedRange = PING_TOWER_RANGE[5] * ORACLE_MULTIPLIER[0]
    expect(world.pingRange[eid]).toBeCloseTo(expectedRange, 5)
  })
})

// ---------------------------------------------------------------------------
// §6.3 Tuned — target switch via ACTIVATE_ABILITY
// ---------------------------------------------------------------------------

describe('Tuned (§6.3)', () => {
  it('ACTIVATE_ABILITY with targetType updates tunedTargetType', () => {
    const eid = createTower(world, C.FIREWALL_LINK)
    world.towerType[eid]     = C.TowerType.FIREWALL
    world.towerLevel[eid]    = 5
    world.bitmask[eid]      |= C.ABILITY
    world.abilityType[eid]   = C.AbilityType.TUNED
    world.abilityLevel[eid]  = 1
    world.abilityCooldown[eid] = 0

    world.commandQueue.push({
      type: CommandType.ACTIVATE_ABILITY,
      eid,
      targetType: C.EnemyType.GLITCH,
    })
    commandSystem(world)

    expect(world.tunedTargetType[eid]).toBe(C.EnemyType.GLITCH)
  })

  it('sets abilityCooldown = 1200 at Tuned level 1 (§6.3.3)', () => {
    const eid = createTower(world, C.FIREWALL_LINK)
    world.towerType[eid]     = C.TowerType.FIREWALL
    world.towerLevel[eid]    = 5
    world.bitmask[eid]      |= C.ABILITY
    world.abilityType[eid]   = C.AbilityType.TUNED
    world.abilityLevel[eid]  = 1
    world.abilityCooldown[eid] = 0

    world.commandQueue.push({
      type: CommandType.ACTIVATE_ABILITY,
      eid,
      targetType: C.EnemyType.CODE_RUNNER,
    })
    commandSystem(world)

    expect(world.abilityCooldown[eid]).toBe(1200)
  })
})
