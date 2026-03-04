/**
 * Status Queue System — §1.10.10
 * Queue new status effects for next tick.
 *
 * queueSlow / queueStun are exported helpers used by damageSystem (§1.10.8)
 * to push pending effects onto the world's status queues. The corresponding
 * statusApplySystem (§1.10.3) consumes these queues at the start of the
 * following tick.
 */
import type { World } from '../ecs/world'

/**
 * Queue a slow effect on an enemy entity for application next tick.
 * §7.0.15: Slow replacement rules are enforced by statusApplySystem.
 */
export function queueSlow(
  world: World,
  eid: number,
  magnitude: number,
  ticks: number,
): void {
  const base = world.statusSlowQueueLen * 3
  if (base + 2 < world.statusSlowQueue.length) {
    world.statusSlowQueue[base]     = eid
    world.statusSlowQueue[base + 1] = magnitude
    world.statusSlowQueue[base + 2] = ticks
    world.statusSlowQueueLen++
  }
}

/**
 * Queue a stun effect on an enemy entity for application next tick.
 * §7.0.16: Stun replacement rules are enforced by statusApplySystem.
 */
export function queueStun(
  world: World,
  eid: number,
  ticks: number,
): void {
  const base = world.statusStunQueueLen * 2
  if (base + 1 < world.statusStunQueue.length) {
    world.statusStunQueue[base]     = eid
    world.statusStunQueue[base + 1] = ticks
    world.statusStunQueueLen++
  }
}

/**
 * Queue a tower-disable effect for application next tick.
 * Rulebook §7.7 (Saboteur aura)
 */
export function queueDisable(world: World, eid: number, ticks: number): void {
  const base = world.statusDisableQueueLen * 2
  if (base + 1 < world.statusDisableQueue.length) {
    world.statusDisableQueue[base]     = eid
    world.statusDisableQueue[base + 1] = ticks
    world.statusDisableQueueLen++
  }
}

/**
 * §1.10.10 — No-op tick pipeline step.
 * Queue helpers above are called from damage.system / enemyAura.system.
 */
export function statusQueueSystem(_world: World): void {
  // No-op — queuing is performed by damage.system and enemyAura.system
}
