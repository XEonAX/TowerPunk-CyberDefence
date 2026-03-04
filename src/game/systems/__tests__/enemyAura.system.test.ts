/**
 * Enemy Aura System tests — §1.10.6, §7.6
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createTower,
  createEnemy,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { enemyAuraSystem } from '../enemyAura.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** VDB_NETRUNNER at (ex, ey) with wave-scaled damage — spawn immunity removed. */
function makeVdbNetrunner(ex: number, ey: number, scaledDmg = 30): number {
  const eid = createEnemy(world)
  world.tilePosX[eid]      = ex
  world.tilePosY[eid]      = ey
  world.healthCurrent[eid] = 750
  world.healthMax[eid]     = 750
  world.enemyType[eid]     = C.EnemyType.VDB_NETRUNNER
  world.enemyDamage[eid]   = scaledDmg
  world.bitmask[eid]      &= ~C.SPAWN_IMMUNITY
  return eid
}

/** Non-VDB enemy (Data Leech) at (ex, ey). */
function makeDataLeech(ex: number, ey: number): number {
  const eid = createEnemy(world)
  world.tilePosX[eid]      = ex
  world.tilePosY[eid]      = ey
  world.healthCurrent[eid] = 10
  world.enemyType[eid]     = C.EnemyType.DATA_LEECH
  world.enemyDamage[eid]   = 5
  world.bitmask[eid]      &= ~C.SPAWN_IMMUNITY
  return eid
}

/** Tower at tile (tx, ty) with given HP. */
function makeTower(tx: number, ty: number, hp = 500): number {
  const eid = createTower(world)
  world.towerType[eid]     = C.TowerType.ICE_WALL
  world.towerLevel[eid]    = 1
  world.posX[eid]          = tx
  world.posY[eid]          = ty
  world.healthCurrent[eid] = hp
  world.healthMax[eid]     = hp
  return eid
}

// ---------------------------------------------------------------------------
// VDB Netrunner aura — §7.6
// ---------------------------------------------------------------------------

describe('Rulebook §7.6.2 — VDB Netrunner damages adjacent towers', () => {
  it('damages a tower at Chebyshev distance 1 (east) by enemyDamage per tick', () => {
    const auraDmg = 30
    makeVdbNetrunner(10, 10, auraDmg)
    const teid = makeTower(11, 10, 500)  // dist=1

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500 - auraDmg)
  })

  it('damages tower at diagonal distance 1 (Chebyshev = 1)', () => {
    const auraDmg = 30
    makeVdbNetrunner(10, 10, auraDmg)
    const teid = makeTower(11, 11, 500)  // diagonal

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500 - auraDmg)
  })

  it('does NOT damage tower at Chebyshev distance 2', () => {
    makeVdbNetrunner(10, 10, 30)
    const teid = makeTower(12, 10, 500)  // dist = 2

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500)
  })

  it('marks tower for removal when aura deals lethal damage', () => {
    makeVdbNetrunner(10, 10, 500)  // damage = tower HP
    const teid = makeTower(11, 10, 500)

    enemyAuraSystem(world)

    expect(world.bitmask[teid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('damages multiple towers within range simultaneously', () => {
    const auraDmg = 30
    makeVdbNetrunner(10, 10, auraDmg)
    const t1 = makeTower(11, 10, 500)  // dist=1 east ✓
    const t2 = makeTower(10, 9,  500)  // dist=1 north ✓
    const t3 = makeTower(12, 10, 500)  // dist=2 — out of range ✗

    enemyAuraSystem(world)

    expect(world.healthCurrent[t1]).toBe(500 - auraDmg)
    expect(world.healthCurrent[t2]).toBe(500 - auraDmg)
    expect(world.healthCurrent[t3]).toBe(500)
  })

  it('uses wave-scaled enemyDamage (not a hardcoded constant)', () => {
    const scaledDmg = 60  // double base due to wave scaling
    makeVdbNetrunner(10, 10, scaledDmg)
    const teid = makeTower(11, 10, 500)

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500 - scaledDmg)
  })
})

// ---------------------------------------------------------------------------
// Spawn immunity blocks aura — §2.10.1
// ---------------------------------------------------------------------------

describe('Rulebook §2.10.1 — spawn immunity suppresses VDB aura', () => {
  it('VDB Netrunner with spawn immunity does NOT trigger aura', () => {
    // Create VDB with immunity still active (do NOT remove SPAWN_IMMUNITY)
    const eid = createEnemy(world)
    world.tilePosX[eid]    = 10
    world.tilePosY[eid]    = 10
    world.enemyType[eid]   = C.EnemyType.VDB_NETRUNNER
    world.enemyDamage[eid] = 30
    // bitmask retains SPAWN_IMMUNITY from createEnemy

    const teid = makeTower(11, 10, 500)

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Non-VDB enemies have no aura — §7.6
// ---------------------------------------------------------------------------

describe('Rulebook §7.6 — non-VDB enemies do not trigger tower aura', () => {
  it('Data Leech adjacent to tower does NOT deal aura damage', () => {
    makeDataLeech(10, 10)
    const teid = makeTower(11, 10, 500)

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500)
  })

  it('Code Runner adjacent to tower does NOT deal aura damage', () => {
    const eid = createEnemy(world)
    world.tilePosX[eid]    = 10
    world.tilePosY[eid]    = 10
    world.enemyType[eid]   = C.EnemyType.CODE_RUNNER
    world.enemyDamage[eid] = 10
    world.bitmask[eid]    &= ~C.SPAWN_IMMUNITY

    const teid = makeTower(11, 10, 500)

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500)
  })

  it('Saboteur adjacent to tower does NOT deal aura damage via enemyAuraSystem', () => {
    const eid = createEnemy(world)
    world.tilePosX[eid]    = 10
    world.tilePosY[eid]    = 10
    world.enemyType[eid]   = C.EnemyType.SABOTEUR
    world.enemyDamage[eid] = 20
    world.bitmask[eid]    &= ~C.SPAWN_IMMUNITY

    const teid = makeTower(11, 10, 500)

    enemyAuraSystem(world)

    expect(world.healthCurrent[teid]).toBe(500)
  })
})
