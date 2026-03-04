/**
 * Deterministic Replay tests — Tech.md §10.2
 *
 * Verifies that the same seed + command sequence always produces the same
 * world state hash, and that different inputs produce different hashes.
 */

import { describe, it, expect } from 'vitest'
import { createReplay, recordCommand, hashWorldState, runReplay } from '../replay'
import { createSimulation } from '../simulation'
import { CommandType } from '../ecs/world'

describe('Deterministic Replay — Tech.md §10.2', () => {
  it('same seed + no commands → same hash after 60 ticks', () => {
    const sim1 = createSimulation(42)
    for (let i = 0; i < 60; i++) sim1.tick()
    const hash1 = hashWorldState(sim1.getWorld())

    const sim2 = createSimulation(42)
    for (let i = 0; i < 60; i++) sim2.tick()
    const hash2 = hashWorldState(sim2.getWorld())

    expect(hash1).toBe(hash2)
  })

  it('different seed → different hash after 60 ticks', () => {
    const sim1 = createSimulation(42)
    for (let i = 0; i < 60; i++) sim1.tick()
    const hash1 = hashWorldState(sim1.getWorld())

    const sim2 = createSimulation(99)
    for (let i = 0; i < 60; i++) sim2.tick()
    const hash2 = hashWorldState(sim2.getWorld())

    // Different seeds → different world state (overwhelmingly likely)
    expect(hash1).not.toBe(hash2)
  })

  it('same seed + same commands → same hash (§10.2.2)', () => {
    function runWith(seed: number, startWaveTick: number): number {
      const sim = createSimulation(seed)
      for (let i = 0; i < 120; i++) {
        if (i === startWaveTick) {
          sim.getWorld().commandQueue.push({ type: CommandType.START_WAVE })
        }
        sim.tick()
      }
      return hashWorldState(sim.getWorld())
    }

    const h1 = runWith(42, 10)
    const h2 = runWith(42, 10)
    expect(h1).toBe(h2)
  })

  it('same seed + different command timing → different hash (§10.2.3)', () => {
    // Run 600 ticks (10 s) so enemies travel 5+ tiles — tilePosX/Y definitively differ.
    // Wave started at tick 1 vs tick 300 gives enemies 599 vs 299 ticks of movement.
    function runWith(seed: number, startWaveTick: number): number {
      const sim = createSimulation(seed)
      for (let i = 0; i < 600; i++) {
        if (i === startWaveTick) {
          sim.getWorld().commandQueue.push({ type: CommandType.START_WAVE })
        }
        sim.tick()
      }
      return hashWorldState(sim.getWorld())
    }

    const h1 = runWith(42, 1)
    const h2 = runWith(42, 300)
    expect(h1).not.toBe(h2)
  })

  it('createReplay creates empty replay with seed', () => {
    const r = createReplay(42)
    expect(r.seed).toBe(42)
    expect(r.entries).toHaveLength(0)
  })

  it('recordCommand appends entries in order', () => {
    const r = createReplay(42)
    recordCommand(r, 5, { type: CommandType.START_WAVE })
    recordCommand(r, 10, { type: CommandType.PLACE_TOWER, towerType: 0, x: 10, y: 10 })
    expect(r.entries).toHaveLength(2)
    expect(r.entries[0].tick).toBe(5)
    expect(r.entries[0].command).toEqual({ type: CommandType.START_WAVE })
    expect(r.entries[1].tick).toBe(10)
  })

  it('hashWorldState returns a number', () => {
    const sim = createSimulation(42)
    const hash = hashWorldState(sim.getWorld())
    expect(typeof hash).toBe('number')
    expect(hash).toBeGreaterThanOrEqual(0)
  })

  it('hashWorldState is stable — same world hashed twice gives same value', () => {
    const sim = createSimulation(77)
    for (let i = 0; i < 30; i++) sim.tick()
    const world = sim.getWorld()
    expect(hashWorldState(world)).toBe(hashWorldState(world))
  })

  it('runReplay with noop tick is deterministic — same seed yields same hash (Tech.md §10.2)', () => {
    const seed = 123
    const replay = createReplay(seed)

    // Two replays with the same seed and noop tick must produce the same hash
    const hash1 = runReplay(replay, 0, (_w) => { /* noop — test pure hash stability */ })
    const hash2 = runReplay(replay, 0, (_w) => { /* noop */ })
    expect(hash1).toBe(hash2)
  })

  it('runReplay drives the provided tick function the expected number of times', () => {
    const seed = 77
    const replay = createReplay(seed)
    let callCount = 0

    runReplay(replay, 30, (_w) => { callCount++ })

    expect(callCount).toBe(30)
  })

  it('runReplay injects commands at the correct tick', () => {
    const seed = 55
    const replay = createReplay(seed)
    // Command scheduled at loop tick 5
    recordCommand(replay, 5, { type: CommandType.START_WAVE })

    const injectedAtLoopTick: number[] = []
    let loopT = 0

    runReplay(replay, 10, (w) => {
      if (w.commandQueue.length > 0) {
        injectedAtLoopTick.push(loopT)
        w.commandQueue.length = 0
      }
      loopT++
      w.tickCount++
    })

    // Command injected before iteration t=5 executes
    expect(injectedAtLoopTick).toHaveLength(1)
    expect(injectedAtLoopTick[0]).toBe(5)
  })
})
