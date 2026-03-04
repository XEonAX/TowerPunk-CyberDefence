/**
 * Camera — Tech.md §6.5
 * Pan, zoom, viewport management.
 * Implemented as a transform on the root camera Container.
 */

import type { Application, Container, FederatedPointerEvent } from 'pixi.js'

const TILE_SIZE = 16 // pixels per tile
const GRID_SIZE = 51

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4.0
const ZOOM_SPEED = 0.1
const PAN_SPEED = 8 // pixels per key press per frame

export interface Camera {
  /** Current zoom level */
  zoom: number
  /** Pan offset in pixels */
  panX: number
  panY: number
  /** Center camera on the grid */
  centerOnGrid(): void
  /** Handle mouse wheel zoom */
  onWheel(event: WheelEvent): void
  /** Start drag pan */
  onPointerDown(event: FederatedPointerEvent): void
  /** Continue drag pan */
  onPointerMove(event: FederatedPointerEvent): void
  /** End drag pan */
  onPointerUp(): void
  /** Apply key-based panning (call each frame) */
  applyKeyPan(keys: Set<string>): void
  /** Apply current transform to camera container */
  apply(): void
  /** Convert screen position to world tile coordinates */
  screenToTile(screenX: number, screenY: number): { x: number; y: number }
  /** Clamp pan to grid bounds */
  clamp(): void
}

let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragPanStartX = 0
let dragPanStartY = 0

export function createCamera(app: Application, cameraContainer: Container): Camera {
  const camera: Camera = {
    zoom: 1.0,
    panX: 0,
    panY: 0,

    centerOnGrid(): void {
      const gridPixelSize = GRID_SIZE * TILE_SIZE * this.zoom
      this.panX = (app.screen.width - gridPixelSize) / 2
      this.panY = (app.screen.height - gridPixelSize) / 2
      this.apply()
    },

    onWheel(event: WheelEvent): void {
      const delta = -event.deltaY * ZOOM_SPEED * 0.01
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + delta * this.zoom))

      // Zoom toward cursor position
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      // Adjust pan so zoom centers on cursor
      const worldX = (mouseX - this.panX) / this.zoom
      const worldY = (mouseY - this.panY) / this.zoom
      this.zoom = newZoom
      this.panX = mouseX - worldX * this.zoom
      this.panY = mouseY - worldY * this.zoom

      this.clamp()
      this.apply()
    },

    onPointerDown(event: FederatedPointerEvent): void {
      isDragging = true
      dragStartX = event.globalX
      dragStartY = event.globalY
      dragPanStartX = this.panX
      dragPanStartY = this.panY
    },

    onPointerMove(event: FederatedPointerEvent): void {
      if (!isDragging) return
      const dx = event.globalX - dragStartX
      const dy = event.globalY - dragStartY
      this.panX = dragPanStartX + dx
      this.panY = dragPanStartY + dy
      this.clamp()
      this.apply()
    },

    onPointerUp(): void {
      isDragging = false
    },

    applyKeyPan(keys: Set<string>): void {
      let dx = 0
      let dy = 0
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dx += PAN_SPEED
      if (keys.has('ArrowRight') || keys.has('KeyD')) dx -= PAN_SPEED
      if (keys.has('ArrowUp') || keys.has('KeyW')) dy += PAN_SPEED
      if (keys.has('ArrowDown') || keys.has('KeyS')) dy -= PAN_SPEED
      if (dx !== 0 || dy !== 0) {
        this.panX += dx
        this.panY += dy
        this.clamp()
        this.apply()
      }
    },

    apply(): void {
      cameraContainer.x = this.panX
      cameraContainer.y = this.panY
      cameraContainer.scale.set(this.zoom)
    },

    screenToTile(screenX: number, screenY: number): { x: number; y: number } {
      const worldX = (screenX - this.panX) / this.zoom
      const worldY = (screenY - this.panY) / this.zoom
      return {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE),
      }
    },

    // clamp is assigned below
    clamp(): void { /* overwritten below */ },
  }

  camera.clamp = function (this: Camera): void {
    // Keep at least 3 tiles of the grid visible on each edge so it can't be
    // panned completely off-screen, but otherwise allow free movement.
    const gridPixelSize = GRID_SIZE * TILE_SIZE * this.zoom
    const minVisible = 3 * TILE_SIZE * this.zoom
    this.panX = Math.max(minVisible - gridPixelSize, Math.min(app.screen.width - minVisible, this.panX))
    this.panY = Math.max(minVisible - gridPixelSize, Math.min(app.screen.height - minVisible, this.panY))
  }.bind(camera)

  return camera
}

export { TILE_SIZE }
