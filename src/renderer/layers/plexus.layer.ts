/**
 * Plexus Layer — Atmospheric red particle-network background behind the game grid.
 *
 * Lives in the camera container so it pans and zooms with the world.
 * Particle bounds cover the full max-pannable world area — computed from the
 * viewport size at MIN_ZOOM — so the effect fills the screen regardless of
 * where the camera is. Reinitialises automatically on renderer resize.
 *
 * Color mirrors the Blackwall red (0xcc0022) from grid.layer.ts.
 * Uses a local xorshift128 RNG — never touches the simulation RNG / World.
 */

import { Graphics, Container } from 'pixi.js'
import type { Application } from 'pixi.js'
import { TILE_SIZE, MIN_ZOOM } from '../camera'
import { GRID_SIZE } from '@game/constants'

const GRID_PX = GRID_SIZE * TILE_SIZE   // 816 px

const PARTICLE_SPEED = 0.4   // px / frame
const DOT_RADIUS = 4   // px
const MAX_LINK_DIST = 512    // px
const LINE_ALPHA_SCALE = 0.42
const LINE_WIDTH = 2     // px
const RED = 0xcc0022
/** Visual speed is capped at this multiplier so 64× doesn't become a blur. */
const MAX_VISUAL_SPEED = 64

/** 1 particle per this many sq world-px — balances density vs. performance. */
const DENSITY_SQ_PX = 60_000
const MIN_PARTICLES = 80
const MAX_PARTICLES = 320

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
interface Bounds { xMin: number; xMax: number; yMin: number; yMax: number }

/**
 * Compute world-space particle bounds that cover every pixel that could ever
 * be visible when the camera is panned to its extremes at MIN_ZOOM. But only till half the viewport size beyond the grid edges, since particles outside that would never be visible.
 * (screen_size / MIN_ZOOM * 0.5) = max world units the viewport can show from one edge.
 */
function computeBounds(app: Application): Bounds {
    const hOverflow = Math.ceil(app.screen.width / MIN_ZOOM * 0.5)
    const vOverflow = Math.ceil(app.screen.height / MIN_ZOOM * 0.5)
    return {
        xMin: -hOverflow,
        xMax: GRID_PX + hOverflow,
        yMin: -vOverflow,
        yMax: GRID_PX + vOverflow,
    }
}

function particleCount(b: Bounds): number {
    const area = (b.xMax - b.xMin) * (b.yMax - b.yMin)
    return Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, Math.round(area / DENSITY_SQ_PX)))
}

function initParticles(b: Bounds, count: number): Particle[] {
    const rangeX = b.xMax - b.xMin
    const rangeY = b.yMax - b.yMin
    return Array.from({ length: count }, () => {
        const angle = rngFloat() * Math.PI * 2
        const speed = (0.5 + rngFloat() * 0.5) * PARTICLE_SPEED
        return {
            x: b.xMin + rngFloat() * rangeX,
            y: b.yMin + rngFloat() * rangeY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
        }
    })
}

/**
 * Initialise the red plexus background.
 * Registers a ticker callback on `app` — no further calls needed from outside.
 * @param getSpeed — returns the current game speed multiplier (e.g. `() => uiStore.gameSpeed`)
 */
export function createPlexusLayer(container: Container, app: Application, getSpeed: () => number = () => 1): void {
    const gfx = new Graphics()
    gfx.eventMode = 'none'
    container.addChild(gfx)

    let bounds = computeBounds(app)
    let parts = initParticles(bounds, particleCount(bounds))

    app.renderer.on('resize', () => {
        bounds = computeBounds(app)
        parts = initParticles(bounds, particleCount(bounds))
    })

    const maxDistSq = MAX_LINK_DIST * MAX_LINK_DIST

    app.ticker.add(() => {
        const { xMin, xMax, yMin, yMax } = bounds
        const speedMult = Math.min(Math.max(getSpeed(), 0), MAX_VISUAL_SPEED)

        // ── Move & bounce ─────────────────────────────────────────────────────
        for (const p of parts) {
            p.x += p.vx * speedMult
            p.y += p.vy * speedMult
            if (p.x < xMin) { p.x = xMin; p.vx = Math.abs(p.vx) }
            if (p.x > xMax) { p.x = xMax; p.vx = -Math.abs(p.vx) }
            if (p.y < yMin) { p.y = yMin; p.vy = Math.abs(p.vy) }
            if (p.y > yMax) { p.y = yMax; p.vy = -Math.abs(p.vy) }
        }

        gfx.clear()

        // ── Lines ─────────────────────────────────────────────────────────────
        for (let i = 0; i < parts.length; i++) {
            for (let j = i + 1; j < parts.length; j++) {
                const dx = parts[i].x - parts[j].x
                const dy = parts[i].y - parts[j].y
                const distSq = dx * dx + dy * dy
                if (distSq < maxDistSq) {
                    const alpha = (1 - distSq / maxDistSq) * LINE_ALPHA_SCALE
                    gfx.moveTo(parts[i].x, parts[i].y)
                    gfx.lineTo(parts[j].x, parts[j].y)
                    gfx.stroke({ color: RED, alpha, width: LINE_WIDTH })
                }
            }
        }

        // ── Dots ──────────────────────────────────────────────────────────────
        for (const p of parts) {
            gfx.circle(p.x, p.y, DOT_RADIUS)
            gfx.fill({ color: RED, alpha: 0.65 })
        }
    })
}
