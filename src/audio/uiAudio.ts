/**
 * useUIAudio — composable for UI interaction sounds.
 *
 * Import in any Vue component that needs audio feedback on user interactions.
 * All calls are no-ops if Howler hasn't been initialised yet (before first
 * user gesture).
 *
 * Usage:
 *   const audio = useUIAudio()
 *   @click="audio.click()"
 *   @mouseenter="audio.hover()"
 */

import { audioManager } from './audioManager'
import { SoundId } from './audioAssets'

export interface UIAudio {
  /** Short click/tap feedback. */
  click(): void
  /** Subtle hover enter feedback. */
  hover(): void
  /** Error / invalid action feedback. */
  error(): void
  /** Positive confirmation (purchase, upgrade success, etc.) */
  confirm(): void
  /** Panel / drawer open. */
  panelOpen(): void
  /** Panel / drawer close. */
  panelClose(): void
  /** Toggle switch state change. */
  toggle(): void
}

export function useUIAudio(): UIAudio {
  return {
    click():      void { audioManager.play(SoundId.UI_CLICK) },
    hover():      void { audioManager.play(SoundId.UI_HOVER) },
    error():      void { audioManager.play(SoundId.UI_ERROR) },
    confirm():    void { audioManager.play(SoundId.UI_CONFIRM) },
    panelOpen():  void { audioManager.play(SoundId.UI_PANEL_OPEN) },
    panelClose(): void { audioManager.play(SoundId.UI_PANEL_CLOSE) },
    toggle():     void { audioManager.play(SoundId.UI_TOGGLE) },
  }
}
