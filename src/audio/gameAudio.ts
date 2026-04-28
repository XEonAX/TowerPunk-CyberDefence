/**
 * GameAudioSystem — drains the World's audio event ring buffer each frame
 * and drives all in-game sounds: one-shot SFX, enemy ambient loops, and
 * high-priority game-state stings.
 *
 * This module lives OUTSIDE the simulation layer — it imports from Howler
 * (via audioManager) and therefore must never be imported by simulation code.
 *
 * Call `gameAudioSystem.update(world)` once per RAF frame, after all ticks
 * for that frame have been processed.
 */

import { EnemyType, TowerType, ENEMY } from '../game/ecs/component'
import type { World } from '../game/ecs/world'
import { AudioEventType } from './audioEvents'
import { SoundId } from './audioAssets'
import { audioManager } from './audioManager'

// ─── Enemy-type → loop SoundId mapping ──────────────────────────────────────

const ENEMY_LOOP: Record<number, SoundId> = {
  [EnemyType.DATA_LEECH]:       SoundId.LOOP_DATA_LEECH,
  [EnemyType.CODE_RUNNER]:      SoundId.LOOP_CODE_RUNNER,
  [EnemyType.FIREWALL_BREACHER]:SoundId.LOOP_BREACHER,
  [EnemyType.GLITCH]:           SoundId.LOOP_GLITCH,
  [EnemyType.ORCHESTRATOR]:     SoundId.LOOP_ORCHESTRATOR,
  [EnemyType.VDB_NETRUNNER]:    SoundId.LOOP_NETRUNNER,
  [EnemyType.SABOTEUR]:         SoundId.LOOP_SABOTEUR,
  [EnemyType.AI_OVERLORD]:      SoundId.LOOP_OVERLORD,
}

// ─── Tower-type → placement SoundId mapping ──────────────────────────────────

const TOWER_PLACE_SOUND: Record<number, SoundId> = {
  [TowerType.ICE_WALL]: SoundId.TOWER_PLACE_ICE_WALL,
  [TowerType.FIREWALL]: SoundId.TOWER_PLACE_FIREWALL,
  [TowerType.DATA_SPIKE]: SoundId.TOWER_PLACE_GENERIC,
  [TowerType.DAEMON_TURRET]: SoundId.TOWER_PLACE_GENERIC,
  [TowerType.ICE_SNIPER]: SoundId.TOWER_PLACE_SNIPER,
  [TowerType.BLACKWALL]: SoundId.TOWER_PLACE_BLACKWALL,
  [TowerType.PING]: SoundId.TOWER_PLACE_PING,
  [TowerType.HARVESTER]: SoundId.TOWER_PLACE_HARVESTER,
}

// ─── Tower-type → attack SoundId mapping ─────────────────────────────────────

const TOWER_ATTACK_SOUND: Record<number, SoundId> = {
  [TowerType.ICE_WALL]: SoundId.ATTACK_ICE_WALL,
  [TowerType.FIREWALL]: SoundId.ATTACK_FIREWALL,
  [TowerType.DATA_SPIKE]: SoundId.ATTACK_DATA_SPIKE,
  [TowerType.DAEMON_TURRET]: SoundId.ATTACK_TURRET,
  [TowerType.ICE_SNIPER]: SoundId.ATTACK_SNIPER,
  [TowerType.BLACKWALL]: SoundId.ATTACK_BLACKWALL,
  [TowerType.PING]: SoundId.ATTACK_PING,
}

// ─── Per-frame throttle: max plays per event type per RAF frame ──────────────

const MAX_PER_TYPE_PER_FRAME = 3

// ─── Loop state tracking ─────────────────────────────────────────────────────

/** Currently faded-in loop SoundIds. */
const _activeLoops = new Set<SoundId>()
/** Loop fade duration ms. */
const LOOP_FADE_IN_MS  = 800
const LOOP_FADE_OUT_MS = 1500

// ─── Public API ───────────────────────────────────────────────────────────────

export const gameAudioSystem = {
  /**
   * Drain the World's audio event ring buffer and play the appropriate sounds.
   * Also reconciles enemy ambient loops with currently present enemy types.
   *
   * @param world   The live ECS world (read-only intent — no mutations except resetting audioEventCount).
   */
  update(world: World): void {
    if (!audioManager.isReady) return

    // ── 1. Drain event ring buffer ──────────────────────────────────────────
    const count = world.audioEventCount
    // Per-type throttle counters — reuse a fixed-size array
    const typeCounts = _typeCountScratch
    typeCounts.fill(0)

    for (let i = 0; i < count; i++) {
      const type = world.audioEventTypeBuf[i]
      const data = world.audioEventDataBuf[i]

      if (typeCounts[type] >= MAX_PER_TYPE_PER_FRAME) continue
      typeCounts[type]++

      _handleEvent(type, data)
    }
    // Reset for next frame
    world.audioEventCount = 0

    // ── 2. Reconcile enemy ambient loops ────────────────────────────────────
    _reconcileLoops(world)
  },
}

