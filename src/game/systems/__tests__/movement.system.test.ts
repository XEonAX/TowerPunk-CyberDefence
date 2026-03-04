/**
 * Movement System tests — §1.10.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createEnemy, type World } from '../../ecs/world'
import * as C from '../../ecs/component'
import { movementSystem } from '../movement.system'
import { CORE_X, CORE_Y, TICK_RATE } from '../../constants'
import { idx } from '../../pathfinding/grid'

// DIR values — must match component.ts Dir enum
const DIR_N = 0  // dy = -1
const DIR_S = 1  // dy = +1

let world: World

beforeEach(() => {
  world = createWorld(42)
})

/** Create a test enemy at (tx, ty) without spawn immunity, with given speed (tiles/sec). */
function makeEnemy(tx: number, ty: number, speedPerSec: number): number {
  const eid = createEnemy(world)
  world.tilePosX[eid] = tx
  world.tilePosY[eid] = ty
  world.tileProgress[eid] = 0
  world.enemySpeed[eid] = speedPerSec  // tiles/sec
  world.enemyDamage[eid] = 5
  world.healthMax[eid] = 10
  world.healthCurrent[eid] = 10
  // Remove spawn immunity so movement applies
  world.bitmask[eid] &= ~C.SPAWN_IMMUNITY
  return eid
}

describe('Rulebook §2.10.2 — per-tile progress advancement', () => {
  it('enemy with speed 60 tiles/sec advances tileProgress by 1.0 per tick and moves one tile', () => {
    // At speed 60 tiles/sec: 60/60 = 1.0 per tick → exact tile transition
    // Set flowDir at (5,5) to South (DIR_S=1) so enemy moves away from Core
    const tx = 5
    const ty = 5
    world.flowDir[idx(tx, ty)] = DIR_S

    const eid = makeEnemy(tx, ty, 60)
    // tileProgress = 0 → after 1 tick: 0 + 1.0 = 1.0 >= 1.0 → advance
    movementSystem(world)

    // Enemy should have moved South: (5, 5) → (5, 6)
    expect(world.tilePosY[eid]).toBe(6)
    expect(world.tilePosX[eid]).toBe(5)
    expect(world.tileProgress[eid]).toBeCloseTo(0, 6)
  })

  it('enemy with speed 30 tiles/sec advances tileProgress by 0.5 without tile change', () => {
    const tx = 5
    const ty = 5
    const eid = makeEnemy(tx, ty, 30)

    movementSystem(world)

    // 30 / 60 = 0.5 per tick → no tile change
    expect(world.tileProgress[eid]).toBeCloseTo(0.5, 6)
    expect(world.tilePosX[eid]).toBe(tx)
    expect(world.tilePosY[eid]).toBe(ty)
  })
})

describe('Rulebook §7.0.11 — stun prevents movement', () => {
  it('stunned enemy does not advance tileProgress', () => {
    const eid = makeEnemy(5, 5, 60)
    // Apply stun (component flag already set by createEnemy)
    world.stunTicks[eid] = 30  // 30 ticks remaining

    movementSystem(world)

    expect(world.tileProgress[eid]).toBeCloseTo(0, 6)
    expect(world.tilePosX[eid]).toBe(5)
    expect(world.tilePosY[eid]).toBe(5)
  })

  it('non-stunned enemy with stunTicks=0 still moves normally', () => {
    const eid = makeEnemy(5, 5, 30)
    world.stunTicks[eid] = 0  // not stunned

    movementSystem(world)

    expect(world.tileProgress[eid]).toBeCloseTo(0.5, 6)
  })
})

describe('Rulebook §7.0.10 — slow reduces effective speed', () => {
  it('50% slowed enemy advances at half speed', () => {
    const eid = makeEnemy(5, 5, 60)  // 60 tiles/sec = 1.0/tick normally
    // Apply 50% slow
    world.slowMagnitude[eid] = 0.5
    world.slowTicks[eid] = 120

    movementSystem(world)

    // effective speed = 60 * (1 - 0.5) = 30 tiles/sec → 0.5 per tick
    expect(world.tileProgress[eid]).toBeCloseTo(0.5, 6)
    // No tile change
    expect(world.tilePosX[eid]).toBe(5)
    expect(world.tilePosY[eid]).toBe(5)
  })

  it('slow has no effect when slowTicks === 0', () => {
    const eid = makeEnemy(5, 5, 30)
    world.slowMagnitude[eid] = 0.9  // 90% slow set but...
    world.slowTicks[eid] = 0        // ...no duration → not active

    movementSystem(world)

    // Full speed: 30/60 = 0.5 per tick
    expect(world.tileProgress[eid]).toBeCloseTo(0.5, 6)
  })
})

describe('Rulebook §3.4 — Core damage and enemy removal', () => {
  it('enemy entering Core tile deals damage and is marked for removal', () => {
    // Core is at (CORE_X, CORE_Y) = (25, 25).
    // Place enemy one tile South of Core: (25, 26).
    // flowDir at (25, 26) defaults to DIR_N (0, dy=-1) → moves to (25, 25) = Core.
    const eid = makeEnemy(CORE_X, CORE_Y + 1, 60)
    // Ensure flowDir[idx(25,26)] = DIR_N (default 0)
    expect(world.flowDir[idx(CORE_X, CORE_Y + 1)]).toBe(DIR_N)

    const coreHpBefore = world.healthCurrent[world.coreEid]

    movementSystem(world)

    // Core should have taken damage equal to enemyDamage
    expect(world.healthCurrent[world.coreEid]).toBeLessThan(coreHpBefore)
    expect(world.healthCurrent[world.coreEid]).toBeCloseTo(coreHpBefore - 5, 4)

    // Enemy should be marked for removal
    expect(world.bitmask[eid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('enemy that does not reach Core is NOT marked for removal', () => {
    // Place enemy far from Core with low speed
    const eid = makeEnemy(3, 3, 1)  // 1 tile/sec → 1/60 per tick, won't advance

    movementSystem(world)

    expect(world.bitmask[eid] & C.PENDING_REMOVAL).toBe(0)
  })
})

describe('§2.10.1 — spawn immunity prevents movement', () => {
  it('enemy with SPAWN_IMMUNITY flag set is skipped', () => {
    const eid = createEnemy(world)
    world.tilePosX[eid] = 5
    world.tilePosY[eid] = 5
    world.tileProgress[eid] = 0
    world.enemySpeed[eid] = 60
    // SPAWN_IMMUNITY remains set (default from createEnemy)

    movementSystem(world)

    expect(world.tileProgress[eid]).toBeCloseTo(0, 6)
  })
})

describe('§1.8 — TICK_RATE constant', () => {
  it('TICK_RATE is 60', () => {
    expect(TICK_RATE).toBe(60)
  })
})
