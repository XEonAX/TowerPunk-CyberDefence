/**
 * System type definition and tick runner — Tech.md §3.2
 *
 * Systems are pure functions: (world: World) => void
 * Executed in fixed order each tick (§1.10).
 */

import type { World } from './world'

/** A system is a pure function that reads/writes the World each tick. */
export type System = (world: World) => void

/** No-op system placeholder for stub pipeline slots. */
export const noopSystem: System = (_world: World): void => {}
