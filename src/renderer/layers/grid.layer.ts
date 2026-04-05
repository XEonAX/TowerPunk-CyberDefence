/**
 * Grid Layer — Tech.md §6.2, Rulebook §2.1–2.2, §2.5
 *
 * Renders the 51×51 tile grid with blue dotted lines and Blackwall boundary.
 * Draws once, updates only on camera/zoom changes.
 */

import { Graphics, Container } from 'pixi.js'
import { TILE_SIZE } from '../camera'

const GRID_SIZE = 51
const CORE_X = 25
const CORE_Y = 25

// Colors (Cyberpunk aesthetic)
const GRID_LINE_COLOR = 0x0044aa   // Blue dotted lines — §2.2
const GRID_LINE_ALPHA = 0.35
const BLACKWALL_COLOR = 0xcc0022   // Red dotted lines — §2.5

const CORE_COLOR = 0x0088ff        // Blue Core highlight — §3.1
const CORE_ALPHA = 0.6

/**
 * Draw the 51×51 grid, Core tile highlight, and Blackwall boundary.
 * Call once during initialization. The entire layer moves with the camera.
 * Returns an update function that should be called each render frame to
 * animate the pulsing Blackwall boundary.
 */
export function createGridLayer(container: Container): () => void {
  const gfx = new Graphics()

  const totalSize = GRID_SIZE * TILE_SIZE

  // --- Solid background — occludes the plexus layer beneath the grid area ---
  gfx.rect(0, 0, totalSize, totalSize)
  gfx.fill({ color: 0x0a0a0f, alpha: 1.0 })

  // --- Grid lines (blue) ---
  gfx.setStrokeStyle({ width: 1, color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA })

  // Vertical lines
  for (let x = 0; x <= GRID_SIZE; x++) {
    const px = x * TILE_SIZE
    gfx.moveTo(px, 0)
    gfx.lineTo(px, totalSize)
  }
  // Horizontal lines
  for (let y = 0; y <= GRID_SIZE; y++) {
    const py = y * TILE_SIZE
    gfx.moveTo(0, py)
    gfx.lineTo(totalSize, py)
  }
  gfx.stroke()

  // --- Core tile highlight (blue square) ---
  const coreX = CORE_X * TILE_SIZE
  const coreY = CORE_Y * TILE_SIZE
  gfx.setFillStyle({ color: CORE_COLOR, alpha: CORE_ALPHA })
  gfx.rect(coreX + 1, coreY + 1, TILE_SIZE - 2, TILE_SIZE - 2)
  gfx.fill()
  gfx.setStrokeStyle({ width: 2, color: CORE_COLOR, alpha: 1.0 })
  gfx.rect(coreX, coreY, TILE_SIZE, TILE_SIZE)
  gfx.stroke()

  container.addChild(gfx)

  // --- Animated Blackwall boundary — separate Graphics updated each frame ---
  const pulseGfx = new Graphics()
  container.addChild(pulseGfx)

  return (): void => {
    const time = performance.now() / 1000
    const outer = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 1.4))
    const inner = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(time * 2.9 + 1.1))
    pulseGfx.clear()
    pulseGfx.setStrokeStyle({ width: 2, color: BLACKWALL_COLOR, alpha: outer })
    pulseGfx.rect(0, 0, totalSize, totalSize)
    pulseGfx.stroke()
    pulseGfx.setStrokeStyle({ width: 1, color: BLACKWALL_COLOR, alpha: inner })
    pulseGfx.rect(TILE_SIZE, TILE_SIZE, totalSize - 2 * TILE_SIZE, totalSize - 2 * TILE_SIZE)
    pulseGfx.stroke()
  }
}
