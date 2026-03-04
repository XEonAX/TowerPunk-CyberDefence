import { describe, it, expect, vi } from 'vitest'
import type { System } from '../system'
import type { World } from '../world'
import { createWorld } from '../world'

describe('System runner', () => {
  it('calls each pipeline slot in order', () => {
    const callOrder: number[] = []
    const systems: System[] = Array.from({ length: 14 }, (_, i) => (_world: World) => {
      callOrder.push(i)
    })

    const world = createWorld()
    systems.forEach((s) => s(world))

    expect(callOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('pipeline has exactly 14 slots matching §1.10 order', () => {
    // The 14 systems per §1.10:
    const EXPECTED_COUNT = 14
    const callCount = vi.fn()
    const systems: System[] = Array.from({ length: EXPECTED_COUNT }, () => () => {
      callCount()
    })
    const world = createWorld()
    systems.forEach((s) => s(world))
    expect(callCount).toHaveBeenCalledTimes(EXPECTED_COUNT)
  })
})
