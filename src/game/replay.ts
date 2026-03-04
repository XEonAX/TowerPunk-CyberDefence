/**
 * Deterministic Replay System — Tech.md §10.2
 *
 * Records timed commands and re-feeds them to a fresh simulation.
 * Given identical seed + command sequence → identical world state hash.
 */

import { type World, createWorld } from './ecs/world'
import { ENEMY } from './ecs/component'

export interface ReplayEntry {
  /** Tick at which this command was submitted */
  tick: number
  /** Serialized command (JSON-compatible) */
  command: Record<string, unknown>
}

export interface Replay {
  /** xorshift128 seed used when creating the world */
  seed: number
  /** Ordered list of (tick, command) pairs */
  entries: ReplayEntry[]
}

/**
 * Create an empty replay for a given seed.
 * Tech.md §10.2.1
 */
export function createReplay(seed: number): Replay {
  return { seed, entries: [] }
}

/**
 * Record a command into the replay log.
 * Tech.md §10.2.1
 */
export function recordCommand(
  replay: Replay,
  tick: number,
  command: Record<string, unknown>,
): void {
  replay.entries.push({ tick, command })
}

/**
 * Hash the world state for regression comparison.
 * Uses FNV-1a over key numeric fields.
 * Returns a 32-bit unsigned integer.
 * Tech.md §10.2.2–10.2.3
 */
export function hashWorldState(world: World): number {
  // FNV-1a 32-bit offset basis and prime
  let h = 2166136261
  const prime = 16777619

  // Scalar game state
  h = fnv32(h, prime, Math.floor(world.eddies * 1000))
  h = fnv32(h, prime, Math.floor(world.components * 1000))
  h = fnv32(h, prime, Math.floor(world.healthCurrent[world.coreEid] * 100))
  h = fnv32(h, prime, world.currentWave)
  h = fnv32(h, prime, world.currentPhase)
  h = fnv32(h, prime, world.tickCount)
  h = fnv32(h, prime, world.nextSpawnTick)
  h = fnv32(h, prime, world.waveSpawnIndex)
  // Include break countdown — differs when START_WAVE was issued at different ticks
  h = fnv32(h, prime, isFinite(world.breakTicksRemaining) ? Math.floor(world.breakTicksRemaining) : 0xffffffff)

  // Structural state — bitmasks of all live entities
  for (let i = 1; i < 4096; i++) {
    if (world.bitmask[i] !== 0) {
      h = fnv32(h, prime, i)
      h = fnv32(h, prime, world.bitmask[i])
    }
  }

  // Enemy tile positions (§2.10.2 — enemies occupy discrete tiles)
  for (let i = 1; i < 4096; i++) {
    if (world.bitmask[i] & ENEMY) {
      h = fnv32(h, prime, world.tilePosX[i])
      h = fnv32(h, prime, world.tilePosY[i])
      h = fnv32(h, prime, Math.floor(world.tileProgress[i] * 1000))
    }
  }

  // RNG state — ensures differently-seeded worlds hash differently even when
  // structural game state is otherwise identical (e.g. before any spawning)
  h = fnv32(h, prime, world.rngState[0])
  h = fnv32(h, prime, world.rngState[1])
  h = fnv32(h, prime, world.rngState[2])
  h = fnv32(h, prime, world.rngState[3])

  return h >>> 0
}

/**
 * FNV-1a round: hash all 4 bytes of a 32-bit integer value.
 */
function fnv32(h: number, prime: number, val: number): number {
  const v = val >>> 0
  h = Math.imul(h ^ (v & 0xff), prime) >>> 0
  h = Math.imul(h ^ ((v >>> 8) & 0xff), prime) >>> 0
  h = Math.imul(h ^ ((v >>> 16) & 0xff), prime) >>> 0
  h = Math.imul(h ^ ((v >>> 24) & 0xff), prime) >>> 0
  return h
}

/**
 * Replay a recorded sequence against a fresh simulation.
 * Returns the world state hash after `tickCount` ticks.
 * Tech.md §10.2.2
 *
 * @param replay    The recorded command sequence and seed
 * @param tickCount Number of ticks to advance the fresh simulation
 * @param tick      The simulation tick function to drive (from createSimulation)
 */
export function runReplay(
  replay: Replay,
  tickCount: number,
  tick: (world: World) => void,
): number {
  const world = createWorld(replay.seed)

  for (let t = 0; t < tickCount; t++) {
    for (const entry of replay.entries) {
      if (entry.tick === t) {
        world.commandQueue.push(
          entry.command as Parameters<typeof world.commandQueue.push>[0],
        )
      }
    }
    tick(world)
  }

  return hashWorldState(world)
}
