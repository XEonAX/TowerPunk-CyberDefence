/**
 * Enemy Layer — Tech.md §6.2, Rulebook §2.10.4–2.10.8
 *
 * Renders enemy entities using PNG sprite assets with per-type visual behaviour:
 *   DATA_LEECH / CODE_RUNNER  — horizontal flip only; retains facing when vertical.
 *   FIREWALL_BREACHER         — rotates to match travel direction.
 *   GLITCH                    — random 90° rotation + axis flips every 4–12 frames.
 *   ORCHESTRATOR / VDB_NETRUNNER — continuous clockwise spin.
 *   SABOTEUR / AI_OVERLORD    — translate only; AI_OVERLORD rendered larger.
 *
 * Uses a Sprite object pool — zero allocations during active gameplay.
 */

import { Sprite, Graphics, Container } from 'pixi.js'
import type { World } from '@game/ecs/world'
import * as C from '@game/ecs/component'
import { computeEnemyMotion } from '../enemyMotion'
import { getEnemyTexture } from '../enemyTextures'
import { TILE_SIZE } from '../camera'

const MAX_ENTITIES = 4096

// ---------------------------------------------------------------------------
// Sprite pool
// ---------------------------------------------------------------------------

const pool: Sprite[] = []
const active = new Map<number, Sprite>() // eid → Sprite

function acquire(enemyType: C.EnemyType): Sprite {
  let sprite = pool.pop()
  if (!sprite) {
    sprite = new Sprite()
    sprite.anchor.set(0.5)
  }
  sprite.texture = getEnemyTexture(enemyType)
  sprite.visible = true
  sprite.tint = 0xffffff
  sprite.rotation = 0
  sprite.scale.set(1, 1)
  return sprite
}

function release(sprite: Sprite): void {
  sprite.visible = false
  sprite.tint = 0xffffff
  sprite.rotation = 0
  sprite.scale.set(1, 1)
  pool.push(sprite)
}

// ---------------------------------------------------------------------------
// Per-entity render state
// ---------------------------------------------------------------------------

/** DATA_LEECH & CODE_RUNNER — last horizontal flip multiplier (1 = right, -1 = left). */
const lastHFlip = new Map<number, number>()

/** GLITCH — glitch animation state. */
interface GlitchState { rot: number; sx: number; sy: number; countdown: number; tintFrames: number }
const glitchState = new Map<number, GlitchState>()

/** ORCHESTRATOR & VDB_NETRUNNER — accumulated spin angle in radians. */
const spinAngle = new Map<number, number>()

// ---------------------------------------------------------------------------
// HP bar — single shared Graphics drawn on top of all enemy sprites
// ---------------------------------------------------------------------------

let hpBarGfx: Graphics | null = null

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------

/**
 * Update enemy layer each render frame.
 * @param container  The PixiJS Container for this layer.
 * @param world      Current ECS world (read-only in renderer).
 * @param _alpha     Interpolation factor — not currently used (progress is simulation-side).
 */