// ─── Scratch buffer — 256 possible event types (uint8 range) ─────────────────
const _typeCountScratch = new Uint8Array(256)

// ─── Event dispatch ───────────────────────────────────────────────────────────

function _handleEvent(type: AudioEventType, data: number): void {
  switch (type) {
    case AudioEventType.ENEMY_SPAWNED:
      audioManager.play(SoundId.ENEMY_SPAWN)
      break

    case AudioEventType.ENEMY_DIED:
      audioManager.play(SoundId.ENEMY_DEATH)
      break

    case AudioEventType.ENEMY_BOSS_DIED:
      audioManager.play(SoundId.ENEMY_DEATH_BOSS)
      break

    case AudioEventType.ENEMY_DAMAGED:
      audioManager.play(SoundId.ENEMY_DAMAGE)
      break

    case AudioEventType.TOWER_PLACED: {
      const sound = TOWER_PLACE_SOUND[data] ?? SoundId.TOWER_PLACE_GENERIC
      audioManager.play(sound)
      break
    }

    case AudioEventType.TOWER_UPGRADED:
      audioManager.play(SoundId.TOWER_UPGRADE)
      break

    case AudioEventType.TOWER_UPGRADE_MAX:
      audioManager.play(SoundId.TOWER_UPGRADE_MAX)
      break

    case AudioEventType.TOWER_DISMANTLED:
      audioManager.play(SoundId.TOWER_DISMANTLE)
      break

    case AudioEventType.TOWER_DESTROYED:
      audioManager.play(SoundId.TOWER_DESTROYED)
      break

    case AudioEventType.ABILITY_ACTIVATED:
      audioManager.play(SoundId.ABILITY_ACTIVATE)
      break

    case AudioEventType.WAVE_STARTED:
      audioManager.play(SoundId.WAVE_START)
      break

    case AudioEventType.WAVE_ENDED:
      audioManager.play(SoundId.WAVE_END)
      // Fade out all enemy loops when wave ends
      _fadeOutAllLoops()
      break

    case AudioEventType.BREACH_OPENED:
      audioManager.play(SoundId.BREACH_OPEN)
      break

    case AudioEventType.BREACH_CLOSED:
      audioManager.play(SoundId.BREACH_CLOSE)
      break

    case AudioEventType.GAME_OVER:
      audioManager.play(SoundId.GAME_OVER)
      _fadeOutAllLoops()
      break

    case AudioEventType.VICTORY:
      audioManager.play(SoundId.VICTORY)
      _fadeOutAllLoops()
      break

    case AudioEventType.PICKUP_COLLECTED:
      audioManager.play(SoundId.PICKUP_COLLECT)
      break

    case AudioEventType.STATUS_SLOW:
      audioManager.play(SoundId.STATUS_SLOW)
      break

    case AudioEventType.STATUS_STUN:
      audioManager.play(SoundId.STATUS_STUN)
      break

    case AudioEventType.RESOURCE_GAINED:
      // data: 0 = eddies, 1 = components
      audioManager.play(data === 0 ? SoundId.RESOURCE_EDDIE : SoundId.RESOURCE_COMPONENT)
      break

    case AudioEventType.TOWER_ATTACK: {
      const attackSound = TOWER_ATTACK_SOUND[data]
      if (attackSound !== undefined) {
        audioManager.play(attackSound)
      }
      break
    }

    default:
      break
  }
}

// ─── Enemy ambient loop reconciliation ───────────────────────────────────────

/** Scratch set for building the desired-active-loops set without allocation. */
const _desiredLoops = new Set<SoundId>()

function _reconcileLoops(world: World): void {
  _desiredLoops.clear()

  // Scan all entity slots for live enemies
  const bitmask = world.bitmask
  const enemyTypeBuf = world.enemyType

  // Use pool capacity: iterate IDs 1..nextNew-1
  const pool = world.pool
  for (let eid = 1; eid < bitmask.length; eid++) {
    if (!pool.isAlive(eid)) continue
    if ((bitmask[eid] & ENEMY) === 0) continue
    const loopId = ENEMY_LOOP[enemyTypeBuf[eid]]
    if (loopId !== undefined) _desiredLoops.add(loopId)
  }

  // Fade in loops that should be active but aren't
  for (const loopId of _desiredLoops) {
    if (!_activeLoops.has(loopId)) {
      audioManager.fadeLoopIn(loopId, LOOP_FADE_IN_MS)
      _activeLoops.add(loopId)
    }
  }

  // Fade out loops that are active but shouldn't be
  for (const loopId of _activeLoops) {
    if (!_desiredLoops.has(loopId)) {
      audioManager.fadeLoopOut(loopId, LOOP_FADE_OUT_MS)
      _activeLoops.delete(loopId)
    }
  }
}

function _fadeOutAllLoops(): void {
  for (const loopId of _activeLoops) {
    audioManager.fadeLoopOut(loopId, LOOP_FADE_OUT_MS)
  }
  _activeLoops.clear()
}
