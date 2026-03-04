/**
 * Pickup Decay System tests — §1.10.11
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createPickup, type World } from '../../ecs/world'
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
): number {
  const eid = createPickup(world)
  world.posX[eid] = 5
  world.posY[eid] = 5
  world.pickupEddies[eid] = eddies
  world.pickupComponents[eid] = components
  world.pickupInitialValue[eid] = initialEddyValue
  world.pickupDecayPerTick[eid] = PICKUP_DECAY_RATE * initialEddyValue
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
