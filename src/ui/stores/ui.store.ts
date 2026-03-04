/**
 * UI-only state store — panel state, selected tower, etc.
 * Pure UI state — never synced from simulation.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const selectedTowerType = ref<number | null>(null)
  const isPanelOpen = ref(false)
  const hoveredTile = ref<{ x: number; y: number } | null>(null)

  return { selectedTowerType, isPanelOpen, hoveredTile }
})
