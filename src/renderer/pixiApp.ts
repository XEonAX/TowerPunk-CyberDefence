/**
 * PixiJS Application Setup — Tech.md §6.1
 * Full-viewport canvas with render layer containers.
 */

import { Application, Container } from 'pixi.js'

export interface RenderLayers {
  /** Layer 0 — Grid lines, Blackwall boundary */
  grid: Container
  /** Layer 1 — Tower placement preview (ghost) */
  ghost: Container
  /** Layer 2 — Tower sprites */
  towers: Container
  /** Layer 3 — Enemy sprites */
  enemies: Container
  /** Layer 4 — Pickup sprites */
  pickups: Container
  /** Layer 5 — Particle effects, VFX */
  fx: Container
}

let pixiApp: Application | null = null
let layers: RenderLayers | null = null

/**
 * Initialize the PixiJS application.
 * Creates a full-viewport canvas mounted inside the given container.
 * Returns the app and layer references.
 */
export async function initPixi(container: HTMLElement): Promise<{ app: Application; layers: RenderLayers }> {
  const app = new Application()

  await app.init({
    background: '#0a0a0f',
    resizeTo: container,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  })

  // Make canvas fill container
  app.canvas.style.display = 'block'
  app.canvas.style.width = '100%'
  app.canvas.style.height = '100%'
  container.appendChild(app.canvas)

  // Create camera container (everything in-world goes here)
  const cameraContainer = new Container()
  cameraContainer.label = 'camera'
  app.stage.addChild(cameraContainer)

  // Create render layers in z-order (Tech.md §6.2)
  const renderLayers: RenderLayers = {
    grid: new Container(),
    ghost: new Container(),
    towers: new Container(),
    enemies: new Container(),
    pickups: new Container(),
    fx: new Container(),
  }

  renderLayers.grid.label = 'grid'
  renderLayers.ghost.label = 'ghost'
  renderLayers.towers.label = 'towers'
  renderLayers.enemies.label = 'enemies'
  renderLayers.pickups.label = 'pickups'
  renderLayers.fx.label = 'fx'

  // Add layers in z-order to camera container
  cameraContainer.addChild(renderLayers.grid)
  cameraContainer.addChild(renderLayers.ghost)
  cameraContainer.addChild(renderLayers.towers)
  cameraContainer.addChild(renderLayers.enemies)
  cameraContainer.addChild(renderLayers.pickups)
  cameraContainer.addChild(renderLayers.fx)

  pixiApp = app
  layers = renderLayers

  console.log('TowerPunk booted')
  return { app, layers: renderLayers }
}

export function getPixiApp(): Application {
  if (!pixiApp) throw new Error('PixiJS not initialized — call initPixi() first')
  return pixiApp
}

export function getRenderLayers(): RenderLayers {
  if (!layers) throw new Error('PixiJS layers not initialized — call initPixi() first')
  return layers
}

export function getCameraContainer(): Container {
  if (!pixiApp) throw new Error('PixiJS not initialized')
  return pixiApp.stage.getChildByLabel('camera') as Container
}
