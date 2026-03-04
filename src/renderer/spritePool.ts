/**
 * Sprite Pool — Tech.md §6.4
 *
 * Object pooling for PixiJS sprites.
 * Zero new Sprite() calls during active gameplay after warm-up.
 */

import { Sprite, type Texture } from 'pixi.js'

export class SpritePool {
  private pool: Sprite[] = []
  private active: Set<Sprite> = new Set()
  private texture: Texture
  private initialSize: number

  constructor(texture: Texture, initialSize: number = 32) {
    this.texture = texture
    this.initialSize = initialSize
    this.grow(initialSize)
  }

  private grow(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(this.texture)
      sprite.visible = false
      this.pool.push(sprite)
    }
  }

  /** Acquire a sprite from the pool (auto-grows if exhausted). */
  acquire(): Sprite {
    if (this.pool.length === 0) {
      // Auto-grow: double the pool size
      this.grow(Math.max(this.initialSize, this.active.size))
    }
    const sprite = this.pool.pop()!
    sprite.visible = true
    this.active.add(sprite)
    return sprite
  }

  /** Release a sprite back to the pool. */
  release(sprite: Sprite): void {
    if (!this.active.has(sprite)) return
    sprite.visible = false
    sprite.alpha = 1
    this.active.delete(sprite)
    this.pool.push(sprite)
  }

  /** Get count of currently active (in-use) sprites. */
  get activeCount(): number {
    return this.active.size
  }

  /** Get total pool capacity (active + available). */
  get totalCount(): number {
    return this.active.size + this.pool.length
  }
}
