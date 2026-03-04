/**
 * Seeded PRNG — xorshift128
 * Tech.md §9.4.5, Rulebook §1.9
 *
 * Deterministic pseudo-random number generator.
 * NEVER use Math.random() in simulation code.
 */

import type { World } from './ecs/world'

/**
 * Advance xorshift128 state, return next uint32.
 * Stores state directly in world.rngState to avoid allocations.
 */
export function rngNext(world: World): number {
  const s = world.rngState
  let t = s[3]
  t ^= t << 11
  t ^= t >>> 8
  s[3] = s[2]
  s[2] = s[1]
  s[1] = s[0]
  t ^= s[0]
  t ^= s[0] >>> 19
  s[0] = t
  return t >>> 0
}

/** Returns a float in [0, 1). */
export function rngFloat(world: World): number {
  return rngNext(world) / 0x100000000
}

/** Returns an integer in [min, max). */
export function rngRange(world: World, min: number, max: number): number {
  return min + (rngNext(world) % (max - min))
}
