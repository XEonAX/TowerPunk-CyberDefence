/**
 * AudioManager
 *
 * Singleton Howler.js wrapper. Manages all Howl instances keyed by SoundId,
 * applies per-channel volume from the AudioSettings store, and exposes a
 * clean API for playing, looping, stopping, fading, and adjusting sounds.
 *
 * Usage:
 *   audioManager.play(SoundId.UI_CLICK)
 *   audioManager.playWith(SoundId.ATTACK_TURRET, { rate: 0.95 + Math.random() * 0.1 })
 *   audioManager.loop(SoundId.LOOP_ORCHESTRATOR)
 *   audioManager.fadeLoopIn(SoundId.LOOP_ORCHESTRATOR, 1500)
 *   audioManager.fadeLoopOut(SoundId.LOOP_ORCHESTRATOR, 1500)
 *   audioManager.stop(SoundId.LOOP_ORCHESTRATOR)
 */

import { Howl, Howler } from 'howler'
import { SOUND_DEFS, type SoundDef } from './audioAssets'
import { useAudioStore } from '../ui/stores/audio.store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayOptions {
  /** Override playback rate (pitch). 1.0 = normal. */
  rate?: number
  /** Override volume (0–1, before channel scaling). */
  volume?: number
  /** If true, start or restart the loop for this sound. */
  loop?: boolean
}

// ---------------------------------------------------------------------------
// AudioManager class
// ---------------------------------------------------------------------------

class AudioManager {
  /** Howl instance per SoundId. Created lazily on first access. */
  private readonly howls = new Map<string, Howl>()
  /** Active sound IDs for currently-playing loops (Howler sound ID). */
  private readonly loopIds = new Map<string, number>()
  /** Whether init() has been called (i.e. the AudioContext is available). */
  private _ready = false

  /** Must be called once, from a user-gesture handler, to unlock the AudioContext. */
  init(): void {
    if (this._ready) return
    this._ready = true
    // Howler's auto-unlock fires on the next gesture; triggering a silent
    // resume here ensures the context is active for immediate sound after init.
    Howler.autoUnlock = true
    Howler.autoSuspend = false
  }

  get isReady(): boolean {
    return this._ready
  }

  // ---------------------------------------------------------------------------
  // Volume control
  // ---------------------------------------------------------------------------

  /**
   * Recompute all currently-playing loop volumes after channel settings change.
   * Call this whenever the user adjusts a volume slider.
   */
  applyVolumeSettings(): void {
    const store = useAudioStore()
    for (const [soundId, howlId] of this.loopIds) {
      const def = SOUND_DEFS[soundId]
      if (!def) continue
      const effective = def.volume * store.effectiveVolume(def.channel as 'sfx' | 'ui' | 'ambient')
      this.getHowl(soundId, def).volume(effective, howlId)
    }
  }

  // ---------------------------------------------------------------------------
  // One-shot playback
  // ---------------------------------------------------------------------------

  /**
   * Play a one-shot sound with optional overrides.
   * Returns the internal Howler sound ID (useful if you need to stop/modify it).
   */
  play(soundId: string, opts?: PlayOptions): number {
    if (!this._ready) return -1
    const def = SOUND_DEFS[soundId]
    if (!def) {
      if (import.meta.env.DEV) console.warn(`[Audio] Unknown soundId: ${soundId}`)
      return -1
    }
    const howl = this.getHowl(soundId, def)
    const store = useAudioStore()
    const baseVol  = opts?.volume  ?? def.volume
    const baseRate = opts?.rate    ?? def.rate ?? 1.0
    const effective = baseVol * store.effectiveVolume(def.channel as 'sfx' | 'ui' | 'ambient')

    const id = howl.play()
    if (id !== undefined) {
      howl.volume(effective, id)
      howl.rate(baseRate, id)
    }
    return id ?? -1
  }

  /**
   * Convenience alias — play with specific options.
   */
  playWith(soundId: string, opts: PlayOptions): number {
    return this.play(soundId, opts)
  }

