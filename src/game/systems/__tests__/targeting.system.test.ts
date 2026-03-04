/**
 * Targeting System tests — §1.10.7
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createTower, createEnemy, type World } from '../../ecs/world'
import * as C from '../../ecs/component'
import { targetingSystem, DATA_SPIKE_FIRE_FLAG } from '../targeting.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an ICE_SNIPER tower at tile (tx, ty) with level 1 and CLOSEST mode. */
function makeIceSniper(tx: number, ty: number, level = 1): number {
  const eid = createTower(world, C.TARGETING)
  world.towerType[eid]         = C.TowerType.ICE_SNIPER
  world.towerLevel[eid]        = level
  world.posX[eid]              = tx
  world.posY[eid]              = ty
  world.targetingMode[eid]     = C.TargetingMode.CLOSEST
  world.targetingCooldown[eid] = 0
  world.targetingTarget[eid]   = 0
  return eid
}

/** Create a DAEMON_TURRET at (tx, ty). */
function makeDaemonTurret(tx: number, ty: number, level = 1): number {
  const eid = createTower(world, C.TARGETING)
  world.towerType[eid]         = C.TowerType.DAEMON_TURRET
  world.towerLevel[eid]        = level
  world.posX[eid]              = tx
  world.posY[eid]              = ty
  world.targetingMode[eid]     = C.TargetingMode.CLOSEST
  world.targetingCooldown[eid] = 0
  world.targetingTarget[eid]   = 0
  return eid
}

/** Create a DATA_SPIKE tower at (tx, ty) facing north. */
function makeDataSpike(tx: number, ty: number, facing: number = C.Dir.N, level = 1): number {
  const eid = createTower(world, C.TARGETING)
  world.towerType[eid]         = C.TowerType.DATA_SPIKE
  world.towerLevel[eid]        = level
  world.posX[eid]              = tx
  world.posY[eid]              = ty
  world.towerFacing[eid]       = facing
  world.targetingCooldown[eid] = 0
  world.targetingTarget[eid]   = 0
  return eid
}

/** Create an enemy at (ex, ey) without spawn immunity. */
function makeEnemy(ex: number, ey: number, hp = 100): number {
  const eid = createEnemy(world)
  world.tilePosX[eid]      = ex
  world.tilePosY[eid]      = ey
  world.healthCurrent[eid] = hp
  world.healthMax[eid]     = hp
  world.bitmask[eid]      &= ~C.SPAWN_IMMUNITY
  return eid
}

// ---------------------------------------------------------------------------
// Cooldown tests
// ---------------------------------------------------------------------------

