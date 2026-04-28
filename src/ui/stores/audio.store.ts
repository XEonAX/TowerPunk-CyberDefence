/**
 * Audio Settings Store
 *
 * Persists per-channel volume settings to localStorage.
 * Used by OptionsPanel.vue for sliders and read by AudioManager
 * to compute effective volume for each sound.
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'tp-audio-settings'

interface AudioSettingsSnapshot {
  master: number
  sfx: number
  ui: number
  ambient: number
}

function loadSnapshot(): AudioSettingsSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettingsSnapshot>
      return {
        master:  clamp(parsed.master  ?? 1.0),
        sfx:     clamp(parsed.sfx     ?? 0.8),
        ui:      clamp(parsed.ui      ?? 0.7),
        ambient: clamp(parsed.ambient ?? 0.5),
      }
    }
  } catch {
    // corrupt storage — ignore
  }
  return { master: 1.0, sfx: 0.8, ui: 0.7, ambient: 0.5 }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export const useAudioStore = defineStore('audio', () => {
  const snapshot = loadSnapshot()

  const masterVolume  = ref(snapshot.master)
  const sfxVolume     = ref(snapshot.sfx)
  const uiVolume      = ref(snapshot.ui)
  const ambientVolume = ref(snapshot.ambient)

  // Persist whenever any value changes
  watch([masterVolume, sfxVolume, uiVolume, ambientVolume], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      master:  masterVolume.value,
      sfx:     sfxVolume.value,
      ui:      uiVolume.value,
      ambient: ambientVolume.value,
    }))
  })

  function setMaster(v: number):  void { masterVolume.value  = clamp(v) }
  function setSfx(v: number):     void { sfxVolume.value     = clamp(v) }
  function setUi(v: number):      void { uiVolume.value      = clamp(v) }
  function setAmbient(v: number): void { ambientVolume.value = clamp(v) }

  /** Effective volume for a given channel — channel × master. */
  function effectiveVolume(channel: 'sfx' | 'ui' | 'ambient'): number {
    const ch = channel === 'sfx' ? sfxVolume.value
             : channel === 'ui'  ? uiVolume.value
             :                     ambientVolume.value
    return ch * masterVolume.value
  }

  return {
    masterVolume,
    sfxVolume,
    uiVolume,
    ambientVolume,
    setMaster,
    setSfx,
    setUi,
    setAmbient,
    effectiveVolume,
  }
})
