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
const FLOAT_TICKS = 60  // damage number lives 60 ticks (~1 sec)
const FLOAT_RISE_PX = TILE_SIZE * 2  // how far numbers float upward

/** Last known HP per enemy entity — used to detect damage events */
const lastEnemyHp = new Float32Array(MAX_ENTITIES)

/** Object pool for Text objects */
const textPool: Text[] = []
/** Active damage numbers */
const activeDamageNumbers: DamageNumber[] = []

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
  // --- 1. Detect damage events (HP decrease since last frame) ---
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY)) continue
    if (mask & C.PENDING_REMOVAL) {
      lastEnemyHp[eid] = 0  // reset on death so next spawn doesn't false-trigger
      continue
    }
    if (mask & C.SPAWN_IMMUNITY) continue  // skip immune enemies

    const currentHp = world.healthCurrent[eid]
    const prevHp    = lastEnemyHp[eid]

    if (prevHp > 0 && currentHp < prevHp) {
      const damage = prevHp - currentHp
      // Spawn damage number at enemy's tile center (in world/camera space)
      const pixelX = world.tilePosX[eid] * TILE_SIZE + TILE_SIZE * 0.5
      const pixelY = world.tilePosY[eid] * TILE_SIZE

      const t = acquireText()
      t.text = `-${Math.round(damage)}`
      // Color based on damage magnitude: small=yellow, large=red
      const col = damage >= 20 ? 0xff2244 : (damage >= 5 ? 0xff8833 : 0xffdd44)
      t.style.fill = col
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

    lastEnemyHp[eid] = currentHp
  }

  // --- 2. Advance & render active damage numbers ---
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
}

