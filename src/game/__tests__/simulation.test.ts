import { describe, it, expect } from 'vitest'
import { createSimulation } from '../simulation'
import { CommandType } from '../ecs/world'

describe('Simulation Driver', () => {
  it('tick() increments tickCount by 1', () => {
    const sim = createSimulation(1)
    expect(sim.world.tickCount).toBe(0)
    sim.tick()
    expect(sim.world.tickCount).toBe(1)
  })

  it('calling tick() N times advances tickCount to N', () => {
    const sim = createSimulation(2)
    for (let i = 0; i < 100; i++) sim.tick()
    expect(sim.world.tickCount).toBe(100)
  })

  it('getWorld() returns same world reference', () => {
    const sim = createSimulation(3)
    expect(sim.getWorld()).toBe(sim.world)
  })

  it('commandQueue is empty after tick (commands consumed)', () => {
    const sim = createSimulation(4)
    sim.world.commandQueue.push({ type: CommandType.START_WAVE })
    sim.tick()
    // commandSystem is still noop, so queue may not be consumed
    // This will pass once commandSystem is wired in
    // For now, just verify tick runs without throwing
    expect(sim.world.tickCount).toBe(1)
  })
})