  // ---------------------------------------------------------------------------
  // Looping
  // ---------------------------------------------------------------------------

  /**
   * Start (or resume) a looping sound. Idempotent — calling twice does nothing.
   */
  loop(soundId: string, opts?: PlayOptions): void {
    if (!this._ready) return
    if (this.loopIds.has(soundId)) return  // already playing

    const def = SOUND_DEFS[soundId]
    if (!def) return
    const howl = this.getHowl(soundId, def)
    const store = useAudioStore()
    const baseVol  = opts?.volume  ?? def.volume
    const baseRate = opts?.rate    ?? def.rate ?? 1.0
    const effective = baseVol * store.effectiveVolume(def.channel as 'sfx' | 'ui' | 'ambient')

    const id = howl.play()
    if (id !== undefined) {
      howl.volume(effective, id)
      howl.rate(baseRate, id)
      howl.loop(true, id)
      this.loopIds.set(soundId, id)
    }
  }

  /**
   * Stop a looping sound immediately.
   */
  stopLoop(soundId: string): void {
    const id = this.loopIds.get(soundId)
    if (id === undefined) return
    const howl = this.howls.get(soundId)
    howl?.stop(id)
    this.loopIds.delete(soundId)
  }

  /**
   * Fade a loop in from 0 to its base volume over `durationMs`.
   * Starts the loop if not already playing.
   */
  fadeLoopIn(soundId: string, durationMs: number): void {
    if (!this._ready) return
    const def = SOUND_DEFS[soundId]
    if (!def) return

    const store = useAudioStore()
    const targetVol = def.volume * store.effectiveVolume(def.channel as 'sfx' | 'ui' | 'ambient')

    if (!this.loopIds.has(soundId)) {
      const howl = this.getHowl(soundId, def)
      const id = howl.play()
      if (id !== undefined) {
        howl.volume(0, id)
        howl.rate(def.rate ?? 1.0, id)
        howl.loop(true, id)
        howl.fade(0, targetVol, durationMs, id)
        this.loopIds.set(soundId, id)
      }
    } else {
      const id = this.loopIds.get(soundId)!
      const howl = this.howls.get(soundId)!
      howl.fade(howl.volume(id) as number, targetVol, durationMs, id)
    }
  }

  /**
   * Fade a loop out and stop it after `durationMs`.
   */
  fadeLoopOut(soundId: string, durationMs: number): void {
    const id = this.loopIds.get(soundId)
    if (id === undefined) return
    const howl = this.howls.get(soundId)
    if (!howl) return

    const currentVol = howl.volume(id) as number
    howl.fade(currentVol, 0, durationMs, id)
    setTimeout(() => {
      const stillActive = this.loopIds.get(soundId) === id
      if (stillActive) {
        howl.stop(id)
        this.loopIds.delete(soundId)
      }
    }, durationMs + 50)
  }

  /** True if a given loop sound is currently playing. */
  isLooping(soundId: string): boolean {
    return this.loopIds.has(soundId)
  }

  // ---------------------------------------------------------------------------
  // Stop all
  // ---------------------------------------------------------------------------

  /** Stop all sounds immediately (e.g. on game restart). */
  stopAll(): void {
    Howler.stop()
    this.loopIds.clear()
  }

  // ---------------------------------------------------------------------------
  // Howl factory — lazy, one instance per soundId
  // ---------------------------------------------------------------------------

  private getHowl(soundId: string, def: SoundDef): Howl {
    let howl = this.howls.get(soundId)
    if (!howl) {
      howl = new Howl({
        src:    def.src,
        loop:   def.loop ?? false,
        volume: def.volume,
        rate:   def.rate ?? 1.0,
        preload: true,
        onloaderror: (_, err) => {
          if (import.meta.env.DEV) console.warn(`[Audio] Load error for ${soundId}:`, err)
        },
      })
      this.howls.set(soundId, howl)
    }
    return howl
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const audioManager = new AudioManager()
