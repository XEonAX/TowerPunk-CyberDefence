/**
 * Status Apply System — §1.10.3
 *
 * Applies queued status effects (slow, stun, tower-disable) that were pushed
 * by damage.system / enemyAura.system during the previous tick.
 *
 * Rule references:
 *   §7.0.12 — Stun clears existing slow
 *   §7.0.13 — Slow cannot be applied to stunned enemy
 *   §7.0.15 — Slow: replace only if new magnitude is strictly greater
 *   §7.0.16 — Stun: replace only if new duration is strictly greater
 *   §7.7    — Tower disable (Saboteur aura)
 */
import type { World } from '../ecs/world'
import * as C from '../ecs/component'

export function statusApplySystem(world: World): void {
  _applySlowQueue(world)
  _applyStunQueue(world)
  _applyDisableQueue(world)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _applySlowQueue(world: World): void {
  const len = world.statusSlowQueueLen
  for (let qi = 0; qi < len; qi++) {
    const base = qi * 3
    const eid       = world.statusSlowQueue[base]
    const magnitude = world.statusSlowQueue[base + 1]
    const ticks     = world.statusSlowQueue[base + 2]

    const mask = world.bitmask[eid]

    // Skip dead or pending-removal entities
    if (mask === 0 || (mask & C.PENDING_REMOVAL) !== 0) continue

    // §7.0.13 — Slow cannot override stun
    if (world.stunTicks[eid] > 0) continue

    // §7.0.15 — IMMUNE_SLOW: cannot be slowed
    if ((world.immunityFlags[eid] & C.IMMUNE_SLOW) !== 0) continue

    if (world.slowTicks[eid] === 0) {
      // No current slow — apply immediately
      world.slowMagnitude[eid] = magnitude
      world.slowTicks[eid]     = ticks
    } else if (magnitude > world.slowMagnitude[eid]) {
      // §7.0.15 — stronger slow replaces weaker
      world.slowMagnitude[eid] = magnitude
      world.slowTicks[eid]     = ticks
    }
    // else: weaker or equal — ignore
  }
  world.statusSlowQueueLen = 0
}

function _applyStunQueue(world: World): void {
  const len = world.statusStunQueueLen
  for (let qi = 0; qi < len; qi++) {
    const base  = qi * 2
    const eid   = world.statusStunQueue[base]
    const ticks = world.statusStunQueue[base + 1]

    const mask = world.bitmask[eid]

    // Skip dead or pending-removal entities
    if (mask === 0 || (mask & C.PENDING_REMOVAL) !== 0) continue

    // §7.0.16 — IMMUNE_STUN: cannot be stunned
    if ((world.immunityFlags[eid] & C.IMMUNE_STUN) !== 0) continue

    // §7.0.12 — Applying stun clears existing slow
    if (world.slowTicks[eid] > 0) {
      world.slowTicks[eid]     = 0
      world.slowMagnitude[eid] = 0
    }

    if (world.stunTicks[eid] === 0) {
      // No current stun — apply
      world.stunTicks[eid] = ticks
    } else if (ticks > world.stunTicks[eid]) {
      // §7.0.16 — longer stun replaces shorter
      world.stunTicks[eid] = ticks
    }
    // else: shorter — ignore
  }
  world.statusStunQueueLen = 0
}

function _applyDisableQueue(world: World): void {
  const len = world.statusDisableQueueLen
  for (let qi = 0; qi < len; qi++) {
    const base  = qi * 2
    const eid   = world.statusDisableQueue[base]
    const ticks = world.statusDisableQueue[base + 1]

    const mask = world.bitmask[eid]
    if (mask === 0 || (mask & C.PENDING_REMOVAL) !== 0) continue

    // Apply disable flag and store tick count
    world.bitmask[eid] |= C.TOWER_DISABLED
    // Use the longer of current disable or new disable
    if (ticks > world.towerDisableTicks[eid]) {
      world.towerDisableTicks[eid] = ticks
    }
  }
  world.statusDisableQueueLen = 0
}
