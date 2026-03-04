/**
 * Status Apply System tests — §1.10.3
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, createEnemy, type World } from '../../ecs/world'
import * as C from '../../ecs/component'
import { statusApplySystem } from '../statusApply.system'
import { queueSlow, queueStun } from '../statusQueue.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

function makeEnemy(world: World): number {
  const eid = createEnemy(world)
  world.slowTicks[eid] = 0
  world.slowMagnitude[eid] = 0
  world.stunTicks[eid] = 0
  world.immunityFlags[eid] = 0
  world.bitmask[eid] &= ~C.SPAWN_IMMUNITY
  return eid
}

// ---------------------------------------------------------------------------
// Slow application §7.0.15
// ---------------------------------------------------------------------------

describe('slow application (§7.0.15)', () => {
  it('applies slow to enemy', () => {
    const eid = makeEnemy(world)
    queueSlow(world, eid, 0.3, 120)
    statusApplySystem(world)

    expect(world.slowTicks[eid]).toBe(120)
    expect(world.slowMagnitude[eid]).toBeCloseTo(0.3, 5)
  })

  it('ignores slow on stunned enemy (§7.0.13)', () => {
    const eid = makeEnemy(world)
    world.stunTicks[eid] = 30
    queueSlow(world, eid, 0.5, 120)
    statusApplySystem(world)

    expect(world.slowTicks[eid]).toBe(0)
    expect(world.slowMagnitude[eid]).toBeCloseTo(0, 5)
  })

  it('replaces weaker slow with stronger (§7.0.15)', () => {
    const eid = makeEnemy(world)
    world.slowTicks[eid] = 60
    world.slowMagnitude[eid] = 0.2
    queueSlow(world, eid, 0.5, 120)
    statusApplySystem(world)

    expect(world.slowMagnitude[eid]).toBeCloseTo(0.5, 5)
    expect(world.slowTicks[eid]).toBe(120)
  })

  it('ignores weaker slow when stronger is already active (§7.0.15)', () => {
    const eid = makeEnemy(world)
    world.slowTicks[eid] = 60
    world.slowMagnitude[eid] = 0.8
    queueSlow(world, eid, 0.2, 120)
    statusApplySystem(world)

    expect(world.slowMagnitude[eid]).toBeCloseTo(0.8, 5)
    expect(world.slowTicks[eid]).toBe(60)
  })

  it('drains slow queue after processing', () => {
    const eid = makeEnemy(world)
    queueSlow(world, eid, 0.3, 60)
    statusApplySystem(world)

    expect(world.statusSlowQueueLen).toBe(0)
  })

  it('ignores slow on slow-immune enemy (§7.0.15)', () => {
    const eid = makeEnemy(world)
    world.immunityFlags[eid] = C.IMMUNE_SLOW
    queueSlow(world, eid, 0.5, 60)
    statusApplySystem(world)

    expect(world.slowTicks[eid]).toBe(0)
  })

  it('skips dead entities (bitmask = 0)', () => {
    const eid = makeEnemy(world)
    world.bitmask[eid] = 0  // entity destroyed
    queueSlow(world, eid, 0.5, 60)
    statusApplySystem(world)

    expect(world.slowTicks[eid]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Stun application §7.0.16
// ---------------------------------------------------------------------------

describe('stun application (§7.0.16)', () => {
  it('applies stun to enemy', () => {
    const eid = makeEnemy(world)
    queueStun(world, eid, 60)
    statusApplySystem(world)

    expect(world.stunTicks[eid]).toBe(60)
  })

  it('clears existing slow when stun is applied (§7.0.12)', () => {
    const eid = makeEnemy(world)
    world.slowTicks[eid] = 60
    world.slowMagnitude[eid] = 0.3
    queueStun(world, eid, 30)
    statusApplySystem(world)

    expect(world.stunTicks[eid]).toBe(30)
    expect(world.slowTicks[eid]).toBe(0)
  })

  it('replaces shorter stun with longer (§7.0.16)', () => {
    const eid = makeEnemy(world)
    world.stunTicks[eid] = 10
    queueStun(world, eid, 60)
    statusApplySystem(world)

    expect(world.stunTicks[eid]).toBe(60)
  })

  it('ignores shorter stun if longer already active (§7.0.16)', () => {
    const eid = makeEnemy(world)
    world.stunTicks[eid] = 100
    queueStun(world, eid, 20)
    statusApplySystem(world)

    expect(world.stunTicks[eid]).toBe(100)
  })

  it('ignores stun on stun-immune enemy', () => {
    const eid = makeEnemy(world)
    world.immunityFlags[eid] = C.IMMUNE_STUN
    queueStun(world, eid, 60)
    statusApplySystem(world)

    expect(world.stunTicks[eid]).toBe(0)
  })

  it('drains stun queue after processing', () => {
    const eid = makeEnemy(world)
    queueStun(world, eid, 30)
    statusApplySystem(world)

    expect(world.statusStunQueueLen).toBe(0)
  })
})
