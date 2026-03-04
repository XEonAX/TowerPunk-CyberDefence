/**
 * Event System tests — §1.10.1
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorld, GamePhase, type World } from '../../ecs/world'
import { eventSystem } from '../event.system'
import { SPAWN_INTERVAL_TICKS } from '../../wave'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

describe('PRE_GAME phase', () => {
  it('does nothing in PRE_GAME phase', () => {
    world.currentPhase = GamePhase.PRE_GAME
    world.breakTicksRemaining = 100
    eventSystem(world)
    expect(world.breakTicksRemaining).toBe(100)
    expect(world.currentPhase).toBe(GamePhase.PRE_GAME)
  })
})

describe('GAME_OVER phase', () => {
  it('does nothing in GAME_OVER phase (§10.2)', () => {
    world.currentPhase = GamePhase.GAME_OVER
    world.breakTicksRemaining = 5
    eventSystem(world)
    // unchanged
    expect(world.breakTicksRemaining).toBe(5)
    expect(world.currentPhase).toBe(GamePhase.GAME_OVER)
  })
})

describe('WAVE_BREAK phase', () => {
  it('decrements breakTicksRemaining each tick', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.breakTicksRemaining = 10

    eventSystem(world)
    expect(world.breakTicksRemaining).toBe(9)

    eventSystem(world)
    expect(world.breakTicksRemaining).toBe(8)
  })

  it('does NOT decrement when breakTicksRemaining is Infinity (manual-start waves)', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.breakTicksRemaining = Infinity

    eventSystem(world)
    expect(world.breakTicksRemaining).toBe(Infinity)
    expect(world.currentPhase).toBe(GamePhase.WAVE_BREAK)
  })

  it('transitions to WAVE_ACTIVE when countdown reaches 0', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.currentWave = 11  // auto-start wave
    world.breakTicksRemaining = 1

    // Tick to 0
    eventSystem(world)
    expect(world.breakTicksRemaining).toBe(0)

    // Tick at 0 → starts wave
    eventSystem(world)
    expect(world.currentPhase).toBe(GamePhase.WAVE_ACTIVE)
    expect(world.currentWave).toBe(12)
  })

  it('sets up waveEnemyList and waveSpawnIndex when wave starts', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.currentWave = 0  // will become wave 1
    world.breakTicksRemaining = 0

    eventSystem(world)

    expect(world.currentWave).toBe(1)
    expect(world.waveEnemyList.length).toBe(5)  // wave 1 has 5 DATA_LEECH
    expect(world.waveSpawnIndex).toBe(0)
    expect(world.nextSpawnTick).toBe(world.tickCount + SPAWN_INTERVAL_TICKS)
  })
})

describe('WAVE_ACTIVE phase', () => {
  it('transitions to WAVE_BREAK when all enemies spawned and enemiesAlive === 0', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 11   // §8.2.3: wave 11+ has finite break duration
    world.waveEnemyList = []
    world.waveSpawnIndex = 0  // all spawned (0 >= 0)
    world.enemiesAlive = 0

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.WAVE_BREAK)
  })

  it('stays in WAVE_ACTIVE while enemies are still alive', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    world.waveEnemyList = []
    world.waveSpawnIndex = 0
    world.enemiesAlive = 3  // 3 enemies still on field

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.WAVE_ACTIVE)
  })

  it('stays in WAVE_ACTIVE while enemies are still to be spawned', () => {
    world.currentPhase = GamePhase.WAVE_ACTIVE
    world.currentWave = 1
    world.waveEnemyList = [0, 0, 0]  // 3 enemies queued
    world.waveSpawnIndex = 1         // 2 more to spawn
    world.enemiesAlive = 0

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.WAVE_ACTIVE)
  })
})
