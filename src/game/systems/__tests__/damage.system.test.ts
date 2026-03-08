/**
 * Damage System tests — §1.10.8–9
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createTower,
  createEnemy,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { damageSystem } from '../damage.system'
import { DATA_SPIKE_FIRE_FLAG } from '../targeting.system'
import {
  ICE_WALL_DPS,
  FIREWALL_DPS,
  DATA_SPIKE_DAMAGE,
  DAEMON_TURRET_DAMAGE,
  ICE_SNIPER_DAMAGE,
  ICE_SNIPER_SLOW,
  ICE_SNIPER_SLOW_TICKS,
  TICK_RATE,
  FIREWALL_STUN_TICKS,
} from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enemy at (ex, ey) with given HP, no spawn immunity, configurable immunity flags. */
function makeEnemy(ex: number, ey: number, hp = 100, immunityFlags = 0): number {
  const eid = createEnemy(world)
  world.tilePosX[eid]      = ex
  world.tilePosY[eid]      = ey
  world.healthCurrent[eid] = hp
  world.healthMax[eid]     = hp
  world.immunityFlags[eid] = immunityFlags
  world.bitmask[eid]      &= ~C.SPAWN_IMMUNITY
  return eid
}

/** ICE_WALL tower at (tx, ty) with given level. */
function makeIceWall(tx: number, ty: number, level = 1): number {
  const eid = createTower(world)
  world.towerType[eid]     = C.TowerType.ICE_WALL
  world.towerLevel[eid]    = level
  world.posX[eid]          = tx
  world.posY[eid]          = ty
  world.healthCurrent[eid] = 200
  world.healthMax[eid]     = 200
  return eid
}

/** FIREWALL tower at (tx, ty) with gap at (gx, gy) and given level. */
function makeFirewall(tx: number, ty: number, gx: number, gy: number, level = 1): number {
  const eid = createTower(world, C.FIREWALL_LINK)
  world.towerType[eid]     = C.TowerType.FIREWALL
  world.towerLevel[eid]    = level
  world.posX[eid]          = tx
  world.posY[eid]          = ty
  world.firewallGapX[eid]  = gx
  world.firewallGapY[eid]  = gy
  world.healthCurrent[eid] = 500
  world.healthMax[eid]     = 500
  return eid
}

/** DATA_SPIKE tower at (tx, ty), optionally with fire flag set. */
function makeDataSpike(
  tx: number, ty: number,
  facing: number = C.Dir.N,
  level = 1,
  fired = true,
): number {
  const eid = createTower(world, C.TARGETING)
  world.towerType[eid]       = C.TowerType.DATA_SPIKE
  world.towerLevel[eid]      = level
  world.posX[eid]            = tx
  world.posY[eid]            = ty
  world.towerFacing[eid]     = facing
  world.targetingTarget[eid] = fired ? DATA_SPIKE_FIRE_FLAG : 0
  world.healthCurrent[eid]   = 500
  world.healthMax[eid]       = 500
  return eid
}

/** DAEMON_TURRET tower at (tx, ty) with optional pre-set target. */
function makeDaemonTurret(tx: number, ty: number, level = 1, targetEid = 0): number {
  const eid = createTower(world, C.TARGETING)
  world.towerType[eid]       = C.TowerType.DAEMON_TURRET
  world.towerLevel[eid]      = level
  world.posX[eid]            = tx
  world.posY[eid]            = ty
  world.targetingTarget[eid] = targetEid
  world.healthCurrent[eid]   = 100
  world.healthMax[eid]       = 100
  return eid
}

/** ICE_SNIPER tower at (tx, ty) with a specific target. */
function makeIceSniper(tx: number, ty: number, level = 1, targetEid = 0): number {
  const eid = createTower(world, C.TARGETING)
  world.towerType[eid]       = C.TowerType.ICE_SNIPER
  world.towerLevel[eid]      = level
  world.posX[eid]            = tx
  world.posY[eid]            = ty
  world.targetingTarget[eid] = targetEid
  world.healthCurrent[eid]   = 100
  world.healthMax[eid]       = 100
  return eid
}

// ---------------------------------------------------------------------------
// ICE Wall — §5.1
// ---------------------------------------------------------------------------

describe('Rulebook §5.1.2 — ICE Wall damage over time', () => {
  it('deals DPS/tick DoT to adjacent enemy (Chebyshev ≤ 1)', () => {
    makeIceWall(10, 10)
    const eeid = makeEnemy(11, 10, 1000)

    const expectedDmg = ICE_WALL_DPS[0] / TICK_RATE

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBeCloseTo(1000 - expectedDmg, 4)
  })

  it('does NOT damage enemy outside range (Chebyshev > 1)', () => {
    makeIceWall(10, 10)
    const eeid = makeEnemy(12, 10, 1000)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000)
  })

  it('skips enemy with spawn immunity', () => {
    makeIceWall(10, 10)
    const eid = createEnemy(world)  // retains SPAWN_IMMUNITY
    world.tilePosX[eid]      = 11
    world.tilePosY[eid]      = 10
    world.healthCurrent[eid] = 100

    damageSystem(world)

    expect(world.healthCurrent[eid]).toBe(100)
  })

  it('does NOT deal DoT to IMMUNE_ICE_DOT enemy (Orchestrator — §7.5.2)', () => {
    makeIceWall(10, 10)
    const eeid = makeEnemy(11, 10, 1000, C.IMMUNE_ICE_DOT)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000)
  })

  it('marks enemy for removal when health drops to 0', () => {
    makeIceWall(10, 10)
    const eeid = makeEnemy(11, 10, 0.001)  // near zero HP

    damageSystem(world)

    expect(world.bitmask[eeid] & C.PENDING_REMOVAL).toBeTruthy()
  })
})

