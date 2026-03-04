/**
 * Command System — Pre-§1.10
 * Processes player commands from the UI command queue.
 */
import type { World } from '../ecs/world'

export function commandSystem(world: World): void {
  // Flush command queue — each command handled here
  while (world.commandQueue.length > 0) {
    world.commandQueue.pop()
  }
}
