<template>
  <div class="landing">
    <!-- Plexus background — PixiJS canvas mounted here -->
    <div ref="plexusRef" class="landing__canvas" />

    <!-- Content stack -->
    <div class="landing__content">
      <div class="landing__dvd" :class="{ visible: dvdVisible }">
        <img src="../../assets/DVD-Projet.svg" alt="DVD Project Presents" class="landing__dvd-img" />
      </div>

      <div class="landing__title" :class="{ visible: titleVisible }">
        <img src="../../assets/Towerpunk.svg" alt="TowerPunk: Cyber Defence" class="landing__title-img" />
      </div>

      <div class="landing__start-wrap" :class="{ visible: btnVisible }">
        <div class="landing__start-meta">BLACKWALL PROTOCOL &nbsp;&nbsp; v1.0</div>
        <button class="landing__start" @click="$emit('start')">
          PRESS
          <span class="landing__key" aria-label="Spacebar">
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Application, Graphics } from 'pixi.js'

defineEmits<{ (e: 'start'): void }>()

// ── Animation visibility state ────────────────────────────────────────────────
const dvdVisible   = ref(false)
const titleVisible = ref(false)
const btnVisible   = ref(false)

// ── Plexus (PixiJS) ───────────────────────────────────────────────────────────
const plexusRef = ref<HTMLDivElement | null>(null)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
}

const PARTICLE_COUNT      = 190
const MAX_LINK_DIST       = 160   // logical px — max distance to draw a line
const PARTICLE_SPEED      = 0.55  // logical px / frame
const DOT_RADIUS          = 2     // logical px
const LINE_ALPHA_SCALE    = 0.55  // max line opacity
const CYAN                = 0x00ccff
const REPULSION_RADIUS    = 100   // logical px — pointer influence zone
const REPULSION_STRENGTH  = 0.15  // peak impulse at zero distance
const MAX_SPEED           = 0.6   // logical px / frame — velocity cap
const DAMPING             = 0.97  // per-frame velocity decay (returns to idle)

let pixiApp: Application | null = null
let particles: Particle[] = []

// Pointer position in PixiJS logical coordinates. NaN = off-screen / inactive.
let pointerX = NaN
let pointerY = NaN

// ── Local xorshift128 — same algorithm as rng.ts but with its own state ──────
// The landing page is renderer-layer code; it must not import World.
// Seed matches the default game seed for consistency.
const _rng = new Uint32Array([0x6C62272E, 0x07BB0142, 0x62B82175, 0x6295C58D])
function rngNext(): number {
  let t = _rng[3]
  t ^= t << 11
  t ^= t >>> 8
  _rng[3] = _rng[2]; _rng[2] = _rng[1]; _rng[1] = _rng[0]
  t ^= _rng[0]
  t ^= _rng[0] >>> 19
  _rng[0] = t
  return t >>> 0
}
function rngFloat(): number { return rngNext() / 0x100000000 }

function initParticles(w: number, h: number): void {
  particles = Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = rngFloat() * Math.PI * 2
    const speed = (0.5 + rngFloat() * 0.5) * PARTICLE_SPEED
    return {
      x:  rngFloat() * w,
      y:  rngFloat() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    }
  })
}

// ── Timers for logo reveal sequence ──────────────────────────────────────────
let t1: ReturnType<typeof setTimeout>
let t2: ReturnType<typeof setTimeout>
let t3: ReturnType<typeof setTimeout>

