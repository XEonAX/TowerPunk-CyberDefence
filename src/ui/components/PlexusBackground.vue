<template>
  <div ref="containerRef" class="plexus-bg" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Application, Graphics } from 'pixi.js'

const containerRef = ref<HTMLDivElement | null>(null)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  /** 0 = clean cyan, 1 = fully corrupted red */
  corruption: number
  /** Whether this particle is actively being infected */
  corrupting: boolean
}

const PARTICLE_COUNT     = 290
const MAX_LINK_DIST      = 160
const MAX_LINK_DIST_SQ   = MAX_LINK_DIST * MAX_LINK_DIST
const PARTICLE_SPEED     = 0.55
const DOT_RADIUS         = 2
const LINE_ALPHA_SCALE   = 0.55
const CYAN               = 0x00ccff
const RED                = 0xff2200
const REPULSION_RADIUS   = 100
const REPULSION_STRENGTH = 0.15
const MAX_SPEED          = 0.6
const DAMPING            = 0.97

/** How fast a node's corruption value climbs per frame (60fps → ~20s per node). */
const CORRUPT_RATE     = 0.0008
/** Source must reach this corruption level before it can spread to neighbours. */
const SPREAD_THRESHOLD = 0.2
/** Per-frame probability that an in-range clean node picks up the infection. */
const SPREAD_CHANCE    = 0.0014

/** Linear interpolation between two packed RGB colours. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8)  |
     Math.round(ab + (bb - ab) * t)
  )
}

let pixiApp: Application | null = null
let particles: Particle[] = []

let pointerX = NaN
let pointerY = NaN

// Local xorshift128 — renderer-layer code must not import World
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
      corruption: 0,
      corrupting: false,
    }
  })

  // Seed corruption from the most isolated node — the one whose nearest
  // neighbour is farthest away (i.e. the node farthest from everyone).
  let seedIdx   = 0
  let maxMinDistSq = -1
  for (let i = 0; i < particles.length; i++) {
    let minDistSq = Infinity
    for (let j = 0; j < particles.length; j++) {
      if (i === j) continue
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dSq = dx * dx + dy * dy
      if (dSq < minDistSq) minDistSq = dSq
    }
    if (minDistSq > maxMinDistSq) {
      maxMinDistSq = minDistSq
      seedIdx = i
    }
  }
  particles[seedIdx].corrupting = true
}

onMounted(async () => {
  const container = containerRef.value!

  pixiApp = new Application()
  await pixiApp.init({
    backgroundAlpha: 0,
    resizeTo: container,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  })

  pixiApp.canvas.style.display = 'block'
  pixiApp.canvas.style.width   = '100%'
  pixiApp.canvas.style.height  = '100%'
  container.appendChild(pixiApp.canvas)

  function toLogical(clientX: number, clientY: number): void {
    const rect   = pixiApp!.canvas.getBoundingClientRect()
    const scaleX = pixiApp!.screen.width  / rect.width
    const scaleY = pixiApp!.screen.height / rect.height
    pointerX = (clientX - rect.left) * scaleX
    pointerY = (clientY - rect.top)  * scaleY
  }

  pixiApp.canvas.addEventListener('pointermove',  (e) => toLogical(e.clientX, e.clientY))
  pixiApp.canvas.addEventListener('pointerleave', () => { pointerX = NaN; pointerY = NaN })
  pixiApp.canvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const t = e.touches[0]
    toLogical(t.clientX, t.clientY)
  }, { passive: false })
  pixiApp.canvas.addEventListener('touchend', () => { pointerX = NaN; pointerY = NaN })

  const gfx = new Graphics()
  pixiApp.stage.addChild(gfx)

  initParticles(pixiApp.screen.width, pixiApp.screen.height)
  pixiApp.renderer.on('resize', () => {
    initParticles(pixiApp!.screen.width, pixiApp!.screen.height)
  })

  pixiApp.ticker.add(() => {
    const sw = pixiApp!.screen.width
    const sh = pixiApp!.screen.height
    const hasPointer = !Number.isNaN(pointerX)
    const repRadSq   = REPULSION_RADIUS * REPULSION_RADIUS

    gfx.clear()

    // ── Move, repel, damp & bounce ───────────────────────────────────
    for (const p of particles) {
      if (hasPointer) {
        const dx     = p.x - pointerX
        const dy     = p.y - pointerY
        const distSq = dx * dx + dy * dy
        if (distSq > 0 && distSq < repRadSq) {
          const dist  = Math.sqrt(distSq)
          const t     = dist / REPULSION_RADIUS
          const force = (1 - t) * (1 - t) * REPULSION_STRENGTH
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }
      }

      p.vx *= DAMPING
      p.vy *= DAMPING

      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      if (spd > MAX_SPEED) {
        const inv = MAX_SPEED / spd
        p.vx *= inv
        p.vy *= inv
      }
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

    // ── Corruption spreading ───────────────────────────────────────
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (!p.corrupting) continue

      // Grow this node's corruption
      if (p.corruption < 1) p.corruption = Math.min(1, p.corruption + CORRUPT_RATE)

      // Once sufficiently corrupted, try to infect nearby clean nodes
      if (p.corruption >= SPREAD_THRESHOLD) {
        for (let j = 0; j < particles.length; j++) {
          if (i === j || particles[j].corrupting) continue
          const dx = p.x - particles[j].x
          const dy = p.y - particles[j].y
          if (dx * dx + dy * dy < MAX_LINK_DIST_SQ && Math.random() < SPREAD_CHANCE) {
            particles[j].corrupting = true
          }
        }
      }
    }

    // ── Lines ───────────────────────────────────────────────────
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx     = particles[i].x - particles[j].x
        const dy     = particles[i].y - particles[j].y
        const distSq = dx * dx + dy * dy
        if (distSq < MAX_LINK_DIST_SQ) {
          const alpha = (1 - distSq / MAX_LINK_DIST_SQ) * LINE_ALPHA_SCALE
          // Line colour is the corruption of whichever endpoint is more infected
          const c = Math.max(particles[i].corruption, particles[j].corruption)
          const lineColor = lerpColor(CYAN, RED, c)
          gfx.moveTo(particles[i].x, particles[i].y)
          gfx.lineTo(particles[j].x, particles[j].y)
          gfx.stroke({ color: lineColor, alpha, width: 0.8 })
        }
      }
    }

    // ── Dots ────────────────────────────────────────────────────
    for (const p of particles) {
      gfx.circle(p.x, p.y, DOT_RADIUS)
      gfx.fill({ color: lerpColor(CYAN, RED, p.corruption), alpha: 0.85 })
    }
  })
})

onUnmounted(() => {
  pixiApp?.destroy({ removeView: true })
  pixiApp = null
  pointerX = NaN
  pointerY = NaN
})
</script>

<style scoped>
.plexus-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
