/**
 * Status Queue System tests — §1.10.10
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, type World } from '../../ecs/world'
import {
  queueSlow,
  queueStun,
  queueDisable,
  statusQueueSystem,
} from '../statusQueue.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

describe('queueSlow (§7.0.15)', () => {
  it('adds triple [eid, magnitude, ticks] to statusSlowQueue', () => {
    queueSlow(world, 5, 0.3, 120)

    expect(world.statusSlowQueueLen).toBe(1)
    expect(world.statusSlowQueue[0]).toBe(5)       // eid
    expect(world.statusSlowQueue[1]).toBeCloseTo(0.3, 5) // magnitude
    expect(world.statusSlowQueue[2]).toBe(120)     // ticks
  })

  it('can queue multiple slow entries', () => {
    queueSlow(world, 1, 0.2, 60)
    queueSlow(world, 2, 0.4, 120)

    expect(world.statusSlowQueueLen).toBe(2)
    // Second entry starts at index 3
    expect(world.statusSlowQueue[3]).toBe(2)
    expect(world.statusSlowQueue[4]).toBeCloseTo(0.4, 5)
    expect(world.statusSlowQueue[5]).toBe(120)
  })
})

describe('queueStun (§7.0.16)', () => {
  it('adds pair [eid, ticks] to statusStunQueue', () => {
    queueStun(world, 7, 30)

    expect(world.statusStunQueueLen).toBe(1)
    expect(world.statusStunQueue[0]).toBe(7)  // eid
    expect(world.statusStunQueue[1]).toBe(30) // ticks
  })

  it('can queue multiple stun entries', () => {
    queueStun(world, 1, 30)
    queueStun(world, 2, 60)

    expect(world.statusStunQueueLen).toBe(2)
    expect(world.statusStunQueue[2]).toBe(2)
  })
})

describe('queueDisable (§7.7)', () => {
  it('adds pair [eid, ticks] to statusDisableQueue', () => {
    queueDisable(world, 10, 300)

    expect(world.statusDisableQueueLen).toBe(1)
    expect(world.statusDisableQueue[0]).toBe(10)  // eid
    expect(world.statusDisableQueue[1]).toBe(300) // ticks
  })
})

describe('statusQueueSystem', () => {
  it('is a no-op tick step (queue helpers are called from damage.system)', () => {
    // Verify it doesn't throw or modify state unexpectedly
    queueSlow(world, 1, 0.3, 60)
    const lenBefore = world.statusSlowQueueLen

    statusQueueSystem(world)

    expect(world.statusSlowQueueLen).toBe(lenBefore)
  })
})
