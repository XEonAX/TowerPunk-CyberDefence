/**
 * Plexus Layer — Atmospheric red particle-network background behind the game grid.
 *
 * Non-interactive. Lives in the camera container below the grid layer so it pans
 * and zooms with the world. Particles are bounded to the 51×51 grid area with a
 * 32px overflow on all sides.
 *
 * Color mirrors the Blackwall red (0xcc0022) from grid.layer.ts.
 * Uses a local xorshift128 RNG — never touches the simulation RNG / World.
 */

import { Graphics, Container } from 'pixi.js'
import type { Application } from 'pixi.js'
import { TILE_SIZE } from '../camera'

const GRID_SIZE = 51
/** Particles roam this many px beyond the grid edge on every side. */
const OVERFLOW     = 32
const GRID_PX      = GRID_SIZE * TILE_SIZE   // 816 px

const BOUNDS_MIN   = -OVERFLOW               // -32
const BOUNDS_MAX   = GRID_PX + OVERFLOW      //  848

const PARTICLE_COUNT   = 110
const MAX_LINK_DIST    = 96    // px — max distance to draw a connecting line
const PARTICLE_SPEED   = 0.4  // px / frame (base drift)
const DOT_RADIUS       = 1.5  // px
const LINE_ALPHA_SCALE = 0.42 // peak line opacity
const RED              = 0xcc0022  // Blackwall red

// ── Local xorshift128 — renderer visual only, independent of simulation ────
const _rng = new Uint32Array([0x9E3779B9, 0x243F6A88, 0xB7E15162, 0x71374491])
function rngNext(): number {
  let t = _rng[3]
  t ^= t << 11; t ^= t >>> 8
  _rng[3] = _rng[2]; _rng[2] = _rng[1]; _rng[1] = _rng[0]
  t ^= _rng[0]; t ^= _rng[0] >>> 19
  _rng[0] = t
  return t >>> 0
}
function rngFloat(): number { return rngNext() / 0x100000000 }

interface Particle { x: number; y: number; vx: number; vy: number }

/**
 * Initialise the red plexus background.
 * Registers a ticker callback on `app` — no further calls needed from outside.
 */
export function createPlexusLayer(container: Container, app: Application): void {
  const gfx = new Graphics()
  gfx.eventMode = 'none'
  container.addChild(gfx)

  const range = BOUNDS_MAX - BOUNDS_MIN

  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = rngFloat() * Math.PI * 2
    const speed = (0.5 + rngFloat() * 0.5) * PARTICLE_SPEED
    return {
      x:  BOUNDS_MIN + rngFloat() * range,
      y:  BOUNDS_MIN + rngFloat() * range,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    }
  })

  const maxDistSq = MAX_LINK_DIST * MAX_LINK_DIST

  app.ticker.add(() => {
    // ── Move & bounce ─────────────────────────────────────────────────────
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < BOUNDS_MIN) { p.x = BOUNDS_MIN; p.vx =  Math.abs(p.vx) }
      if (p.x > BOUNDS_MAX) { p.x = BOUNDS_MAX; p.vx = -Math.abs(p.vx) }
      if (p.y < BOUNDS_MIN) { p.y = BOUNDS_MIN; p.vy =  Math.abs(p.vy) }
      if (p.y > BOUNDS_MAX) { p.y = BOUNDS_MAX; p.vy = -Math.abs(p.vy) }
    }

    gfx.clear()

    // ── Lines ─────────────────────────────────────────────────────────────
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx     = particles[i].x - particles[j].x
        const dy     = particles[i].y - particles[j].y
        const distSq = dx * dx + dy * dy
        if (distSq < maxDistSq) {
          const alpha = (1 - distSq / maxDistSq) * LINE_ALPHA_SCALE
          gfx.moveTo(particles[i].x, particles[i].y)
          gfx.lineTo(particles[j].x, particles[j].y)
          gfx.stroke({ color: RED, alpha, width: 0.8 })
        }
      }
    }

    // ── Dots ──────────────────────────────────────────────────────────────
    for (const p of particles) {
      gfx.circle(p.x, p.y, DOT_RADIUS)
      gfx.fill({ color: RED, alpha: 0.65 })
    }
  })
}
