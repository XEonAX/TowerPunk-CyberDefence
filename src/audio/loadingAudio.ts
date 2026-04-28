/**
 * LoadingAudio — plays sounds driven by LoadingScreen phase transitions.
 *
 * Instead of scheduling sounds at fixed millisecond offsets, LoadingScreen.vue
 * calls `onPhaseEnter(phaseIndex)` whenever the LoadingTimeline advances to a
 * new phase.  This keeps audio perfectly in sync with the visual timeline
 * regardless of frame rate or phase duration changes.
 *
 * Call `triggerLanding()` when the landing page appears.
 * Call `skipToLanding()` when the user skips the intro.
 */

import { audioManager } from './audioManager'
import { SoundId } from './audioAssets'

// ─── Phase → sound mapping (indices match PHASES in loadingTimeline.ts) ──────
//  0: dvd fade-in       → subtle glitch hiss
//  1: dvd hold          → (none)
//  2: dvd glitch-out    → glitch 2
//  3: pixijs glitch-in  → glitch 3
//  4: pixijs hold       → (none)
//  5: pixijs glitch-out → glitch 1
//  6: logos glitch-in   → glitch 4
//  7: logos hold        → (none)
//  8: logos glitch-out  → glitch 2
//  9: legal glitch-in   → glitch 3
// 10: legal hold        → (none)
// 11: legal glitch-out  → glitch 1
// 12: title glitch-in   → (none)
// 13: title hold        → (none)

const PHASE_SOUNDS: ReadonlyMap<number, SoundId> = new Map([
  [0,  SoundId.LOADING_GLITCH_1],
  [2,  SoundId.LOADING_GLITCH_2],
  [3,  SoundId.LOADING_GLITCH_3],
  [5,  SoundId.LOADING_GLITCH_1],
  [6,  SoundId.LOADING_GLITCH_4],
  [8,  SoundId.LOADING_GLITCH_2],
  [9,  SoundId.LOADING_GLITCH_3],
  [11, SoundId.LOADING_GLITCH_1],
])

// ─── LoadingAudio class ───────────────────────────────────────────────────────

export class LoadingAudio {
  private _landingFired = false
  private _lastPhase = -1
  private _timers: ReturnType<typeof setTimeout>[] = []

  /**
   * Notify that the timeline has entered a new phase.
   * Plays the mapped sound (if any) on the first call for each phase index.
   */
  onPhaseEnter(phaseIndex: number): void {
    if (phaseIndex === this._lastPhase) return
    this._lastPhase = phaseIndex

    const soundId = PHASE_SOUNDS.get(phaseIndex)
    if (soundId !== undefined) {
      audioManager.play(soundId)
    }
  }

  /**
   * Play the landing sting + bass hit.
   * Called by LoadingScreen when the landing page becomes visible.
   */
  triggerLanding(): void {
    if (this._landingFired) return
    this._landingFired = true
    audioManager.play(SoundId.LOADING_LANDING_STING)
    const t = setTimeout(() => audioManager.play(SoundId.LOADING_LANDING_BASS), 200)
    this._timers.push(t)
  }

  /**
   * Skip to the landing sting sounds immediately.
   * Cancels any pending timers and plays phaser-up + landing sting + bass.
   * Safe to call even if the sequence has already reached those sounds naturally.
   */
  skipToLanding(): void {
    if (this._landingFired) return
    this._landingFired = true
    this.cancel()
    const t1 = setTimeout(() => audioManager.play(SoundId.LOADING_PHASER_UP),     0)
    const t2 = setTimeout(() => audioManager.play(SoundId.LOADING_LANDING_STING), 300)
    const t3 = setTimeout(() => audioManager.play(SoundId.LOADING_LANDING_BASS),  500)
    this._timers.push(t1, t2, t3)
  }

  /**
   * Cancel all pending timers (call in onUnmounted).
   */
  cancel(): void {
    for (const t of this._timers) clearTimeout(t)
    this._timers.length = 0
  }
}
