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
import { TILE_SIZE, shakeCamera } from '../camera'
import { GlitchFilter } from '../filters/GlitchFilter'

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
  sprite.alpha = 1
  sprite.filters = null
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
// Hit flash & status overlay state
// ---------------------------------------------------------------------------

/** Last HP value per entity used to detect damage for the hit-flash effect. */
const hitFlashLastHp = new Float32Array(MAX_ENTITIES)
/** Countdown frames remaining for the white hit-flash overlay (max 3). */
const hitFlashFrames = new Int8Array(MAX_ENTITIES)
/** Countdown frames remaining for the yellow stun-application flash (max 4). */
const stunFlashFrames = new Int8Array(MAX_ENTITIES)
/** Whether the entity was stunned last frame — detects new stun application. */
const lastWasStunned = new Uint8Array(MAX_ENTITIES)


// ---------------------------------------------------------------------------
// Death dissolve animation
// ---------------------------------------------------------------------------

interface DeathAnim {
  sprite: Sprite
  x: number
  y: number
  baseScaleX: number
  baseScaleY: number
  frame: number
  maxFrames: number
  driftX: number
  driftY: number
}

/** Active death dissolve animations (sprites no longer in the `active` map). */
const activeDeathAnims: DeathAnim[] = []

// ---------------------------------------------------------------------------
// GlitchFilter pool — applied to GLITCH-type enemy sprites
// ---------------------------------------------------------------------------

const glitchFilterPool: GlitchFilter[] = []
const activeGlitchFilters = new Map<number, GlitchFilter>()

function acquireGlitchFilter(): GlitchFilter {
  return glitchFilterPool.pop() ?? new GlitchFilter()
}

function releaseGlitchFilter(f: GlitchFilter): void {
  f.intensity = 0
  glitchFilterPool.push(f)
}

// ---------------------------------------------------------------------------
// Tick-lagged interpolation state
// Pre-allocated arrays storing the rendered position at the END of the
// previous simulation tick. The renderer lerps from these towards the current
// tick's computed position using alpha ∈ [0, 1).
// ---------------------------------------------------------------------------

const prevRenderX = new Float32Array(MAX_ENTITIES)
const prevRenderY = new Float32Array(MAX_ENTITIES)

/**
 * Snapshot the current computed render position for every live enemy.
 * Must be called once before each simulation tick (via Renderer.beforeTick).
 * At draw time the renderer interpolates: pos = prev + (curr − prev) × alpha.
 */
export function snapshotEnemies(world: World): void {
  for (const [eid] of active) {
    const motion = computeEnemyMotion(
      world.pathFromX[eid], world.pathFromY[eid],
      world.pathToX[eid],   world.pathToY[eid],
      world.tilePosX[eid],  world.tilePosY[eid],
      world.tileProgress[eid],
      world.pathMoveState[eid],
      world.pathDir[eid],
      world.pathPrevDir[eid],
    )
    prevRenderX[eid] = motion.renderX
    prevRenderY[eid] = motion.renderY
  }
}

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
 * @param alpha      Sub-tick interpolation factor [0, 1) — fraction of a tick elapsed since last simulation step.
 */
