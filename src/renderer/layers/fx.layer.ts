/**
 * FX Layer — Tech.md §6.2, Rulebook §7.0.8
 *
 * Renders floating damage numbers and simple hit flashes.
 * Damage numbers are driven by HP diff tracking each frame (render-only).
 * Zero mutation of ECS world state.
 */

import { Text, Container } from 'pixi.js'
import type { World } from '@game/ecs/world'
import * as C from '@game/ecs/component'
import { TILE_SIZE } from '../camera'
import { TICK_RATE } from '@game/constants'
import { Graphics } from 'pixi.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DamageNumber {
  text: Text
  /** World-space position when spawned */
  spawnX: number
  spawnY: number
  ticksLeft: number
  maxTicks: number
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const MAX_ENTITIES = 4096
const FLOAT_TICKS = TICK_RATE  // damage number lives 60 ticks (~1 sec)
const FLOAT_RISE_PX = TILE_SIZE * 2  // how far numbers float upward

/** Last known HP per enemy entity — used to detect damage events */
const lastEnemyHp = new Float32Array(MAX_ENTITIES)
/** Accumulated damage since last flush, per entity */
const damageAccum = new Float32Array(MAX_ENTITIES)
/** Frames remaining until flush (resets to ACCUM_WINDOW on each new hit) */
const damageFlushTimer = new Int16Array(MAX_ENTITIES)
/** How many frames between periodic damage flushes */
const ACCUM_WINDOW = 45

/** Last known total value (eddies + components) per pickup entity */
const lastPickupValue = new Float32Array(MAX_ENTITIES)
/** Accumulated decay since last flush, per pickup entity */
const decayAccum = new Float32Array(MAX_ENTITIES)
/** Frames remaining until decay flush */
const decayFlushTimer = new Int16Array(MAX_ENTITIES)

/** Object pool for Text objects */
const textPool: Text[] = []
/** Active damage numbers */
const activeDamageNumbers: DamageNumber[] = []

// ---------------------------------------------------------------------------
// Particle burst — spawned on enemy death
// ---------------------------------------------------------------------------

interface Particle {
  g: Graphics
  x: number
  y: number
  vx: number
  vy: number
  frame: number
  maxFrames: number
}

/** Colour per enemy type for the death particle burst. */
const ENEMY_DEATH_COLORS: Record<number, number> = {
  [C.EnemyType.DATA_LEECH]:        0x00ff88,
  [C.EnemyType.CODE_RUNNER]:       0xffdd44,
  [C.EnemyType.FIREWALL_BREACHER]: 0xff8800,
  [C.EnemyType.GLITCH]:            0xff00ff,
  [C.EnemyType.ORCHESTRATOR]:      0xff0044,
  [C.EnemyType.VDB_NETRUNNER]:     0x00ccff,
  [C.EnemyType.SABOTEUR]:          0xaaff00,
  [C.EnemyType.AI_OVERLORD]:       0xff4400,
}

const particlePool: Graphics[] = []
const activeParticles: Particle[] = []

function spawnParticleBurst(container: Container, x: number, y: number, color: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const speed = 0.7 + Math.random() * 1.6
    const g = particlePool.pop() ?? new Graphics()
    g.clear()
    g.setFillStyle({ color, alpha: 0.9 })
    g.circle(0, 0, 1.4 + Math.random() * 0.8)
    g.fill()
    g.visible = true
    g.alpha = 1
    g.x = x
    g.y = y
    container.addChild(g)
    activeParticles.push({
      g, x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      frame: 0,
      maxFrames: 16 + Math.floor(Math.random() * 10),
    })
  }
}

// ---------------------------------------------------------------------------
// Pool helpers
// ---------------------------------------------------------------------------

function acquireText(): Text {
  const t = textPool.pop()
  if (t) {
    t.visible = true
    return t
  }
  return new Text({
    text: '',
    style: {
      fontSize: 10,
      fontFamily: 'monospace',
      fill: 0xff4444,
      stroke: { color: 0x000000, width: 1 },
      fontWeight: 'bold',
    },
  })
}

