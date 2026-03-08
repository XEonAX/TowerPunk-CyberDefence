/**
 * Game Loop — Tech.md §3.1
 * requestAnimationFrame-based fixed-timestep game loop.
 */

import { TICK_DURATION, MAX_TICKS_PER_FRAME } from './constants'
import type { Simulation } from './simulation'

export interface Renderer {
  draw(alpha: number): void
}

let rafHandle: number | null = null

export function startGameLoop(
  simulation: Simulation,
  renderer: Renderer,
  getSpeed: () => number = () => 1,
): void {
  let lastTime = performance.now()
  let accumulator = 0

  function loop(now: number): void {
    const speed = getSpeed()
    const maxTicks = MAX_TICKS_PER_FRAME * speed
    const delta = Math.min(now - lastTime, TICK_DURATION * maxTicks)
    lastTime = now
    accumulator += delta * speed

    let ticks = 0
    while (accumulator >= TICK_DURATION && ticks < maxTicks) {
      // Performance instrumentation (dev only) — budget: 4ms per tick (Tech.md §14)
      if (import.meta.env.DEV) {
        const t0 = performance.now()
        simulation.tick()
        const elapsed = performance.now() - t0
        if (elapsed > TICK_DURATION) {
          console.warn(`[TowerPunk] Slow tick: ${elapsed.toFixed(2)}ms (budget: ${TICK_DURATION}ms)`)
        }
      } else {
        simulation.tick()
      }
      accumulator -= TICK_DURATION
      ticks++
    }
    // Cap leftover accumulator to avoid spiral of death when resuming after pause
    if (accumulator > TICK_DURATION * maxTicks) accumulator = 0

    const alpha = accumulator / TICK_DURATION
    renderer.draw(alpha)

    rafHandle = requestAnimationFrame(loop)
  }

  rafHandle = requestAnimationFrame(loop)
}

export function stopGameLoop(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
}