export function updateEnemyLayer(container: Container, world: World, alpha: number): void {
  // Release sprites for entities that are no longer active enemies
  const toRelease: number[] = []
  for (const [eid, sprite] of active) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY) || (mask & C.PENDING_REMOVAL)) {
      // Release GlitchFilter back to pool
      const gf = activeGlitchFilters.get(eid)
      if (gf) {
        releaseGlitchFilter(gf)
        activeGlitchFilters.delete(eid)
      }

      if (mask & C.PENDING_REMOVAL) {
        // Death dissolve — keep sprite alive briefly; transition it to the death anim pool.
        // Clear filter before death anim (avoid rendering it during dissolve).
        sprite.filters = null
        activeDeathAnims.push({
          sprite,
          x: sprite.x,
          y: sprite.y,
          baseScaleX: Math.abs(sprite.scale.x),
          baseScaleY: Math.abs(sprite.scale.y),
          frame: 0,
          maxFrames: 10,
          driftX: (Math.random() - 0.5) * 4,
          driftY: (Math.random() - 0.5) * 4,
        })
        // Screen shake for boss deaths
        const etype = world.enemyType[eid] as C.EnemyType
        if (etype === C.EnemyType.AI_OVERLORD) shakeCamera(7, 22)
        else if (etype === C.EnemyType.ORCHESTRATOR) shakeCamera(4, 14)
      } else {
        container.removeChild(sprite)
        release(sprite)
      }

      toRelease.push(eid)
      lastHFlip.delete(eid)
      glitchState.delete(eid)
      spinAngle.delete(eid)
      hitFlashFrames[eid] = 0
      stunFlashFrames[eid] = 0
      lastWasStunned[eid] = 0
      hitFlashLastHp[eid] = 0
    }
  }
  for (const eid of toRelease) active.delete(eid)

  // Render each active enemy
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY)) continue
    if (mask & C.PENDING_REMOVAL) continue

    const enemyType = world.enemyType[eid] as C.EnemyType

    // Compute current tick's position (no extrapolation — interpolation handles smoothing)
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

    let sprite = active.get(eid)
    if (!sprite) {
      sprite = acquire(enemyType)
      container.addChild(sprite)
      active.set(eid, sprite)
      // Bootstrap prev to current so the first frame shows the correct spawn position.
      prevRenderX[eid] = motion.renderX
      prevRenderY[eid] = motion.renderY
    } else {
      // Reassign texture in case pool reuse gave us a sprite from a different type
      sprite.texture = getEnemyTexture(enemyType)
    }
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
        // GlitchFilter — assign lazily, update time + intensity each frame
        if (!activeGlitchFilters.has(eid)) {
          const gf = acquireGlitchFilter()
          sprite.filters = [gf]
          activeGlitchFilters.set(eid, gf)
        }
        const gf = activeGlitchFilters.get(eid)!
        gf.time = performance.now() / 1000
        gf.intensity = gs.tintFrames > 0 ? 0.65 : 0.18  // spike on flicker
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

    // Interpolate position between the previous tick's snapshot and this tick's result.
    sprite.x = prevRenderX[eid] + (motion.renderX - prevRenderX[eid]) * alpha
    sprite.y = prevRenderY[eid] + (motion.renderY - prevRenderY[eid]) * alpha

    // ---- Hit flash detection (HP drop → brief white overlay) ----
    if (!(mask & C.SPAWN_IMMUNITY)) {
      const curHp = world.healthCurrent[eid]
      const prevHp = hitFlashLastHp[eid]
      if (prevHp === 0) {
        hitFlashLastHp[eid] = curHp
      } else if (curHp < prevHp) {
        hitFlashFrames[eid] = 3
        hitFlashLastHp[eid] = curHp
      } else {
        hitFlashLastHp[eid] = curHp
      }
    }
    if (hitFlashFrames[eid] > 0) hitFlashFrames[eid]--

    // ---- Stun flash detection (new stun application → brief yellow tint) ----
    const isStunned = (mask & C.STUN) ? 1 : 0
    if (isStunned && !lastWasStunned[eid]) stunFlashFrames[eid] = 4
    lastWasStunned[eid] = isStunned
    if (stunFlashFrames[eid] > 0) stunFlashFrames[eid]--

    // ---- Status tint — applied directly to sprite so only visible pixels are affected ----
    // Priority: hit flash > stun flash > slow.
    // PixiJS tint is a multiply, so transparent pixels remain transparent — no box artifact.
    if (hitFlashFrames[eid] > 0) {
      // Red-white flash: 0xff8888 at peak → 0xffd3d3 at tail
      const t = hitFlashFrames[eid] / 3
      const gb = Math.round(0x88 + 0x77 * (1 - t))
      sprite.tint = (0xff << 16) | (gb << 8) | gb
    } else if (stunFlashFrames[eid] > 0) {
      // Yellow flash: 0xffee44 at peak → near-white at tail
      const t = stunFlashFrames[eid] / 4
      const b = Math.round(0x44 + 0xbb * (1 - t))
      sprite.tint = (0xff << 16) | (0xee << 8) | b
    } else if (mask & C.SLOW) {
      // Persistent cold-blue tint for slowed enemies
      sprite.tint = 0x88bbff
    }
    // Note: GLITCH sets its own tint inside the per-type switch above;
    // status effects override it intentionally when active.
  }

  // ---- Death dissolve animation ----
  for (let i = activeDeathAnims.length - 1; i >= 0; i--) {
    const da = activeDeathAnims[i]
    da.frame++
    const t = da.frame / da.maxFrames
    da.sprite.x = da.x + da.driftX * t
    da.sprite.y = da.y + da.driftY * t
    da.sprite.scale.set(da.baseScaleX * (1 - t * 0.75), da.baseScaleY * (1 - t * 0.75))
    da.sprite.alpha = 1 - t
    // Brief white flash on first 2 frames
    da.sprite.tint = da.frame <= 2 ? 0xffffff : 0xaaaaaa
    if (da.frame >= da.maxFrames) {
      container.removeChild(da.sprite)
      release(da.sprite)
      activeDeathAnims.splice(i, 1)
    }
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
  prevRenderX.fill(0)
  prevRenderY.fill(0)
  hitFlashFrames.fill(0)
  hitFlashLastHp.fill(0)
  stunFlashFrames.fill(0)
  lastWasStunned.fill(0)
  activeDeathAnims.length = 0
  activeGlitchFilters.clear()
  glitchFilterPool.length = 0
}
