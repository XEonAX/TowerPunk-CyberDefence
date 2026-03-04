/**
 * Entity ID Manager — Tech.md §4.1.3
 *
 * Manages a pool of unsigned 32-bit integer entity IDs using a free-list pool.
 * Zero allocations after initial setup.
 */

export type EntityId = number

const INITIAL_CAPACITY = 4096
const NULL_ID = 0xffffffff

export interface EntityPool {
  /** Create a new entity ID, recycling freed IDs when available. */
  create(): EntityId
  /** Return an entity ID to the pool. */
  destroy(id: EntityId): void
  /** Check whether an entity ID is currently alive. */
  isAlive(id: EntityId): boolean
}

/**
 * Create a new entity pool pre-allocated for `capacity` entities.
 */
export function createEntityPool(capacity: number = INITIAL_CAPACITY): EntityPool {
  // alive flags — Uint8Array: 1 = alive, 0 = dead
  const alive = new Uint8Array(capacity)
  // free-list stack
  const freeList = new Uint32Array(capacity)
  let freeCount = 0
  let nextNew = 1 // IDs start at 1; 0 is reserved as NULL_ID sentinel

  return {
    create(): EntityId {
      if (freeCount > 0) {
        const id = freeList[--freeCount]
        alive[id] = 1
        return id
      }
      if (nextNew >= capacity) {
        throw new Error(`EntityPool exhausted (capacity ${capacity})`)
      }
      const id = nextNew++
      alive[id] = 1
      return id
    },

    destroy(id: EntityId): void {
      if (id === 0 || id === NULL_ID) return
      alive[id] = 0
      freeList[freeCount++] = id
    },

    isAlive(id: EntityId): boolean {
      return id > 0 && id < nextNew && alive[id] === 1
    },
  }
}
