/**
 * Game state bridge store — Tech.md §8
 * Synced from simulation each render frame. Vue components read from here.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const enum UIGamePhase {
  PRE_GAME = 0,
  WAVE_BREAK = 1,
  WAVE_ACTIVE = 2,
  GAME_OVER = 3,
  VICTORY = 4,
}

export const useGameStore = defineStore('game', () => {
  const coreHp = ref(100)
  const coreMaxHp = ref(100)
  const eddies = ref(400)
  const components = ref(3)
  const currentWave = ref(0)
  const phase = ref<UIGamePhase>(UIGamePhase.PRE_GAME)
  const tickCount = ref(0)

  return { coreHp, coreMaxHp, eddies, components, currentWave, phase, tickCount }
})
