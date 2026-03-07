import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './ui/App.vue'
import type { Command } from './game/ecs/world'
import { towerAtTile, enemyAtTile, gatewayAtTile, CommandType } from './game/ecs/world'
import { TowerType } from './game/ecs/component'
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
        // Sync inspected entity stats for non-tower inspections
        if (uiStore.inspectedKind === 'enemy') {
          gameStore.syncInspectedEnemy(world, uiStore.inspectedEid)
        } else if (uiStore.inspectedKind === 'gateway') {
          gameStore.syncInspectedGateway(world, uiStore.inspectedEid)
        } else {
          gameStore.syncInspectedEnemy(world, null)
          gameStore.syncInspectedGateway(world, null)
        }
        // Update render layers
        updateTowerLayer(layers.towers, world, alpha, uiStore.selectedTowerEid)
        updateEnemyLayer(layers.enemies, world, alpha)
        updatePickupLayer(layers.pickups, world, alpha)
        updateGhostLayer(layers.ghost, world, uiStore.hoveredTileX, uiStore.hoveredTileY, uiStore.selectedTowerType, uiStore.placementFacing, uiStore.placementLevel)
        updateFxLayer(layers.fx, world, alpha)
      },
    }

    startGameLoop(simulation, renderer, () => uiStore.gameSpeed)

    // Handle commands dispatched from Vue UI
    window.addEventListener('game:command', (e) => {
      const cmd = (e as CustomEvent<Command>).detail
      simulation.getWorld().commandQueue.push(cmd)
    })

    // Handle restart — reload the page
    window.addEventListener('game:restart', () => {
      window.location.reload()
    })

    // Tower placement / selection on canvas click
    pixiApp.stage.on('click', (e) => {
      const tile = camera.screenToTile(e.globalX, e.globalY)
      if (tile.x < 0 || tile.x >= 51 || tile.y < 0 || tile.y >= 51) return

      const world = simulation.getWorld()

      if (uiStore.selectedTowerType !== null) {
        // Check if an existing tower occupies this tile — if so, inspect it instead of placing
        const existingEid = towerAtTile(world, tile.x, tile.y)
        if (existingEid !== null) {
          uiStore.selectTowerInstance(existingEid)
        } else if (uiStore.selectedTowerType === TowerType.FIREWALL) {
          // Firewall requires a linked pair — hover tile is the walkable gap §5.2.1
          // Offsets: [t1dx, t1dy, t2dx, t2dy] per Dir value (0=Vertical, 2=Horizontal, 4=Diag↗↙, 7=Diag↘↖)
          const FW_OFFSETS = [
            [ 0, -1,  0,  1],  // 0: N  → Vertical
            [ 0, -1,  0,  1],  // 1: S  → Vertical (same)
            [-1,  0,  1,  0],  // 2: E  → Horizontal
            [-1,  0,  1,  0],  // 3: W  → Horizontal (same)
            [-1,  1,  1, -1],  // 4: NE → Diagonal ↗↙
            [-1, -1,  1,  1],  // 5: SE → Diagonal ↘↖
            [-1,  1,  1, -1],  // 6: SW → Diagonal ↗↙ (same)
            [-1, -1,  1,  1],  // 7: NW → Diagonal ↘↖ (same)
          ] as const
          const [t1dx, t1dy, t2dx, t2dy] = FW_OFFSETS[uiStore.placementFacing] ?? FW_OFFSETS[0]
          const gapX = tile.x
          const gapY = tile.y
          const t1 = { x: gapX + t1dx, y: gapY + t1dy }
          const t2 = { x: gapX + t2dx, y: gapY + t2dy }
          world.commandQueue.push({
            type: CommandType.PLACE_FIREWALL,
            t1,
            gap: { x: gapX, y: gapY },
            t2,
            level: uiStore.placementLevel,
          } as Command)
        } else {
          // Placing a regular tower
          world.commandQueue.push({
            type: CommandType.PLACE_TOWER,
            towerType: uiStore.selectedTowerType,
            x: tile.x,
            y: tile.y,
            facing: uiStore.placementFacing,
            level: uiStore.placementLevel,
          } as Command)
        }
      } else {
        // Priority: tower > gateway > enemy
        const towerEid = towerAtTile(world, tile.x, tile.y)
        if (towerEid !== null) {
          uiStore.selectTowerInstance(towerEid)
        } else {
          const gwEid = gatewayAtTile(world, tile.x, tile.y)
          if (gwEid !== null) {
            uiStore.selectGateway(gwEid)
          } else {
            const enemyEid = enemyAtTile(world, tile.x, tile.y)
            if (enemyEid !== null) {
              uiStore.selectEnemy(enemyEid)
            } else {
              uiStore.clearInspection()
            }
          }
        }
      }
    })
  })
}
