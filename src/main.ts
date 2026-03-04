import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './ui/App.vue'
import type { Command } from './game/ecs/world'
import { initPixi, getCameraContainer } from './renderer/pixiApp'
import { createGridLayer } from './renderer/layers/grid.layer'
import { updateEnemyLayer } from './renderer/layers/enemy.layer'
import { updateTowerLayer } from './renderer/layers/tower.layer'
import { updatePickupLayer } from './renderer/layers/pickup.layer'
import { updateGhostLayer } from './renderer/layers/ghost.layer'
import { updateFxLayer } from './renderer/layers/fx.layer'
import { createCamera } from './renderer/camera'
import { createSimulation } from './game/simulation'
import { startGameLoop } from './game/gameLoop'
import { useGameStore } from './ui/stores/game.store'
import { useUiStore } from './ui/stores/ui.store'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.mount('#app')

// Bootstrap game after DOM mount
const container = document.getElementById('pixi-container') ?? document.getElementById('app')
if (container) {
  initPixi(container).then(({ app: pixiApp, layers }) => {
    // Initialize grid layer
    createGridLayer(layers.grid)

    // Initialize camera
    const cameraContainer = getCameraContainer()
    const camera = createCamera(pixiApp, cameraContainer)
    camera.centerOnGrid()

    // Wire mouse wheel zoom
    pixiApp.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      camera.onWheel(e)
    }, { passive: false })

    // Wire drag pan via PixiJS stage events
    pixiApp.stage.eventMode = 'static'
    pixiApp.stage.hitArea = pixiApp.screen
    pixiApp.stage.on('pointerdown', (e) => camera.onPointerDown(e))
    pixiApp.stage.on('pointermove', (e) => {
      camera.onPointerMove(e)
      // Update hovered tile for ghost preview
      const t = camera.screenToTile(e.globalX, e.globalY)
      uiStore.setHoveredTile(t.x, t.y)
    })
    pixiApp.stage.on('pointerup', () => camera.onPointerUp())
    pixiApp.stage.on('pointerupoutside', () => camera.onPointerUp())

    // Keyboard pan
    const keysDown = new Set<string>()
    window.addEventListener('keydown', (e) => {
      keysDown.add(e.code)
      if (e.code === 'Escape') {
        useUiStore().selectTowerType(null)
      }
      if (e.code === 'KeyR') {
        useUiStore().rotatePlacementFacing()
      }
    })
    window.addEventListener('keyup', (e) => keysDown.delete(e.code))

    // Create simulation
    const simulation = createSimulation(12345)

    // Init Pinia stores after simulation is ready
    const gameStore = useGameStore()
    const uiStore = useUiStore()

    // Start game loop
    const renderer = {
      draw(alpha: number): void {
        camera.applyKeyPan(keysDown)
        // Sync simulation state to Vue stores (Tech.md §8)
        const world = simulation.getWorld()
        gameStore.syncFromWorld(world)
        gameStore.syncSelectedTower(world, uiStore.selectedTowerEid)
        // Update render layers
        updateTowerLayer(layers.towers, world, alpha)
        updateEnemyLayer(layers.enemies, world, alpha)
        updatePickupLayer(layers.pickups, world, alpha)
        updateGhostLayer(layers.ghost, world, uiStore.hoveredTileX, uiStore.hoveredTileY, uiStore.selectedTowerType)
        updateFxLayer(layers.fx, world, alpha)
      },
    }

    startGameLoop(simulation, renderer)

    // Handle commands dispatched from Vue UI
    window.addEventListener('game:command', (e) => {
      const cmd = (e as CustomEvent<Command>).detail
      simulation.getWorld().commandQueue.push(cmd)
    })

    // Handle restart — reload the page
    window.addEventListener('game:restart', () => {
      window.location.reload()
    })

    // Tower placement on canvas click
    pixiApp.stage.on('click', (e) => {
      if (uiStore.selectedTowerType === null) return
      const tile = camera.screenToTile(e.globalX, e.globalY)
      if (tile.x < 0 || tile.x >= 51 || tile.y < 0 || tile.y >= 51) return
      simulation.getWorld().commandQueue.push({
        type: 0, // CommandType.PLACE_TOWER
        towerType: uiStore.selectedTowerType,
        x: tile.x,
        y: tile.y,
        facing: uiStore.placementFacing,
      } as Command)
    })
  })
}
