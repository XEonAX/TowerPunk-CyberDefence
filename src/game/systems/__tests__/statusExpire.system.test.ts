/**
 * Status Expire System tests — §1.10.4
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createEnemy, createTower, type World } from '../../ecs/world'
import * as C from '../../ecs/component'
import { statusExpireSystem } from '../statusExpire.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

// ---------------------------------------------------------------------------
// Slow expiry (§7.0.15)
// ---------------------------------------------------------------------------

describe('slow expiry (§7.0.15)', () => {
  it('decrements slow ticks each tick', () => {
    const eid = createEnemy(world)
    world.slowTicks[eid] = 5
    world.slowMagnitude[eid] = 0.3

    statusExpireSystem(world)

    expect(world.slowTicks[eid]).toBe(4)
    expect(world.slowMagnitude[eid]).toBeCloseTo(0.3, 5)
  })

  it('clears slow magnitude when ticks reach 0', () => {
    const eid = createEnemy(world)
    world.slowTicks[eid] = 1
    world.slowMagnitude[eid] = 0.3

    statusExpireSystem(world)

    expect(world.slowTicks[eid]).toBe(0)
    expect(world.slowMagnitude[eid]).toBe(0)
  })

  it('does not decrement slow below 0', () => {
    const eid = createEnemy(world)
    world.slowTicks[eid] = 0
    world.slowMagnitude[eid] = 0

    statusExpireSystem(world)

    expect(world.slowTicks[eid]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Stun expiry (§7.0.11)
// ---------------------------------------------------------------------------

describe('stun expiry (§7.0.11)', () => {
  it('decrements stun ticks each tick', () => {
    const eid = createEnemy(world)
    world.stunTicks[eid] = 10

    statusExpireSystem(world)

    expect(world.stunTicks[eid]).toBe(9)
  })

  it('does not decrement stun below 0', () => {
    const eid = createEnemy(world)
    world.stunTicks[eid] = 0

    statusExpireSystem(world)

    expect(world.stunTicks[eid]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Tower disable expiry (§7.7)
// ---------------------------------------------------------------------------

describe('tower disable expiry (§7.7)', () => {
  it('decrements towerDisableTicks each tick', () => {
    const eid = createTower(world, C.TOWER_DISABLED)
    world.towerDisableTicks[eid] = 10

    statusExpireSystem(world)

    expect(world.towerDisableTicks[eid]).toBe(9)
  })

  it('clears TOWER_DISABLED flag when ticks reach 0', () => {
    const eid = createTower(world, C.TOWER_DISABLED)
    world.towerDisableTicks[eid] = 1

    statusExpireSystem(world)

    expect(world.towerDisableTicks[eid]).toBe(0)
    expect(world.bitmask[eid] & C.TOWER_DISABLED).toBe(0)
  })

  it('does not affect towers with no disable ticks', () => {
    const eid = createTower(world)
    world.towerDisableTicks[eid] = 0

    statusExpireSystem(world)

    // TOWER_DISABLED should not be set (it was not set to begin with)
    expect(world.bitmask[eid] & C.TOWER_DISABLED).toBe(0)
  })
})
