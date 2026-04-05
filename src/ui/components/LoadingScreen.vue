<template>
  <!-- Fullscreen black canvas for the intro sequence -->
  <div class="loading-screen" @click="onScreenClick">
    <!-- Intro canvas — hidden once landing phase begins -->
    <div ref="canvasRef" class="loading-canvas" :class="{ 'loading-canvas--hidden': landingVisible }" />

    <!-- Skip hint (shown during intro only) -->
    <Transition name="skip-fade">
      <div v-if="showSkipHint && !landingVisible" class="loading-skip">PRESS ANY KEY TO SKIP</div>
    </Transition>

    <!-- Landing phase — plexus background + title + start button -->
    <Transition name="landing-in">
      <div v-if="landingVisible" class="loading-landing">
        <PlexusBackground />
        <div class="loading-landing__content">
          <div class="loading-landing__title">
            <img
              src="../../assets/loadingscreen/Towerpunk.png"
              alt="TowerPunk: Cyber Defence"
              class="loading-landing__title-img"
            />
          </div>
          <div class="loading-landing__start-wrap" :class="{ visible: startBtnVisible }">
            <div class="loading-landing__meta">The &lt;center&gt; cannot hold it is too late.</div>
            <button class="loading-landing__start" @click.stop="onStartClicked">
              PRESS
              <span class="loading-landing__key" aria-label="Spacebar">
                <svg viewBox="0 0 36 24" width="22" height="15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="34" height="22" rx="3" stroke="currentColor" stroke-width="1.8"/>
                  <rect x="8" y="15" width="20" height="4" rx="1.5" fill="currentColor"/>
                </svg>
              </span>
              TO START
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js'
import { GlitchFilter } from '@renderer/filters/GlitchFilter'
import { LoadingTimeline } from '@renderer/loadingTimeline'
import type { ScreenId } from '@renderer/loadingTimeline'
import PlexusBackground from './PlexusBackground.vue'

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
const landingVisible = ref(false)
const startBtnVisible = ref(false)

// ── Module-level (non-reactive) state ────────────────────────────────────────
let pixiApp: Application | null = null
let emittedDone = false
let skipRequested = false
let skipHintTimer: ReturnType<typeof setTimeout> | null = null
let startBtnTimer: ReturnType<typeof setTimeout> | null = null

/** Emit 'done' exactly once. Called only when the user clicks PRESS TO START. */
function finish(): void {
  if (emittedDone) return
  emittedDone = true
  emit('done')
}

/** Transition from intro sequence into the landing (plexus + start) phase. */
function enterLanding(): void {
  if (landingVisible.value) return
  pixiApp?.ticker.stop()
  landingVisible.value = true
  // Stagger in the start button
  startBtnTimer = setTimeout(() => { startBtnVisible.value = true }, 600)
}

/** Called when user clicks the screen during the intro sequence (skip). */
function onScreenClick(): void {
  if (!landingVisible.value) {
    skipRequested = true
  }
}

/** Called when the user explicitly clicks PRESS TO START. */
function onStartClicked(): void {
  finish()
}

function onKeyDown(e: KeyboardEvent): void {
  if (landingVisible.value) {
    // In landing phase: Enter or Space triggers start
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      finish()
    }
  } else {
    // In intro phase: any key skips to landing
    skipRequested = true
  }
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
    // User requested skip — go to landing phase rather than straight to menu
    if (skipRequested) {
      skipRequested = false
      enterLanding()
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

    // ── Sequence complete → enter landing phase ───────────────────────
    if (state.done) {
      enterLanding()
    }
  })
})

// ── Unmount ──────────────────────────────────────────────────────────────────
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (skipHintTimer !== null) clearTimeout(skipHintTimer)
  if (startBtnTimer !== null) clearTimeout(startBtnTimer)
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
  transition: opacity 0.4s ease;
}
.loading-canvas--hidden {
  opacity: 0;
  pointer-events: none;
}

/* ── Landing phase ────────────────────────────────────────────────────────── */
.loading-landing {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #020610;
}

.loading-landing__content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 0 24px;
  width: 100%;
  max-width: 700px;
  pointer-events: none;
  z-index: 1;
}

.loading-landing__title {
  width: 100%;
  max-width: 540px;
}

.loading-landing__title-img {
  width: 100%;
  height: auto;
  filter:
    drop-shadow(0 0 18px rgba(0, 204, 255, 0.7))
    drop-shadow(0 0 40px rgba(0, 68, 170, 0.5));
}

.loading-landing__start-wrap {
  pointer-events: auto;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.9s ease, transform 0.9s ease;
}

.loading-landing__start-wrap.visible {
  opacity: 1;
  transform: translateY(0);
}

.loading-landing__meta {
  font-family: monospace;
  font-size: 6px;
  letter-spacing: 0.2em;
  color: #c0392b;
  opacity: 0.6;
  padding: 0 1px 3px;
  text-transform: uppercase;
}

.loading-landing__start {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 22px;
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #ff3c28;
  background: rgba(6, 2, 2, 0.82);
  border: 1.5px solid #d42c1a;
  border-radius: 2px;
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  box-shadow:
    0 0 8px rgba(212, 44, 26, 0.35),
    inset 0 0 10px rgba(212, 44, 26, 0.05);
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.loading-landing__start-wrap.visible .loading-landing__start {
  animation: start-pulse 2.4s ease-in-out 0.9s infinite;
}

.loading-landing__start:hover {
  color: #ff6050;
  border-color: #ff3c28;
  background: rgba(20, 4, 2, 0.9);
  box-shadow:
    0 0 18px rgba(255, 60, 40, 0.5),
    inset 0 0 12px rgba(255, 60, 40, 0.08);
}

.loading-landing__start:active {
  background: rgba(40, 8, 4, 0.95);
}

.loading-landing__key {
  display: inline-flex;
  align-items: center;
  color: #00ccff;
  filter: drop-shadow(0 0 3px rgba(0, 204, 255, 0.7));
  flex-shrink: 0;
}

@keyframes start-pulse {
  0%,  100% {
    box-shadow: 0 0 6px rgba(212, 44, 26, 0.3), inset 0 0 10px rgba(212, 44, 26, 0.04);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 60, 40, 0.6), inset 0 0 16px rgba(255, 60, 40, 0.09);
  }
}

/* Landing fade-in transition */
.landing-in-enter-active {
  transition: opacity 0.7s ease;
}
.landing-in-enter-from {
  opacity: 0;
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
