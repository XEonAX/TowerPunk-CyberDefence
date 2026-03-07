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
  /**
   * Placement facing direction — used for Data Spike (§5.3) and Firewall axis.
   * Dir values: N=0, S=1, E=2, W=3, NE=4, SE=5, SW=6, NW=7
   */
  const placementFacing = ref(0)

  /** Game speed multiplier — 1×, 2×, 4×, 8×, 16×, or 32× */
  const gameSpeed = ref<1 | 2 | 4 | 8 | 16 | 32>(1)

  /** Kind of entity currently being inspected. */
  const inspectedKind = ref<'tower' | 'enemy' | 'gateway' | null>(null)
  /** Entity ID of the inspected enemy or gateway (null for tower — use selectedTowerEid). */
  const inspectedEid = ref<number | null>(null)

  function cycleSpeed(): void {
    if (gameSpeed.value === 1) gameSpeed.value = 2
    else if (gameSpeed.value === 2) gameSpeed.value = 4
    else if (gameSpeed.value === 4) gameSpeed.value = 8
    else if (gameSpeed.value === 8) gameSpeed.value = 16
    else if (gameSpeed.value === 16) gameSpeed.value = 32
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

  /**
   * Clockwise 8-direction rotation for Data Spike facing.
   * Sequence: N→NE→E→SE→S→SW→W→NW→N (Dir values: 0→4→2→5→1→6→3→7→0)
   */
  function rotatePlacementFacing(): void {
    const ROTATE_CW = [4, 6, 5, 7, 2, 1, 3, 0] as const
    placementFacing.value = ROTATE_CW[placementFacing.value] ?? 0
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
