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

export function startGameLoop(simulation: Simulation, renderer: Renderer): void {
  let lastTime = performance.now()
  let accumulator = 0

  function loop(now: number): void {
    const delta = Math.min(now - lastTime, TICK_DURATION * MAX_TICKS_PER_FRAME)
    lastTime = now
    accumulator += delta

    let ticks = 0
    while (accumulator >= TICK_DURATION && ticks < MAX_TICKS_PER_FRAME) {
      simulation.tick()
      accumulator -= TICK_DURATION
      ticks++
    }

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