describe('Rulebook §1.10.7 — cooldown management', () => {
  it('tower with cooldown > 0 decrements cooldown and does NOT acquire target', () => {
    const teid = makeIceSniper(25, 25)
    world.targetingCooldown[teid] = 10
    // Place enemy in valid sniper range (dist = 4)
    makeEnemy(25, 21)

    targetingSystem(world)

    expect(world.targetingCooldown[teid]).toBe(9)
    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('tower with cooldown 0 acquires target and resets cooldown', () => {
    const teid = makeIceSniper(25, 25)
    world.targetingCooldown[teid] = 0
    const eeid = makeEnemy(25, 21)  // dist = 4, in [3,5] range

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(eeid)
    expect(world.targetingCooldown[teid]).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// TOWER_DISABLED
// ---------------------------------------------------------------------------

describe('Rulebook §1.10.7 — TOWER_DISABLED towers skip targeting', () => {
  it('TOWER_DISABLED tower does not acquire target even with cooldown 0', () => {
    const teid = makeIceSniper(25, 25)
    world.bitmask[teid] |= C.TOWER_DISABLED
    makeEnemy(25, 21)

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// ICE_SNIPER
// ---------------------------------------------------------------------------

describe('Rulebook §5.5.2 — ICE_SNIPER minimum range', () => {
  it('does NOT target enemy within minimum range (< 3 tiles, dist=1)', () => {
    const teid = makeIceSniper(25, 25)
    makeEnemy(25, 24)  // dist = 1

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('does NOT target enemy at dist=2 (still < min range)', () => {
    const teid = makeIceSniper(25, 25)
    makeEnemy(25, 23)  // dist = 2

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('targets enemy at exactly minimum range (dist = 3)', () => {
    const teid = makeIceSniper(25, 25)
    const eeid = makeEnemy(25, 22)  // dist = 3 (minimum valid)

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(eeid)
  })

  it('targets enemy at maximum range (dist = 5)', () => {
    const teid = makeIceSniper(25, 25)
    const eeid = makeEnemy(25, 20)  // dist = 5

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(eeid)
  })

  it('does NOT target enemy beyond maximum range (dist = 6)', () => {
    const teid = makeIceSniper(25, 25)
    makeEnemy(25, 19)  // dist = 6

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })
})

describe('Rulebook §5.5.4.1 — ICE_SNIPER targeting modes', () => {
  it('CLOSEST mode: targets nearest valid enemy', () => {
    const teid = makeIceSniper(25, 25)
    world.targetingMode[teid] = C.TargetingMode.CLOSEST

    const farEnemy  = makeEnemy(25, 20, 100)  // dist = 5
    const nearEnemy = makeEnemy(25, 22, 100)  // dist = 3 (closer)
    void farEnemy

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(nearEnemy)
  })

  it('HIGHEST_HP mode: targets enemy with most HP', () => {
    const teid = makeIceSniper(25, 25)
    world.targetingMode[teid] = C.TargetingMode.HIGHEST_HP

    makeEnemy(25, 22, 50)          // dist=3, hp=50
    const strongEnemy = makeEnemy(25, 21, 200)  // dist=4, hp=200

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(strongEnemy)
  })

  it('LOWEST_HP mode: targets enemy with least HP', () => {
    const teid = makeIceSniper(25, 25)
    world.targetingMode[teid] = C.TargetingMode.LOWEST_HP

    const weakEnemy = makeEnemy(25, 22, 30)    // dist=3, hp=30
    makeEnemy(25, 21, 200)                     // dist=4, hp=200

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(weakEnemy)
  })
})

// ---------------------------------------------------------------------------
// DAEMON_TURRET
// ---------------------------------------------------------------------------

describe('Rulebook §5.4.2 — DAEMON_TURRET target selection', () => {
  it('targets enemy within range 1 tile', () => {
    const teid = makeDaemonTurret(25, 25)
    const eeid = makeEnemy(26, 25)  // dist = 1

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(eeid)
  })

  it('does NOT target enemy at dist=2 when range=1', () => {
    const teid = makeDaemonTurret(25, 25)
    makeEnemy(27, 25)  // dist = 2

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('CLOSEST mode: picks enemy on closest tile (first encountered on tie)', () => {
    const teid = makeDaemonTurret(25, 25)
    world.targetingMode[teid] = C.TargetingMode.CLOSEST

    const e1 = makeEnemy(26, 25)  // dist = 1
    const e2 = makeEnemy(26, 26)  // dist = 1 — tie; e1 has lower eid so is picked first
    void e2

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(e1)
  })
})

// ---------------------------------------------------------------------------
// DATA_SPIKE
// ---------------------------------------------------------------------------

describe('Rulebook §5.3.2 — DATA_SPIKE fire flag', () => {
  it('sets DATA_SPIKE_FIRE_FLAG when enemy is in north-facing cone', () => {
    const teid = makeDataSpike(25, 25, C.Dir.N)  // range 2 at L1
    makeEnemy(25, 23)  // dist=2, north → in cone (ey <= ty AND chebyshev=2)

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(DATA_SPIKE_FIRE_FLAG)
  })

  it('does NOT fire when enemy is in opposite direction (south of north-facing tower)', () => {
    const teid = makeDataSpike(25, 25, C.Dir.N)
    makeEnemy(25, 27)  // dist=2, SOUTH — not in north cone

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('sets fire flag for south-facing cone (enemy below tower)', () => {
    const teid = makeDataSpike(25, 25, C.Dir.S)
    makeEnemy(25, 27)  // dist=2, south → in cone

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(DATA_SPIKE_FIRE_FLAG)
  })

  it('does NOT set fire flag for enemy with spawn immunity', () => {
    const teid = makeDataSpike(25, 25, C.Dir.N)
    // Enemy in cone but with spawn immunity (NOT removed)
    const eid = createEnemy(world)
    world.tilePosX[eid]      = 25
    world.tilePosY[eid]      = 23
    world.healthCurrent[eid] = 50
    // bitmask retains SPAWN_IMMUNITY from createEnemy

    targetingSystem(world)

    expect(world.targetingTarget[teid]).toBe(0)
  })

  it('resets cooldown to DATA_SPIKE_COOLDOWN_TICKS after firing', () => {
    const teid = makeDataSpike(25, 25, C.Dir.N)
    makeEnemy(25, 23)

    targetingSystem(world)

    // DATA_SPIKE_COOLDOWN_TICKS = 120
    expect(world.targetingCooldown[teid]).toBe(120)
  })
})
