<template>
  <!-- Fullscreen black canvas for the intro sequence -->
  <div class="loading-screen" @click="requestSkip">
    <div ref="canvasRef" class="loading-canvas" />
    <Transition name="skip-fade">
      <div v-if="showSkipHint" class="loading-skip">PRESS ANY KEY TO SKIP</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js'
import { GlitchFilter } from '@renderer/filters/GlitchFilter'
import { LoadingTimeline } from '@renderer/loadingTimeline'
import type { ScreenId } from '@renderer/loadingTimeline'

// Vite static asset imports — resolved to hashed URLs at build time
import dvdUrl from '../../assets/loadingscreen/DVD Projet Red.png'
import pixijsUrl from '../../assets/loadingscreen/PixiJS.png'
import logosUrl from '../../assets/loadingscreen/Logos.png'
import titleUrl from '../../assets/loadingscreen/Towerpunk.png'

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{ (e: 'done'): void }>()

// ── Template refs & reactive state ──────────────────────────────────────────
const canvasRef = ref<HTMLDivElement | null>(null)
const showSkipHint = ref(false)

// ── Module-level (non-reactive) state ────────────────────────────────────────
let pixiApp: Application | null = null
let emittedDone = false
let skipRequested = false
let skipHintTimer: ReturnType<typeof setTimeout> | null = null

/** Emit 'done' exactly once and stop the PixiJS ticker. */
function finish(): void {
  if (emittedDone) return
  emittedDone = true
  pixiApp?.ticker.stop()
  emit('done')
}

function requestSkip(): void {
  skipRequested = true
}

function onKeyDown(): void {
  skipRequested = true
}

