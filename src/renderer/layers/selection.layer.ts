/**
 * Selection Layer — tile highlight overlays for multi-selected towers.
 * Rendered above the ghost layer, below tower sprites. Read-only access to ECS world.
 */

import { Graphics, Container } from 'pixi.js'
import { TILE_SIZE } from '../camera'

const FILL_COLOR = 0x0066ff
const FILL_ALPHA = 0.22
const BORDER_COLOR = 0x00bbff
const BORDER_ALPHA = 0.9

let gfx: Graphics | null = null
let lastEids: number[] = []

/**
 * Draw a translucent blue tile rect for each selected tower.
 * No-ops when the selection hasn't changed.
 */
export function updateSelectionLayer(
  container: Container,
  tilePosX: Uint8Array,
  tilePosY: Uint8Array,
  selectedEids: readonly number[],
): void {
  // Fast equality check — same length and same eids in order
  if (
    gfx !== null &&
    selectedEids.length === lastEids.length &&
    (selectedEids as number[]).every((eid, i) => eid === lastEids[i])
  ) {
    return
  }
  lastEids = Array.from(selectedEids)

  if (!gfx) {
    gfx = new Graphics()
    container.addChild(gfx)
  }

  gfx.clear()

  for (const eid of selectedEids) {
    const tx = tilePosX[eid]
    const ty = tilePosY[eid]
    const px = tx * TILE_SIZE
    const py = ty * TILE_SIZE

    gfx.setFillStyle({ color: FILL_COLOR, alpha: FILL_ALPHA })
    gfx.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    gfx.fill()

    gfx.setStrokeStyle({ width: 1.5, color: BORDER_COLOR, alpha: BORDER_ALPHA })
    gfx.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    gfx.stroke()
  }
}
