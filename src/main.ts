import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './ui/App.vue'
import { initPixi, getCameraContainer } from './renderer/pixiApp'
import { createGridLayer } from './renderer/layers/grid.layer'
import { createCamera } from './renderer/camera'
import { createSimulation } from './game/simulation'
import { startGameLoop } from './game/gameLoop'

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
    pixiApp.stage.on('pointermove', (e) => camera.onPointerMove(e))
    pixiApp.stage.on('pointerup', () => camera.onPointerUp())
    pixiApp.stage.on('pointerupoutside', () => camera.onPointerUp())

    // Keyboard pan
    const keysDown = new Set<string>()
    window.addEventListener('keydown', (e) => keysDown.add(e.code))
    window.addEventListener('keyup', (e) => keysDown.delete(e.code))

    // Create simulation
    const simulation = createSimulation(12345)

    // Start game loop
    const renderer = {
      draw(_alpha: number): void {
        camera.applyKeyPan(keysDown)
        // Layer updates will go here as systems are implemented
      },
    }

    startGameLoop(simulation, renderer)
  })
}
