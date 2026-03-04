/**
 * UI-only state store — panel state, selected tower, hovered tile, placement facing.
 * Pure UI state — never synced from simulation.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const selectedTowerType = ref<number | null>(null)
  const selectedTowerEid = ref<number | null>(null)
  const hoveredTileX = ref<number>(-1)
  const hoveredTileY = ref<number>(-1)
  const isPanelOpen = ref(true)
  /** Placement facing direction (0=N,1=S,2=E,3=W) — used for Data Spike (§5.3) */
  const placementFacing = ref(0)

  /** Game speed multiplier — 1×, 2×, or 4× */
  const gameSpeed = ref<1 | 2 | 4>(1)

  /** Kind of entity currently being inspected. */
  const inspectedKind = ref<'tower' | 'enemy' | 'gateway' | null>(null)
  /** Entity ID of the inspected enemy or gateway (null for tower — use selectedTowerEid). */
  const inspectedEid = ref<number | null>(null)

  function cycleSpeed(): void {
    if (gameSpeed.value === 1) gameSpeed.value = 2
    else if (gameSpeed.value === 2) gameSpeed.value = 4
    else gameSpeed.value = 1
  }

  function selectTowerType(type: number | null): void {
    selectedTowerType.value = type
    selectedTowerEid.value = null // deselect placed tower instance
    inspectedKind.value = null
    inspectedEid.value = null
  }

  function selectTowerInstance(eid: number | null): void {
    selectedTowerEid.value = eid
    selectedTowerType.value = null // deselect type
    inspectedKind.value = eid !== null ? 'tower' : null
    inspectedEid.value = null
  }

  function selectEnemy(eid: number): void {
    selectedTowerEid.value = null
    selectedTowerType.value = null
    inspectedKind.value = 'enemy'
    inspectedEid.value = eid
  }

  function selectGateway(eid: number): void {
    selectedTowerEid.value = null
    selectedTowerType.value = null
    inspectedKind.value = 'gateway'
    inspectedEid.value = eid
  }

  function clearInspection(): void {
    selectedTowerEid.value = null
    inspectedKind.value = null
    inspectedEid.value = null
  }

  function setHoveredTile(x: number, y: number): void {
    hoveredTileX.value = x
    hoveredTileY.value = y
  }

  function rotatePlacementFacing(): void {
    placementFacing.value = (placementFacing.value + 1) % 4
  }

  return {
    selectedTowerType, selectedTowerEid,
    hoveredTileX, hoveredTileY,
    isPanelOpen, placementFacing, gameSpeed,
    inspectedKind, inspectedEid,
    selectTowerType, selectTowerInstance, selectEnemy, selectGateway, clearInspection,
    setHoveredTile, rotatePlacementFacing, cycleSpeed,
  }
})