onMounted(async () => {
  const container = plexusRef.value!

  // Create PixiJS application with transparent background so the dark CSS
  // background of .landing shows through.
  pixiApp = new Application()
  await pixiApp.init({
    backgroundAlpha: 0,
    resizeTo: container,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  })

  // Make the canvas fill the container
  pixiApp.canvas.style.display = 'block'
  pixiApp.canvas.style.width   = '100%'
  pixiApp.canvas.style.height  = '100%'
  container.appendChild(pixiApp.canvas)

  // ── Pointer tracking (mouse + touch) ────────────────────────────────────
  // getBoundingClientRect lets us convert page coords → logical canvas coords
  function toLogical(clientX: number, clientY: number): void {
    const rect = pixiApp!.canvas.getBoundingClientRect()
    const scaleX = pixiApp!.screen.width  / rect.width
    const scaleY = pixiApp!.screen.height / rect.height
    pointerX = (clientX - rect.left) * scaleX
    pointerY = (clientY - rect.top)  * scaleY
  }

  pixiApp.canvas.addEventListener('pointermove', (e) => toLogical(e.clientX, e.clientY))
  pixiApp.canvas.addEventListener('pointerleave', () => { pointerX = NaN; pointerY = NaN })

  pixiApp.canvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const t = e.touches[0]
    toLogical(t.clientX, t.clientY)
  }, { passive: false })
  pixiApp.canvas.addEventListener('touchend',   () => { pointerX = NaN; pointerY = NaN })

  // Single Graphics object — cleared and redrawn every tick
  const gfx = new Graphics()
  pixiApp.stage.addChild(gfx)

  initParticles(pixiApp.screen.width, pixiApp.screen.height)

  // Reinitialise particles on resize so they fill the new dimensions
  pixiApp.renderer.on('resize', () => {
    initParticles(pixiApp!.screen.width, pixiApp!.screen.height)
  })

  // ── Ticker: move particles, draw links then dots ─────────────────────────
  pixiApp.ticker.add(() => {
    const sw = pixiApp!.screen.width
    const sh = pixiApp!.screen.height
    const maxDistSq = MAX_LINK_DIST * MAX_LINK_DIST

    gfx.clear()

    // ── Move, repel, damp & bounce ────────────────────────────────────────
    const hasPointer = !Number.isNaN(pointerX)
    const repRadSq   = REPULSION_RADIUS * REPULSION_RADIUS

    for (const p of particles) {
      // Repulsion from pointer
      if (hasPointer) {
        const dx   = p.x - pointerX
        const dy   = p.y - pointerY
        const distSq = dx * dx + dy * dy
        if (distSq > 0 && distSq < repRadSq) {
          const dist  = Math.sqrt(distSq)
          const t     = dist / REPULSION_RADIUS          // 0 at cursor → 1 at edge
          const force = (1 - t) * (1 - t) * REPULSION_STRENGTH   // quadratic ease-out
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }
      }

      // Velocity damping — nudges particles back toward idle speed
      p.vx *= DAMPING
      p.vy *= DAMPING

      // Speed cap
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      if (spd > MAX_SPEED) {
        const inv = MAX_SPEED / spd
        p.vx *= inv
        p.vy *= inv
      }

      // Ensure particles keep a minimum drift so they don't fully stop
      if (spd < PARTICLE_SPEED * 0.3 && spd > 0) {
        const inv = (PARTICLE_SPEED * 0.3) / spd
        p.vx *= inv
        p.vy *= inv
      }

      p.x += p.vx
      p.y += p.vy
      if (p.x < 0)  { p.x = 0;  p.vx =  Math.abs(p.vx) }
      if (p.x > sw) { p.x = sw; p.vx = -Math.abs(p.vx) }
      if (p.y < 0)  { p.y = 0;  p.vy =  Math.abs(p.vy) }
      if (p.y > sh) { p.y = sh; p.vy = -Math.abs(p.vy) }
    }

    // ── Lines ────────────────────────────────────────────────────────────
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const distSq = dx * dx + dy * dy
        if (distSq < maxDistSq) {
          const alpha = (1 - distSq / maxDistSq) * LINE_ALPHA_SCALE
          gfx.moveTo(particles[i].x, particles[i].y)
          gfx.lineTo(particles[j].x, particles[j].y)
          gfx.stroke({ color: CYAN, alpha, width: 0.8 })
        }
      }
    }

    // ── Dots ─────────────────────────────────────────────────────────────
    for (const p of particles) {
      gfx.circle(p.x, p.y, DOT_RADIUS)
      gfx.fill({ color: CYAN, alpha: 0.85 })
    }
  })

  // Staggered reveal
  t1 = setTimeout(() => { dvdVisible.value   = true }, 600)
  t2 = setTimeout(() => { titleVisible.value = true }, 1600)
  t3 = setTimeout(() => { btnVisible.value   = true }, 2600)
})

onUnmounted(() => {
  pixiApp?.destroy({ removeView: true })
  pixiApp = null
  pointerX = NaN
  pointerY = NaN
  clearTimeout(t1)
  clearTimeout(t2)
  clearTimeout(t3)
})
</script>

<style scoped>
/* ── Wrapper ────────────────────────────────────────────────────────────── */
.landing {
  position: fixed;
  inset: 0;
  background: #020610;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  overflow: hidden;
}

/* ── Plexus canvas ──────────────────────────────────────────────────────── */
.landing__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ── Content column ─────────────────────────────────────────────────────── */
.landing__content {
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

/* ── DVD "presents" logo ────────────────────────────────────────────────── */
.landing__dvd {
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 1s ease, transform 1s ease;
  width: 100%;
  max-width: 360px;
}

.landing__dvd.visible {
  opacity: 1;
  transform: translateY(0);
}

.landing__dvd-img {
  width: 100%;
  height: auto;
  /* recolour the SVG to cyan if it uses currentColor */
  filter: drop-shadow(0 0 8px rgba(0, 204, 255, 0.55));
}

/* ── TowerPunk title ─────────────────────────────────────────────────────── */
.landing__title {
  opacity: 0;
  transform: translateY(0) scale(0.95);
  transition: opacity 1.1s ease, transform 1.1s ease;
  width: 100%;
  max-width: 540px;
}

.landing__title.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.landing__title-img {
  width: 100%;
  height: auto;
  filter:
    drop-shadow(0 0 18px rgba(0, 204, 255, 0.7))
    drop-shadow(0 0 40px rgba(0, 68, 170, 0.5));
}

.landing__start-wrap {
  pointer-events: auto;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: stretch;

  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.9s ease, transform 0.9s ease;
}

.landing__start-wrap.visible {
  opacity: 1;
  transform: translateY(0);
}

.landing__start-meta {
  font-family: monospace;
  font-size: 8px;
  letter-spacing: 0.2em;
  color: #c0392b;
  opacity: 0.6;
  padding: 0 1px 3px;
  text-transform: uppercase;
}

.landing__start {
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

  animation: none;
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.landing__start-wrap.visible .landing__start {
  animation: start-pulse 2.4s ease-in-out 0.9s infinite;
}

.landing__start:hover {
  color: #ff6050;
  border-color: #ff3c28;
  background: rgba(20, 4, 2, 0.9);
  box-shadow:
    0 0 18px rgba(255, 60, 40, 0.5),
    inset 0 0 12px rgba(255, 60, 40, 0.08);
}

.landing__start:active {
  background: rgba(40, 8, 4, 0.95);
}

.landing__key {
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
</style>
