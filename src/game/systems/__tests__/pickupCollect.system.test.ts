/**
 * Pickup Collect System tests — §1.10.13
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createPickup,
  createTower,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { pickupCollectSystem } from '../pickupCollect.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

function makePingTower(
  world: World,
  x: number,
  y: number,
  range: number,
): number {
  const eid = createTower(world, C.PING_RANGE)
  world.posX[eid] = x
  world.posY[eid] = y
  world.pingRange[eid] = range
  return eid
}

function makePickup(
  world: World,
  x: number,
  y: number,
  eddies: number,
  components: number,
): number {
  const eid = createPickup(world)
  world.posX[eid] = x
  world.posY[eid] = y
  world.pickupEddies[eid] = eddies
  world.pickupComponents[eid] = components
  return eid
}

// ---------------------------------------------------------------------------
// Collection (§5.7.1)
// ---------------------------------------------------------------------------

describe('Ping Tower collection (§5.7.1)', () => {
  it('collects pickup within Chebyshev range', () => {
    makePingTower(world, 5, 5, 3)
    const pickupEid = makePickup(world, 6, 6, 50, 2) // Chebyshev dist = 1

    world.eddies = 0
    world.components = 0
    pickupCollectSystem(world)

    expect(world.eddies).toBe(50)
    expect(world.components).toBe(2)
    expect(world.bitmask[pickupEid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('does not collect pickup outside Chebyshev range', () => {
    makePingTower(world, 5, 5, 2)
    const pickupEid = makePickup(world, 20, 20, 50, 2) // far away

    world.eddies = 0
    pickupCollectSystem(world)

    expect(world.eddies).toBe(0)
    expect(world.bitmask[pickupEid] & C.PENDING_REMOVAL).toBe(0)
  })

  it('collects pickup at exact range boundary', () => {
    makePingTower(world, 5, 5, 3)
    const pickupEid = makePickup(world, 8, 5, 25, 0) // Chebyshev dist = 3

    world.eddies = 0
    pickupCollectSystem(world)

    expect(world.eddies).toBe(25)
    expect(world.bitmask[pickupEid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('does not collect pickup at range + 1', () => {
    makePingTower(world, 5, 5, 3)
    const pickupEid = makePickup(world, 9, 5, 25, 0) // Chebyshev dist = 4

    world.eddies = 0
    pickupCollectSystem(world)

    expect(world.eddies).toBe(0)
    expect(world.bitmask[pickupEid] & C.PENDING_REMOVAL).toBe(0)
  })

  it('disabled ping tower does not collect (§7.7)', () => {
    const pingEid = makePingTower(world, 5, 5, 3)
    world.bitmask[pingEid] |= C.TOWER_DISABLED
    const pickupEid = makePickup(world, 6, 6, 50, 2)

    world.eddies = 0
    pickupCollectSystem(world)

    expect(world.eddies).toBe(0)
    expect(world.bitmask[pickupEid] & C.PENDING_REMOVAL).toBe(0)
  })

  it('does not collect already PENDING_REMOVAL pickups', () => {
    makePingTower(world, 5, 5, 3)
    const pickupEid = makePickup(world, 6, 6, 50, 2)
    world.bitmask[pickupEid] |= C.PENDING_REMOVAL

    world.eddies = 0
    pickupCollectSystem(world)

    expect(world.eddies).toBe(0)
  })

  it('floors fractional components when collecting', () => {
    makePingTower(world, 5, 5, 3)
    const pickupEid = makePickup(world, 6, 6, 0, 1.7)

    world.components = 0
    pickupCollectSystem(world)

    expect(world.components).toBe(1)
    expect(world.bitmask[pickupEid] & C.PENDING_REMOVAL).toBeTruthy()
  })

  it('collects from multiple pickups in range', () => {
    makePingTower(world, 5, 5, 5)
    const p1 = makePickup(world, 6, 5, 10, 0)
    const p2 = makePickup(world, 7, 5, 20, 0)

    world.eddies = 0
    pickupCollectSystem(world)

    expect(world.eddies).toBe(30)
    expect(world.bitmask[p1] & C.PENDING_REMOVAL).toBeTruthy()
    expect(world.bitmask[p2] & C.PENDING_REMOVAL).toBeTruthy()
  })
})