export function updateEnemyLayer(container: Container, world: World, _alpha: number): void {
  // Release sprites for entities that are no longer active enemies
  const toRelease: number[] = []
  for (const [eid, sprite] of active) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY) || (mask & C.PENDING_REMOVAL)) {
      container.removeChild(sprite)
      release(sprite)
      toRelease.push(eid)
      lastHFlip.delete(eid)
      glitchState.delete(eid)
      spinAngle.delete(eid)
    }
  }
  for (const eid of toRelease) active.delete(eid)

  // Render each active enemy
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY)) continue
    if (mask & C.PENDING_REMOVAL) continue

    const enemyType = world.enemyType[eid] as C.EnemyType

    let sprite = active.get(eid)
    if (!sprite) {
      sprite = acquire(enemyType)
      container.addChild(sprite)
      active.set(eid, sprite)
    } else {
      // Reassign texture in case pool reuse gave us a sprite from a different type
      sprite.texture = getEnemyTexture(enemyType)
    }

    // Compute visual position via motion interpolation (Rulebook §2.10.4–2.10.8)
    const motion = computeEnemyMotion(
      world.pathFromX[eid],
      world.pathFromY[eid],
      world.pathToX[eid],
      world.pathToY[eid],
      world.tilePosX[eid],
      world.tilePosY[eid],
      world.tileProgress[eid],
      world.pathMoveState[eid],
      world.pathDir[eid],
      world.pathPrevDir[eid],
    )

    const isBoss = enemyType === C.EnemyType.AI_OVERLORD
    const desiredSize = isBoss ? TILE_SIZE * 1.2 : TILE_SIZE * 0.7
    const tex = sprite.texture
    const baseScaleX = desiredSize / tex.width
    const baseScaleY = desiredSize / tex.height

    // Apply per-type visual behaviour
    switch (enemyType) {
      case C.EnemyType.DATA_LEECH:
      case C.EnemyType.CODE_RUNNER: {
        // Track last horizontal facing; retain it when travelling vertically.
        // Art faces right — negate scale.x to mirror left.
        const angle = motion.angleDeg
        if (angle > 350 || angle < 10) {
          lastHFlip.set(eid, 1)   // travelling right — no flip
        } else if (angle > 170 && angle < 190) {
          lastHFlip.set(eid, -1)  // travelling left — mirror horizontally
        }
        const flip = lastHFlip.get(eid) ?? 1
        sprite.scale.x = baseScaleX * flip
        sprite.scale.y = baseScaleY
        sprite.rotation = 0
        break
      }

      case C.EnemyType.FIREWALL_BREACHER: {
        // Art faces right; angleDeg 0=right maps directly to PixiJS rotation 0.
        sprite.scale.set(baseScaleX, baseScaleY)
        sprite.rotation = motion.angleDeg * Math.PI / 180
        break
      }

      case C.EnemyType.GLITCH: {
        // Direction-less — random 90° orientation change every 4–12 frames.
        // Math.random() is fine here — renderer-only, no determinism requirement.
        let gs = glitchState.get(eid)
        if (!gs) {
          gs = { rot: 0, sx: 1, sy: 1, countdown: 1, tintFrames: 0 }
          glitchState.set(eid, gs)
        }
        gs.countdown--
        if (gs.countdown <= 0) {
          gs.rot = Math.floor(Math.random() * 4) * (Math.PI / 2)
          gs.sx  = Math.random() < 0.5 ? -1 : 1
          gs.sy  = Math.random() < 0.5 ? -1 : 1
          gs.countdown  = 4 + Math.floor(Math.random() * 9) // 4–12 frames
          gs.tintFrames = 2
          sprite.tint = Math.random() < 0.5 ? 0x00ffff : 0xff00ff
        } else if (gs.tintFrames > 0) {
          gs.tintFrames--
          if (gs.tintFrames === 0) sprite.tint = 0xffffff
        }
        sprite.rotation  = gs.rot
        sprite.scale.x   = baseScaleX * gs.sx
        sprite.scale.y   = baseScaleY * gs.sy
        break
      }

      case C.EnemyType.ORCHESTRATOR:
      case C.EnemyType.VDB_NETRUNNER: {
        // Continuous clockwise spin — ignore travel direction entirely.
        const speed   = enemyType === C.EnemyType.ORCHESTRATOR ? 0.03 : 0.04
        const current = (spinAngle.get(eid) ?? 0) + speed
        spinAngle.set(eid, current)
        sprite.rotation = current
        sprite.scale.set(baseScaleX, baseScaleY)
        break
      }

      default: {
        // SABOTEUR, AI_OVERLORD — translate only; no rotation, no flip.
        sprite.rotation = 0
        sprite.scale.set(baseScaleX, baseScaleY)
        break
      }
    }

    sprite.x = motion.renderX
    sprite.y = motion.renderY
  }

  // HP bars — drawn as a single shared Graphics pass on top of all sprites
  if (!hpBarGfx) {
    hpBarGfx = new Graphics()
    container.addChild(hpBarGfx)
  } else if (hpBarGfx.parent !== container) {
    container.addChild(hpBarGfx) // ensure it stays on top if container was rebuilt
  }

  hpBarGfx.clear()
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY)) continue
    if (mask & C.PENDING_REMOVAL) continue

    const maxHp = world.healthMax[eid]
    if (maxHp <= 0) continue

    const sprite = active.get(eid)
    if (!sprite) continue

    const hpFrac    = Math.max(0, world.healthCurrent[eid] / maxHp)
    const isBoss    = (world.enemyType[eid] as C.EnemyType) === C.EnemyType.AI_OVERLORD
    const barWidth  = isBoss ? TILE_SIZE * 1.2 : TILE_SIZE * 0.7
    const barX      = sprite.x - barWidth / 2
    const barY      = sprite.y - barWidth / 2 - 4

    // Background track
    hpBarGfx.setFillStyle({ color: 0x222222, alpha: 0.8 })
    hpBarGfx.rect(barX, barY, barWidth, 2)
    hpBarGfx.fill()

    // Health fill
    hpBarGfx.setFillStyle({ color: 0x00ff44, alpha: 1 })
    hpBarGfx.rect(barX, barY, barWidth * hpFrac, 2)
    hpBarGfx.fill()
  }
}

/** @internal — exported for testing only */
export function _clearEnemyPool(): void {
  active.clear()
  pool.length = 0
  lastHFlip.clear()
  glitchState.clear()
  spinAngle.clear()
}
