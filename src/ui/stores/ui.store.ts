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

  /** Game speed multiplier — 0×, 0.1×, 0.5×, 1×, 2×, 4×, 8×, 16×, 32×, or 64× */
  const gameSpeed = ref<0 | 0.1 | 0.5 | 1 | 2 | 4 | 8 | 16 | 32 | 64>(1)

  /** Kind of entity currently being inspected. */
  const inspectedKind = ref<'tower' | 'enemy' | 'gateway' | null>(null)
  /** Entity ID of the inspected enemy or gateway (null for tower — use selectedTowerEid). */
  const inspectedEid = ref<number | null>(null)

  /** Multi-selected tower entity IDs. Empty = no multi-selection active. */
  const selectedTowerEids = ref<number[]>([])
  /** True while a rubber-band rectangle selection drag is in progress. */
  const isDraggingSelection = ref(false)
  /** Rubber-band selection box in screen pixels (top-left origin + dimensions). */
  const dragBoxX = ref(0)
  const dragBoxY = ref(0)
  const dragBoxW = ref(0)
  const dragBoxH = ref(0)

  const SPEED_STEPS = [0, 0.1, 0.5, 1, 2, 4, 8, 16, 32, 64] as const

  function increaseSpeed(): void {
    const idx = SPEED_STEPS.indexOf(gameSpeed.value)
    const next = SPEED_STEPS[idx + 1]
    if (next !== undefined) gameSpeed.value = next
  }

  function decreaseSpeed(): void {
    const idx = SPEED_STEPS.indexOf(gameSpeed.value)
    const prev = SPEED_STEPS[idx - 1]
    if (prev !== undefined) gameSpeed.value = prev
  }

  function selectTowerType(type: number | null): void {
    selectedTowerType.value = type
    selectedTowerEid.value = null // deselect placed tower instance
    selectedTowerEids.value = []
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
    selectedTowerEids.value = []
    inspectedKind.value = null
    inspectedEid.value = null
  }

  /** Set the multi-selection to the given tower eids. Clears single-tower selection. */
  function setMultiSelection(eids: number[]): void {
    selectedTowerEids.value = eids
    selectedTowerEid.value = null
    selectedTowerType.value = null
    inspectedKind.value = null
    inspectedEid.value = null
  }

  function startSelectionDrag(sx: number, sy: number): void {
    isDraggingSelection.value = true
    dragBoxX.value = sx
    dragBoxY.value = sy
    dragBoxW.value = 0
    dragBoxH.value = 0
  }

  function updateSelectionDrag(startSX: number, startSY: number, curSX: number, curSY: number): void {
    dragBoxX.value = Math.min(startSX, curSX)
    dragBoxY.value = Math.min(startSY, curSY)
    dragBoxW.value = Math.abs(curSX - startSX)
    dragBoxH.value = Math.abs(curSY - startSY)
  }

  function endSelectionDrag(): void {
    isDraggingSelection.value = false
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

  /**
   * Counter-clockwise 8-direction rotation for Data Spike facing (inverse of rotatePlacementFacing).
   * Sequence: N→NW→W→SW→S→SE→E→NE→N (Dir values: 0→7→3→6→1→5→2→4→0)
   */
  function rotatePlacementBackward(): void {
    const ROTATE_CCW = [7, 5, 4, 6, 0, 2, 1, 3] as const
    placementFacing.value = ROTATE_CCW[placementFacing.value] ?? 0
  }

  /**
   * Placement level selector — towers can be placed pre-upgraded at levels 1–10.
   * Cost shown is cumulative (sum of all level costs up to selected level).
   * Rulebook §5.0.5 — maximum tower level is 10.
   */
  const placementLevel = ref<number>(1)

  function setPlacementLevel(level: number): void {
    placementLevel.value = Math.max(1, Math.min(10, level))
  }

  return {
    selectedTowerType, selectedTowerEid,
    hoveredTileX, hoveredTileY,
    isPanelOpen, placementFacing, gameSpeed, placementLevel,
    inspectedKind, inspectedEid,
    selectTowerType, selectTowerInstance, selectEnemy, selectGateway, clearInspection,
    setHoveredTile, rotatePlacementFacing, rotatePlacementBackward, increaseSpeed, decreaseSpeed, setPlacementLevel,
    selectedTowerEids, isDraggingSelection, dragBoxX, dragBoxY, dragBoxW, dragBoxH,
    setMultiSelection, startSelectionDrag, updateSelectionDrag, endSelectionDrag,
  }
})