function releaseText(dn: DamageNumber, container: Container): void {
  container.removeChild(dn.text)
  dn.text.visible = false
  textPool.push(dn.text)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function spawnDamageNumber(container: Container, eid: number, damage: number, world: World): void {
  const pixelX = world.tilePosX[eid] * TILE_SIZE + TILE_SIZE * 0.5
  const pixelY = world.tilePosY[eid] * TILE_SIZE
  const t = acquireText()
  t.text = `-${Math.round(damage)}`
  // Color based on aggregated damage: small=yellow, medium=orange, large=red
  t.style.fill = damage >= 20 ? 0xff2244 : (damage >= 5 ? 0xff8833 : 0xffdd44)
  t.x = pixelX
  t.y = pixelY
  container.addChild(t)
  activeDamageNumbers.push({
    text: t,
    spawnX: pixelX,
    spawnY: pixelY,
    ticksLeft: FLOAT_TICKS,
    maxTicks: FLOAT_TICKS,
  })
}

function spawnDecayNumber(container: Container, eid: number, amount: number, world: World): void {
  const pixelX = world.tilePosX[eid] * TILE_SIZE + TILE_SIZE * 0.5
  const pixelY = world.tilePosY[eid] * TILE_SIZE
  const t = acquireText()
  t.text = `-${Math.round(amount)}`
  t.style.fill = 0x996600  // muted gold — distinguishes decay from combat damage
  t.x = pixelX
  t.y = pixelY
  container.addChild(t)
  activeDamageNumbers.push({
    text: t,
    spawnX: pixelX,
    spawnY: pixelY,
    ticksLeft: FLOAT_TICKS,
    maxTicks: FLOAT_TICKS,
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update the FX layer each render frame.
 * Detects HP drops since last frame and spawns floating damage numbers.
 *
 * @param container  PixiJS Container for the FX layer.
 * @param world      Current ECS world (read-only).
 * @param alpha      Interpolation factor (unused — FX ticks run at display rate).
 */
export function updateFxLayer(container: Container, world: World, _alpha: number): void {
  // --- 1. Detect damage events and accumulate per entity ---
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY)) continue

    if (mask & C.PENDING_REMOVAL) {
      // Flush any accumulated damage immediately on death
      if (damageAccum[eid] > 0) {
        spawnDamageNumber(container, eid, damageAccum[eid], world)
        damageAccum[eid] = 0
      }
      // Particle burst
      const px = world.tilePosX[eid] * TILE_SIZE + TILE_SIZE * 0.5
      const py = world.tilePosY[eid] * TILE_SIZE + TILE_SIZE * 0.5
      const color = ENEMY_DEATH_COLORS[world.enemyType[eid]] ?? 0xff4444
      const isBoss = world.enemyType[eid] === C.EnemyType.AI_OVERLORD || world.enemyType[eid] === C.EnemyType.ORCHESTRATOR
      spawnParticleBurst(container, px, py, color, isBoss ? 14 : 8)
      damageFlushTimer[eid] = 0
      lastEnemyHp[eid] = 0
      continue
    }
    if (mask & C.SPAWN_IMMUNITY) {
      // Keep baseline current during immunity so expiry doesn't look like damage.
      lastEnemyHp[eid] = world.healthCurrent[eid]
      damageAccum[eid] = 0
      damageFlushTimer[eid] = 0
      continue
    }

    const currentHp = world.healthCurrent[eid]
    const prevHp    = lastEnemyHp[eid]

    if (prevHp === 0) {
      // First time seeing this slot — clear any stale state from a recycled entity ID.
      damageAccum[eid] = 0
      damageFlushTimer[eid] = 0
      lastEnemyHp[eid] = currentHp
      continue
    }

    if (currentHp < prevHp) {
      damageAccum[eid] += prevHp - currentHp
      // Start the flush timer on the first hit; do NOT reset it on subsequent hits
      // so continuous DPS still produces periodic numbers.
      if (damageFlushTimer[eid] === 0) damageFlushTimer[eid] = ACCUM_WINDOW
    }

    // Count down flush timer; spawn when it expires
    if (damageFlushTimer[eid] > 0) {
      damageFlushTimer[eid]--
      if (damageFlushTimer[eid] === 0 && damageAccum[eid] > 0) {
        spawnDamageNumber(container, eid, damageAccum[eid], world)
        damageAccum[eid] = 0
      }
    }

    lastEnemyHp[eid] = currentHp
  }

  // --- 2. Detect pickup decay events and accumulate per entity ---
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.PICKUP)) continue

    if (mask & C.PENDING_REMOVAL) {
      // Flush any remaining decay on collection/expiry
      if (decayAccum[eid] > 0) {
        spawnDecayNumber(container, eid, decayAccum[eid], world)
        decayAccum[eid] = 0
      }
      decayFlushTimer[eid] = 0
      lastPickupValue[eid] = 0
      continue
    }

    const currentValue = world.pickupEddies[eid] + world.pickupComponents[eid]
    const prevValue = lastPickupValue[eid]

    if (prevValue === 0) {
      // First time seeing this slot — clear any stale state from a recycled entity ID.
      decayAccum[eid] = 0
      decayFlushTimer[eid] = 0
      lastPickupValue[eid] = currentValue
      continue
    }

    if (currentValue < prevValue) {
      decayAccum[eid] += prevValue - currentValue
      if (decayFlushTimer[eid] === 0) decayFlushTimer[eid] = ACCUM_WINDOW
    }

    if (decayFlushTimer[eid] > 0) {
      decayFlushTimer[eid]--
      if (decayFlushTimer[eid] === 0 && decayAccum[eid] > 0) {
        spawnDecayNumber(container, eid, decayAccum[eid], world)
        decayAccum[eid] = 0
      }
    }

    lastPickupValue[eid] = currentValue
  }

  // --- 3. Advance & render active damage numbers ---
  for (let i = activeDamageNumbers.length - 1; i >= 0; i--) {
    const dn = activeDamageNumbers[i]

    // Progress 0 → 1 over lifetime (using display alpha for smooth motion)
    const progress = 1 - dn.ticksLeft / dn.maxTicks

    // Float upward
    dn.text.x = dn.spawnX + Math.sin(progress * Math.PI) * 4  // slight drift
    dn.text.y = dn.spawnY - progress * FLOAT_RISE_PX

    // Fade out in last 40%
    dn.text.alpha = progress < 0.6 ? 1.0 : 1.0 - (progress - 0.6) / 0.4

    // Advance timer: ~1 tick per draw call (60fps ≈ 60 ticks, matching FLOAT_TICKS)
    dn.ticksLeft--

    if (dn.ticksLeft <= 0) {
      releaseText(dn, container)
      activeDamageNumbers.splice(i, 1)
    }
  }

  // --- 4. Advance & render particles ---
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i]
    p.frame++
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.06   // slight downward gravity
    p.vx *= 0.90   // drag
    p.vy *= 0.90
    p.g.x = p.x
    p.g.y = p.y
    p.g.alpha = (1 - p.frame / p.maxFrames) * 0.9
    if (p.frame >= p.maxFrames) {
      container.removeChild(p.g)
      p.g.visible = false
      particlePool.push(p.g)
      activeParticles.splice(i, 1)
    }
  }
}

/**
 * Reset FX state — call when restarting the game.
 */
export function resetFxLayer(container: Container): void {
  for (const dn of activeDamageNumbers) {
    releaseText(dn, container)
  }
  activeDamageNumbers.length = 0
  lastEnemyHp.fill(0)
  damageAccum.fill(0)
  damageFlushTimer.fill(0)
  lastPickupValue.fill(0)
  decayAccum.fill(0)
  decayFlushTimer.fill(0)
  for (const p of activeParticles) {
    container.removeChild(p.g)
    p.g.visible = false
    particlePool.push(p.g)
  }
  activeParticles.length = 0
}