// ── Mount ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  const container = canvasRef.value
  if (!container) return

  // Create a dedicated PixiJS app for the loading screen.
  // Kept separate from the game app so it can be fully destroyed after use.
  pixiApp = new Application()

  await pixiApp.init({
    background: '#000000',
    resizeTo: container,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  })

  pixiApp.canvas.style.display = 'block'
  pixiApp.canvas.style.width = '100%'
  pixiApp.canvas.style.height = '100%'
  container.appendChild(pixiApp.canvas)

  window.addEventListener('keydown', onKeyDown)

  // ── Load textures ──────────────────────────────────────────────────────
  const [dvdTex, pixijsTex, logosTex, titleTex] = await Promise.all([
    Assets.load<Texture>(dvdUrl as string),
    Assets.load<Texture>(pixijsUrl as string),
    Assets.load<Texture>(logosUrl as string),
    Assets.load<Texture>(titleUrl as string),
  ])

  const W = pixiApp.screen.width
  const H = pixiApp.screen.height

  // ── Glitch filter ──────────────────────────────────────────────────────
  const glitchFilter = new GlitchFilter()
  glitchFilter.padding = 20 // give room for the horizontal shear to sample without clipping

  // ── Scene structure ────────────────────────────────────────────────────
  //   stage
  //   ├── contentContainer  (logos, glitch filter applied)
  //   ├── streakGfx         (red horizontal scan-lines, front of logos)
  //   └── blackOverlay      (solid black flash for frame insertion)

  const contentContainer = new Container()
  contentContainer.filters = [glitchFilter]
  pixiApp.stage.addChild(contentContainer)

  const streakGfx = new Graphics()
  streakGfx.alpha = 0
  pixiApp.stage.addChild(streakGfx)

  const blackOverlay = new Graphics()
  blackOverlay.rect(0, 0, W, H)
  blackOverlay.fill({ color: 0x000000 })
  blackOverlay.alpha = 0
  pixiApp.stage.addChild(blackOverlay)

  // ── Build logo screens ─────────────────────────────────────────────────
  function makeLogoScreen(tex: Texture): Container {
    const c = new Container()
    const sprite = new Sprite(tex)
    sprite.anchor.set(0.5)
    // Fit inside 60% of the shorter viewport dimension
    const target = Math.min(W, H) * 0.6
    const scale = Math.min(target / tex.width, target / tex.height)
    sprite.scale.set(scale)
    sprite.position.set(W / 2, H / 2)
    c.addChild(sprite)
    c.alpha = 0
    c.visible = false
    return c
  }

  const dvdScreen = makeLogoScreen(dvdTex)
  const pixijsScreen = makeLogoScreen(pixijsTex)
  const logosScreen = makeLogoScreen(logosTex)
  const titleScreen = makeLogoScreen(titleTex)

  // ── Legal text screen (step 7) ─────────────────────────────────────────
  const legalScreen = new Container()

  const legalStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 13,
    fill: '#c41a1a',
    wordWrap: true,
    wordWrapWidth: Math.min(W * 0.72, 880),
    align: 'center',
    lineHeight: 21,
  })

  const legalText = new Text({
    text: [
      'All trademarks, service marks, trade names, logos, and product names referenced herein are the property of their respective owners.',
      '',
      'PixiJS is a trademark and/or registered trademark of the PixiJS team.',
      'Vue is a trademark of Evan You.',
      'Vite is a trademark of Voidzero Inc.',
      'Visual Studio Code is a trademark of Microsoft Corporation.',
      'GitHub Copilot are trademarks of GitHub, Inc.',
      '',
      'All marks are used for identification purposes only. No affiliation with, endorsement by, or sponsorship from any trademark owner is claimed or implied.',
    ].join('\n'),
    style: legalStyle,
  })
  legalText.anchor.set(0.5)
  legalText.position.set(W / 2, H / 2)
  legalScreen.addChild(legalText)
  legalScreen.alpha = 0
  legalScreen.visible = false

  contentContainer.addChild(dvdScreen)
  contentContainer.addChild(pixijsScreen)
  contentContainer.addChild(logosScreen)
  contentContainer.addChild(legalScreen)
  contentContainer.addChild(titleScreen)

  // Lookup for quick screen-by-id access
  const screens: Record<ScreenId, Container> = {
    dvd: dvdScreen,
    pixijs: pixijsScreen,
    logos: logosScreen,
    legal: legalScreen,
    title: titleScreen,
  }

  // ── Timeline ───────────────────────────────────────────────────────────
  const timeline = new LoadingTimeline()
  let streakY = 0
  let filterTime = 0

  // Show skip hint after 2 s
  skipHintTimer = setTimeout(() => {
    showSkipHint.value = true
  }, 2000)

  // ── Ticker loop ────────────────────────────────────────────────────────
  pixiApp.ticker.add((ticker) => {
    // User requested skip
    if (skipRequested) {
      finish()
      return
    }

    const dt = ticker.deltaMS

    const state = timeline.advance(dt)

    // ── Screen visibility ──────────────────────────────────────────────
    const screenIds: ScreenId[] = ['dvd', 'pixijs', 'logos', 'legal']
    for (const id of screenIds) {
      const s = screens[id]
      if (id === state.activeScreen) {
        s.visible = true
        s.alpha = state.screenAlpha

        // Subtle scale jitter at peak glitch (renderer-only, non-deterministic is fine)
        if (state.glitchIntensity > 0.4) {
          const j = 1 + (Math.random() - 0.5) * 0.025 * state.glitchIntensity
          s.scale.set(j)
        } else {
          s.scale.set(1)
        }
      } else {
        s.visible = false
        s.alpha = 0
        s.scale.set(1)
      }
    }

    // ── Glitch filter ──────────────────────────────────────────────────
    filterTime += dt * 0.001 // ms → seconds
    glitchFilter.intensity = state.glitchIntensity
    glitchFilter.time = filterTime

    // ── Streak overlay ─────────────────────────────────────────────────
    const streakAlpha = state.glitchIntensity * 0.22
    streakGfx.alpha = streakAlpha

    if (streakAlpha > 0.005) {
      streakY = (streakY + 1.8) % H
      streakGfx.clear()
      const lineCount = 28
      for (let i = 0; i < lineCount; i++) {
        const y = (streakY + i * (H / lineCount)) % H
        const lineAlpha = 0.08 + Math.random() * 0.18
        const lineHeight = 1 + Math.random() * 2
        streakGfx.rect(0, y, W, lineHeight)
        streakGfx.fill({ color: 0xff2020, alpha: lineAlpha })
      }
    }

    // ── Black frame insertion (authenticity — "drop frames") ──────────
    // At peak glitch, randomly insert fully black frames (~15% chance).
    if (state.glitchIntensity > 0.85 && Math.random() < 0.15) {
      blackOverlay.alpha = 1
    } else {
      blackOverlay.alpha = 0
    }

    // ── Sequence complete ──────────────────────────────────────────────
    if (state.done) {
      finish()
    }
  })
})

// ── Unmount ──────────────────────────────────────────────────────────────────
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (skipHintTimer !== null) clearTimeout(skipHintTimer)
  pixiApp?.destroy({ removeView: true })
  pixiApp = null
})
</script>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 10000;
  overflow: hidden;
  cursor: pointer;
}

.loading-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Skip hint — bottom-right, faint */
.loading-skip {
  position: absolute;
  bottom: 24px;
  right: 32px;
  font-family: monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: rgba(0, 204, 255, 0.45);
  pointer-events: none;
  user-select: none;
}

.skip-fade-enter-active {
  transition: opacity 0.6s ease;
}
.skip-fade-enter-from {
  opacity: 0;
}
</style>
