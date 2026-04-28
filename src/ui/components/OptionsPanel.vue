<template>
  <div class="options-overlay" @click.self="$emit('close')">
    <div class="options-panel">
      <div class="options-header">
        <span class="options-title">// OPTIONS</span>
        <button class="options-close" @click="$emit('close')" aria-label="Close options">✕</button>
      </div>

      <div class="options-body">
        <p class="options-section-label">// AUDIO</p>

        <div class="options-slider-row">
          <label class="options-slider-label" for="vol-master">Master</label>
          <input
            id="vol-master"
            type="range" min="0" max="1" step="0.01"
            :value="audioStore.masterVolume"
            @input="audioStore.setMaster(parseFloat(($event.target as HTMLInputElement).value))"
            class="options-slider"
          />
          <span class="options-slider-val">{{ Math.round(audioStore.masterVolume * 100) }}</span>
        </div>

        <div class="options-slider-row">
          <label class="options-slider-label" for="vol-sfx">SFX</label>
          <input
            id="vol-sfx"
            type="range" min="0" max="1" step="0.01"
            :value="audioStore.sfxVolume"
            @input="audioStore.setSfx(parseFloat(($event.target as HTMLInputElement).value))"
            class="options-slider"
          />
          <span class="options-slider-val">{{ Math.round(audioStore.sfxVolume * 100) }}</span>
        </div>

        <div class="options-slider-row">
          <label class="options-slider-label" for="vol-ui">UI</label>
          <input
            id="vol-ui"
            type="range" min="0" max="1" step="0.01"
            :value="audioStore.uiVolume"
            @input="audioStore.setUi(parseFloat(($event.target as HTMLInputElement).value))"
            class="options-slider"
          />
          <span class="options-slider-val">{{ Math.round(audioStore.uiVolume * 100) }}</span>
        </div>

        <div class="options-slider-row">
          <label class="options-slider-label" for="vol-ambient">Ambient</label>
          <input
            id="vol-ambient"
            type="range" min="0" max="1" step="0.01"
            :value="audioStore.ambientVolume"
            @input="audioStore.setAmbient(parseFloat(($event.target as HTMLInputElement).value))"
            class="options-slider"
          />
          <span class="options-slider-val">{{ Math.round(audioStore.ambientVolume * 100) }}</span>
        </div>
      </div>

      <div class="options-footer">
        <button class="options-btn" @click="$emit('close')">CLOSE</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAudioStore } from '@ui/stores/audio.store'

defineEmits<{ (e: 'close'): void }>()

const audioStore = useAudioStore()

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    // Close on Escape — parent handles via @close emit
    ;(document.querySelector('.options-close') as HTMLButtonElement | null)?.click()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.options-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10100;
}

.options-panel {
  background: rgba(2, 6, 22, 0.97);
  border: 1px solid #0044aa;
  border-radius: 2px;
  width: clamp(300px, 40vw, 520px);
  font-family: monospace;
  color: #00ccff;
  display: flex;
  flex-direction: column;
}

.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid #0044aa;
}

.options-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #00ccff;
  text-transform: uppercase;
}

.options-close {
  background: none;
  border: none;
  color: #ff3c28;
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.1s ease;
}
.options-close:hover { opacity: 1; }

.options-body {
  padding: 24px 22px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.options-section-label {
  font-size: 10px;
  letter-spacing: 0.22em;
  color: rgba(0, 204, 255, 0.5);
  text-transform: uppercase;
  margin-bottom: 10px;
}

.options-slider-row {
  display: grid;
  grid-template-columns: 70px 1fr 36px;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.options-slider-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: #00ccff;
  text-transform: uppercase;
  white-space: nowrap;
}

.options-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: #0044aa;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  accent-color: #00ccff;
}
.options-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #00ccff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 6px rgba(0, 204, 255, 0.6);
}
.options-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #00ccff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.options-slider-val {
  font-size: 10px;
  color: rgba(0, 204, 255, 0.6);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.options-footer {
  padding: 14px 18px;
  border-top: 1px solid #0044aa;
  display: flex;
  justify-content: flex-end;
}

.options-btn {
  background: none;
  border: 1.5px solid #0044aa;
  color: #00ccff;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 6px 18px;
  cursor: pointer;
  border-radius: 1px;
  transition: border-color 0.12s ease, color 0.12s ease;
}
.options-btn:hover {
  border-color: #00ccff;
  color: #fff;
}
</style>
