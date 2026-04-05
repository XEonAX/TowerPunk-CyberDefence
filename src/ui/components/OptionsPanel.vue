<template>
  <div class="options-overlay" @click.self="$emit('close')">
    <div class="options-panel">
      <div class="options-header">
        <span class="options-title">// OPTIONS</span>
        <button class="options-close" @click="$emit('close')" aria-label="Close options">✕</button>
      </div>

      <div class="options-body">
        <p class="options-coming-soon">COMING SOON</p>
        <p class="options-sub">Configuration interfaces are being compiled.</p>
      </div>

      <div class="options-footer">
        <button class="options-btn" @click="$emit('close')">CLOSE</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

defineEmits<{ (e: 'close'): void }>()

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
  padding: 40px 18px;
  text-align: center;
  flex: 1;
}

.options-coming-soon {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #ffdd00;
  text-shadow: 0 0 12px rgba(255, 221, 0, 0.5);
  margin-bottom: 12px;
}

.options-sub {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: rgba(0, 204, 255, 0.45);
  text-transform: uppercase;
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
