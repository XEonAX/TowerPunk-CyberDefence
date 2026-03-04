/**
 * Pickup Decay System tests — §1.10.11
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createPickup, createTower, type World } from '../../ecs/world'
import * as C from '../../ecs/component'
import { pickupDecaySystem } from '../pickupDecay.system'
import { PICKUP_DECAY_RATE } from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

function makePickup(
  world: World,
  eddies: number,
  components: number,
  initialEddyValue: number,
  x = 5,
  y = 5,
): number {
  const eid = createPickup(world)
  world.posX[eid] = x
  world.posY[eid] = y
  world.pickupEddies[eid] = eddies
  world.pickupComponents[eid] = components
  world.pickupInitialValue[eid] = initialEddyValue
  world.pickupDecayPerTick[eid] = PICKUP_DECAY_RATE * initialEddyValue
  return eid
}

function makePingTower(world: World, x: number, y: number, range: number): number {
  const eid = createTower(world, C.PING_RANGE)
  world.posX[eid] = x
  world.posY[eid] = y
  world.pingRange[eid] = range
  return eid
}

// ---------------------------------------------------------------------------
// Decay (§4.2.5)
// ---------------------------------------------------------------------------

describe('pickup decay (§4.2.5)', () => {
  it('decreases pickup eddies each tick', () => {
    const eid = makePickup(world, 50, 0, 100)
    const before = world.pickupEddies[eid]

    pickupDecaySystem(world)

    expect(world.pickupEddies[eid]).toBeLessThan(before)
    expect(world.pickupEddies[eid]).toBeCloseTo(
      before - PICKUP_DECAY_RATE * 100,
      4, // Float32Array limits precision vs float64 constant
    )
  })

  it('decreases pickup components each tick', () => {
    const eid = makePickup(world, 0, 1, 100)
    const before = world.pickupComponents[eid]

    pickupDecaySystem(world)

    expect(world.pickupComponents[eid]).toBeLessThan(before)
  })

  it('marks pickup for removal when eddies and components hit zero', () => {
    const eid = makePickup(world, 0.001, 0, 100)
    // Set large decay so it goes to 0 in one tick
    world.pickupDecayPerTick[eid] = 10

    pickupDecaySystem(world)

    expect(world.bitmask[eid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('does not double-mark already PENDING_REMOVAL pickups', () => {
    const eid = makePickup(world, 50, 0, 100)
    world.bitmask[eid] |= C.PENDING_REMOVAL

    // Should not throw/error
    expect(() => pickupDecaySystem(world)).not.toThrow()
  })

  it('does not decay pickup that is PENDING_REMOVAL', () => {
    const eid = makePickup(world, 50, 0, 100)
    world.bitmask[eid] |= C.PENDING_REMOVAL
    const before = world.pickupEddies[eid]

    pickupDecaySystem(world)

    expect(world.pickupEddies[eid]).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// Ping Tower range exemption (§4.2.5)
// ---------------------------------------------------------------------------

describe('Ping Tower range exemption (§4.2.5)', () => {
  it('pickup inside Ping Tower range does NOT decay', () => {
    // Ping Tower at (5,5) with range 3 — pickup also at (5,5)
    makePingTower(world, 5, 5, 3)
    const eid = makePickup(world, 50, 1, 100, 5, 5)
    const eddiesBefore = world.pickupEddies[eid]
    const compsBefore  = world.pickupComponents[eid]

    pickupDecaySystem(world)

    expect(world.pickupEddies[eid]).toBe(eddiesBefore)
    expect(world.pickupComponents[eid]).toBe(compsBefore)
  })

  it('pickup at edge of Ping Tower range does NOT decay', () => {
    // Chebyshev dist = range (3): pickup at (8,5), Ping at (5,5) → dist = 3
    makePingTower(world, 5, 5, 3)
    const eid = makePickup(world, 50, 0, 100, 8, 5)
    const before = world.pickupEddies[eid]

    pickupDecaySystem(world)

    expect(world.pickupEddies[eid]).toBe(before)
  })

  it('pickup outside Ping Tower range DOES decay', () => {
    // Chebyshev dist = 4 > range (3): pickup at (9,5), Ping at (5,5)
    makePingTower(world, 5, 5, 3)
    const eid = makePickup(world, 50, 0, 100, 9, 5)
    const before = world.pickupEddies[eid]

    pickupDecaySystem(world)

    expect(world.pickupEddies[eid]).toBeLessThan(before)
  })

  it('pickup decays when Ping Tower is disabled (§7.7)', () => {
    const pingEid = makePingTower(world, 5, 5, 3)
    world.bitmask[pingEid] |= C.TOWER_DISABLED
    const eid = makePickup(world, 50, 0, 100, 5, 5)
    const before = world.pickupEddies[eid]

    pickupDecaySystem(world)

    expect(world.pickupEddies[eid]).toBeLessThan(before)
  })

  it('pickup does NOT decay if covered by any one of multiple Ping Towers', () => {
    makePingTower(world, 20, 20, 2) // far away — doesn't cover
    makePingTower(world, 5, 5, 3)   // covers the pickup
    const eid = makePickup(world, 50, 0, 100, 5, 5)
    const before = world.pickupEddies[eid]

    pickupDecaySystem(world)

    expect(world.pickupEddies[eid]).toBe(before)
  })
})