describe('Rulebook §5.1.1 — ICE Wall slow queuing', () => {
  it('queues slow on adjacent enemy without slow immunity', () => {
    makeIceWall(10, 10)
    makeEnemy(11, 10, 200)

    damageSystem(world)

    expect(world.statusSlowQueueLen).toBeGreaterThan(0)
  })

  it('does NOT queue slow on IMMUNE_ICE_SLOW enemy (Firewall Breacher — §7.3.1)', () => {
    makeIceWall(10, 10)
    makeEnemy(11, 10, 200, C.IMMUNE_ICE_SLOW)

    damageSystem(world)

    expect(world.statusSlowQueueLen).toBe(0)
  })

  it('does NOT queue slow on IMMUNE_SLOW enemy (Data Leech — §7.1.4)', () => {
    makeIceWall(10, 10)
    makeEnemy(11, 10, 200, C.IMMUNE_SLOW)

    damageSystem(world)

    expect(world.statusSlowQueueLen).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Firewall — §5.2
// ---------------------------------------------------------------------------

describe('Rulebook §5.2 — Firewall gap damage', () => {
  it('deals DPS/tick damage to enemy on gap tile', () => {
    makeFirewall(10, 10, 10, 11)
    const eeid = makeEnemy(10, 11, 1000)

    const expectedDmg = FIREWALL_DPS[0] / TICK_RATE

    damageSystem(world)

    // Float32Array precision limits comparison to ~2 decimal places
    expect(world.healthCurrent[eeid]).toBeCloseTo(1000 - expectedDmg, 2)
  })

  it('does NOT damage enemy NOT on gap tile', () => {
    makeFirewall(10, 10, 10, 11)
    const eeid = makeEnemy(10, 12, 1000)  // wrong tile

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000)
  })

  it('does NOT damage IMMUNE_FIREWALL_DMG enemy (Orchestrator — §7.5.2)', () => {
    makeFirewall(10, 10, 10, 11)
    const eeid = makeEnemy(10, 11, 1000, C.IMMUNE_FIREWALL_DMG)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000)
  })
})

describe('Rulebook §5.2.2 — Firewall stun queuing', () => {
  it('queues stun on enemy on gap tile without stun immunity', () => {
    makeFirewall(10, 10, 10, 11)
    const eeid = makeEnemy(10, 11, 1000)

    damageSystem(world)

    expect(world.statusStunQueueLen).toBeGreaterThan(0)
    expect(world.statusStunQueue[0]).toBe(eeid)
    expect(world.statusStunQueue[1]).toBe(FIREWALL_STUN_TICKS)
  })

  it('does NOT stun IMMUNE_FIREWALL_STUN enemy (Firewall Breacher — §7.3.1)', () => {
    makeFirewall(10, 10, 10, 11)
    makeEnemy(10, 11, 1000, C.IMMUNE_FIREWALL_STUN)

    damageSystem(world)

    expect(world.statusStunQueueLen).toBe(0)
  })

  it('does NOT stun IMMUNE_STUN enemy (Data Leech — §7.1.3)', () => {
    makeFirewall(10, 10, 10, 11)
    makeEnemy(10, 11, 1000, C.IMMUNE_STUN)

    damageSystem(world)

    expect(world.statusStunQueueLen).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Data Spike — §5.3
// ---------------------------------------------------------------------------

describe('Rulebook §5.3.3 — DATA_SPIKE piercing cone damage', () => {
  it('damages all enemies in cone when fire flag is set', () => {
    makeDataSpike(20, 20, C.Dir.N, 1, true)  // range=2, facing north

    const e1 = makeEnemy(20, 19, 100)  // dist=1, north ✓
    const e2 = makeEnemy(20, 18, 100)  // dist=2, north ✓
    const e3 = makeEnemy(20, 22, 100)  // dist=2, SOUTH ✗

    damageSystem(world)

    const dmg = DATA_SPIKE_DAMAGE[0]
    expect(world.healthCurrent[e1]).toBe(100 - dmg)
    expect(world.healthCurrent[e2]).toBe(100 - dmg)
    expect(world.healthCurrent[e3]).toBe(100)
  })

  it('clears the fire flag after firing', () => {
    const teid = makeDataSpike(20, 20, C.Dir.N, 1, true)
    makeEnemy(20, 19, 100)

    damageSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('does NOT fire when fire flag is not set', () => {
    makeDataSpike(20, 20, C.Dir.N, 1, false)
    const eeid = makeEnemy(20, 19, 100)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(100)
  })

  it('kills enemy whose HP equals spike damage', () => {
    makeDataSpike(20, 20, C.Dir.N, 1, true)
    const eeid = makeEnemy(20, 19, DATA_SPIKE_DAMAGE[0])

    damageSystem(world)

    expect(world.bitmask[eeid] & C.PENDING_REMOVAL).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Daemon Turret — §5.4
// ---------------------------------------------------------------------------

describe('Rulebook §5.4.2 — DAEMON_TURRET tile damage', () => {
  it('deals full damage to target enemy', () => {
    const eeid = makeEnemy(15, 15, 200)
    makeDaemonTurret(14, 15, 1, eeid)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(200 - DAEMON_TURRET_DAMAGE[0])
  })

  it('deals full damage to ALL enemies on target tile (not split)', () => {
    const e1   = makeEnemy(15, 15, 200)
    const e2   = makeEnemy(15, 15, 200)  // same tile
    makeDaemonTurret(14, 15, 1, e1)

    damageSystem(world)

    const dmg = DAEMON_TURRET_DAMAGE[0]
    expect(world.healthCurrent[e1]).toBe(200 - dmg)
    expect(world.healthCurrent[e2]).toBe(200 - dmg)
  })

  it('does NOT damage enemy on a different tile', () => {
    const e1 = makeEnemy(15, 15, 200)
    const e2 = makeEnemy(16, 15, 200)  // different tile
    makeDaemonTurret(14, 15, 1, e1)

    damageSystem(world)

    expect(world.healthCurrent[e2]).toBe(200)
  })

  it('clears targetingTarget after firing', () => {
    const eeid = makeEnemy(15, 15, 200)
    const teid = makeDaemonTurret(14, 15, 1, eeid)

    damageSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('does nothing when targetingTarget is 0', () => {
    const eeid = makeEnemy(15, 15, 200)
    makeDaemonTurret(14, 15, 1, 0)  // no target

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// ICE Sniper — §5.5
// ---------------------------------------------------------------------------

describe('Rulebook §5.5.3 — ICE_SNIPER single-target shot', () => {
  it('deals correct damage to target', () => {
    const eeid = makeEnemy(25, 21, 1000)
    makeIceSniper(25, 25, 1, eeid)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000 - ICE_SNIPER_DAMAGE[0])
  })

  it('kills enemy when damage >= enemy HP', () => {
    const eeid = makeEnemy(25, 21, ICE_SNIPER_DAMAGE[0])
    makeIceSniper(25, 25, 1, eeid)

    damageSystem(world)

    expect(world.bitmask[eeid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('clears targetingTarget after firing', () => {
    const eeid = makeEnemy(25, 21, 1000)
    const teid = makeIceSniper(25, 25, 1, eeid)

    damageSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('queues slow on hit for a non-IMMUNE_SLOW enemy', () => {
    const eeid = makeEnemy(25, 21, 1000)
    makeIceSniper(25, 25, 1, eeid)

    damageSystem(world)

    expect(world.statusSlowQueueLen).toBeGreaterThan(0)
    // Queue layout: [eid, magnitude, ticks, ...]
    expect(world.statusSlowQueue[0]).toBe(eeid)
    expect(world.statusSlowQueue[1]).toBeCloseTo(ICE_SNIPER_SLOW[0], 5)
    expect(world.statusSlowQueue[2]).toBe(ICE_SNIPER_SLOW_TICKS)
  })

  it('does NOT queue slow for IMMUNE_SLOW enemy (Data Leech — §7.1.4)', () => {
    const eeid = makeEnemy(25, 21, 1000, C.IMMUNE_SLOW)
    makeIceSniper(25, 25, 1, eeid)

    damageSystem(world)

    expect(world.statusSlowQueueLen).toBe(0)
  })

  it('does nothing when targetingTarget is 0', () => {
    const eeid = makeEnemy(25, 21, 1000)
    makeIceSniper(25, 25, 1, 0)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000)
  })
})

// ---------------------------------------------------------------------------
// TOWER_DISABLED — §7.7
// ---------------------------------------------------------------------------

describe('Rulebook §7.7 — TOWER_DISABLED towers deal no damage', () => {
  it('disabled ICE_WALL does not damage adjacent enemy', () => {
    const teid = makeIceWall(10, 10)
    world.bitmask[teid] |= C.TOWER_DISABLED
    const eeid = makeEnemy(11, 10, 1000)

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000)
  })

  it('disabled ICE_SNIPER does not fire', () => {
    const eeid = makeEnemy(25, 21, 1000)
    const teid = makeIceSniper(25, 25, 1, eeid)
    world.bitmask[teid] |= C.TOWER_DISABLED

    damageSystem(world)

    expect(world.healthCurrent[eeid]).toBe(1000)
  })
})
