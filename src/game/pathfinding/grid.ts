/**
 * Grid State — Tech.md §5.4, Rulebook §2.1–2.6
 */

import { GRID_SIZE, CORE_X, CORE_Y } from '../constants'

export interface Grid {
  /** 0 = empty, tower type+1 = occupied. Size: GRID_SIZE × GRID_SIZE. */
  blocked: Uint8Array
  /** Tower type stored per tile. */
  towerType: Uint8Array
}

export interface ReadonlyGrid {
  readonly blocked: Readonly<Uint8Array>
  readonly towerType: Readonly<Uint8Array>
}

/** Convert (x, y) tile coordinates to flat array index. */
export function idx(x: number, y: number): number {
  return x + y * GRID_SIZE
}

export function createGrid(): Grid {
  return {
    blocked: new Uint8Array(GRID_SIZE * GRID_SIZE),
    towerType: new Uint8Array(GRID_SIZE * GRID_SIZE),
  }
}

/** Rulebook §2.6.3 — edge tiles cannot be built on. */
export function isEdgeTile(x: number, y: number): boolean {
  return x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1
}

/** Check whether a tile is occupied by a tower. */
export function isOccupied(grid: ReadonlyGrid, x: number, y: number): boolean {
  return grid.blocked[idx(x, y)] !== 0
}

/** Block a tile (place tower). */
export function setBlocked(grid: Grid, x: number, y: number, towerTypeVal: number): void {
  const i = idx(x, y)
  grid.blocked[i] = 1
  grid.towerType[i] = towerTypeVal
}

/** Unblock a tile (remove tower). */
export function clearBlocked(grid: Grid, x: number, y: number): void {
  const i = idx(x, y)
  grid.blocked[i] = 0
  grid.towerType[i] = 0
}

/** Check if tile is the Core tile. */
export function isCoreTile(x: number, y: number): boolean {
  return x === CORE_X && y === CORE_Y
}
