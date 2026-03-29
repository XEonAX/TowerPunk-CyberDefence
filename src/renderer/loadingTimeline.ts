/**
 * Loading Screen Timeline Controller
 *
 * Drives the 9-step Cyberpunk-style intro sequence described in docs/loadingscreen.md.
 * Each call to advance(dt) returns the current render state for that frame.
 *
 * Phase choreography per transition type:
 *
 *   fade-in     →  alpha 0→1, no glitch
 *   hold        →  alpha 1,   no glitch
 *   glitch-out  →  glitch ramps 0→1 (58%), snaps black (17%), glitch subsides (25%)
 *   glitch-in   →  black with glitch (25%), screen snaps in (17%), glitch subsides (58%)
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ScreenId = 'dvd' | 'pixijs' | 'logos' | 'legal' | 'title'

export interface TimelineState {
  /** Which screen is currently active (null = fully black). */
  activeScreen: ScreenId | null
  /** Alpha [0, 1] to apply to the active screen container. */
  screenAlpha: number
  /** Glitch filter intensity [0, 1]. */
  glitchIntensity: number
  /** True when the full sequence has completed — emit 'done'. */
  done: boolean
}

type PhaseType = 'fade-in' | 'hold' | 'glitch-out' | 'glitch-in'

interface Phase {
  /** Which screen is visible during this phase. */
  screen: ScreenId
  type: PhaseType
  /** Duration in milliseconds. */
  duration: number
}

// ── Phase sequence ───────────────────────────────────────────────────────────
// Steps 1–8 of docs/loadingscreen.md.
// Step 9 (fade in start menu) is handled by App.vue after 'done' is emitted.

const PHASES: readonly Phase[] = [
  // Step 1: Fade in DVD Projet Red
  { screen: 'dvd',    type: 'fade-in',    duration: 800  },
  { screen: 'dvd',    type: 'hold',       duration: 1400 },
  // Step 2: Glitch out DVD logo
  { screen: 'dvd',    type: 'glitch-out', duration: 600  },
  // Step 3: Glitch in PixiJS logo
  { screen: 'pixijs', type: 'glitch-in',  duration: 600  },
  { screen: 'pixijs', type: 'hold',       duration: 1400 },
  // Step 4: Glitch out PixiJS logo
  { screen: 'pixijs', type: 'glitch-out', duration: 600  },
  // Step 5: Glitch in Logos screen
  { screen: 'logos',  type: 'glitch-in',  duration: 600  },
  { screen: 'logos',  type: 'hold',       duration: 1800 },
  // Step 6: Glitch out Logos screen
  { screen: 'logos',  type: 'glitch-out', duration: 600  },
  // Step 7: Glitch in Legal text
  { screen: 'legal',  type: 'glitch-in',  duration: 600  },
  { screen: 'legal',  type: 'hold',       duration: 2800 },
  // Step 8: Glitch out Legal text
  { screen: 'legal',  type: 'glitch-out', duration: 600  },
  // Step 9: Glitch in TowerPunk title → sequence ends, landing page appears
  { screen: 'title',  type: 'glitch-in',  duration: 700  },
  { screen: 'title',  type: 'hold',       duration: 500  },
]

// ── Controller ──────────────────────────────────────────────────────────────

export class LoadingTimeline {
  private phaseIndex   = 0
  private phaseElapsed = 0  // ms elapsed within current phase
  private _done        = false

  /**
   * Advance the timeline by `dt` milliseconds and return the resulting render state.
   * Safe to call every frame (including when already done).
   */
  advance(dt: number): TimelineState {
    if (this._done) {
      return { activeScreen: null, screenAlpha: 0, glitchIntensity: 0, done: true }
    }

    this.phaseElapsed += dt

    // Consume completed phases
    while (
      this.phaseIndex < PHASES.length &&
      this.phaseElapsed >= PHASES[this.phaseIndex].duration
    ) {
      this.phaseElapsed -= PHASES[this.phaseIndex].duration
      this.phaseIndex++
    }

    // All phases complete → signal done
    if (this.phaseIndex >= PHASES.length) {
      this._done = true
      return { activeScreen: null, screenAlpha: 0, glitchIntensity: 0, done: true }
    }

    const phase = PHASES[this.phaseIndex]
    const t     = phase.duration > 0
      ? Math.min(this.phaseElapsed / phase.duration, 1)
      : 1

    let screenAlpha    = 1
    let glitchIntensity = 0

    switch (phase.type) {
      case 'fade-in':
        // Simple linear alpha fade, no glitch.
        screenAlpha     = t
        glitchIntensity = 0
        break

      case 'hold':
        // Fully visible, no glitch.
        screenAlpha     = 1
        glitchIntensity = 0
        break

      case 'glitch-out':
        // 0–58%  : ramp glitch 0→1, screen visible
        // 58–75% : peak glitch, screen snaps to black (abrupt — no easing)
        // 75–100%: glitch ramps 1→0, black screen
        if (t < 0.58) {
          glitchIntensity = t / 0.58
          screenAlpha     = 1
        } else if (t < 0.75) {
          glitchIntensity = 1
          screenAlpha     = 0
        } else {
          glitchIntensity = 1 - (t - 0.75) / 0.25
          screenAlpha     = 0
        }
        break

      case 'glitch-in':
        // 0–25%  : black + full glitch (screen not yet visible)
        // 25–42% : screen snaps in, full glitch
        // 42–100%: glitch ramps 1→0, screen stays visible
        if (t < 0.25) {
          glitchIntensity = 1
          screenAlpha     = 0
        } else if (t < 0.42) {
          glitchIntensity = 1
          screenAlpha     = 1
        } else {
          glitchIntensity = 1 - (t - 0.42) / 0.58
          screenAlpha     = 1
        }
        break
    }

    return {
      activeScreen:    phase.screen,
      screenAlpha:     Math.max(0, Math.min(1, screenAlpha)),
      glitchIntensity: Math.max(0, Math.min(1, glitchIntensity)),
      done:            false,
    }
  }

  /** Immediately end the sequence (e.g. user pressed skip). */
  skip(): void {
    this._done = true
  }

  get isDone(): boolean {
    return this._done
  }
}
