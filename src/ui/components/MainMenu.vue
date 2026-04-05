<template>
  <div class="main-menu">
    <!-- Plexus particle background -->
    <PlexusBackground />

    <!-- Left panel -->
    <div class="mm-panel">
      <!-- Red edge strip (CP2077-style) -->
      <div class="mm-edge" />

      <div class="mm-inner">
        <!-- Logo -->
        <img
          src="../../assets/loadingscreen/Towerpunk.png"
          alt="TowerPunk: Cyber Defence"
          class="mm-logo"
        />

        <!-- Menu items -->
        <nav class="mm-nav" role="navigation" aria-label="Main menu">
          <button
            class="mm-item"
            :class="{ 'mm-item--active': focusedIndex === 0, 'mm-item--disabled': !hasSave }"
            :disabled="!hasSave"
            :aria-disabled="!hasSave"
            @click="onContinue"
            @mouseenter="focusedIndex = 0"
          >
            <span class="mm-item__bracket" aria-hidden="true">[</span>
            CONTINUE
            <span class="mm-item__bracket" aria-hidden="true">]</span>
            <span v-if="!hasSave" class="mm-item__sub">NO SAVE FOUND</span>
          </button>

          <button
            class="mm-item"
            :class="{ 'mm-item--active': focusedIndex === 1 }"
            @click="onNewGame"
            @mouseenter="focusedIndex = 1"
          >
            <span class="mm-item__bracket" aria-hidden="true">[</span>
            NEW GAME
            <span class="mm-item__bracket" aria-hidden="true">]</span>
          </button>

          <button
            class="mm-item"
            :class="{ 'mm-item--active': focusedIndex === 2 }"
            @click="onOptions"
            @mouseenter="focusedIndex = 2"
          >
            <span class="mm-item__bracket" aria-hidden="true">[</span>
            OPTIONS
            <span class="mm-item__bracket" aria-hidden="true">]</span>
          </button>
        </nav>

        <div class="mm-footer">
          <span class="mm-build">BUILD 0.1.0 — BLACKWALL ACTIVE</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Options overlay -->
  <Transition name="options-fade">
    <OptionsPanel v-if="showOptions" @close="showOptions = false" />
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PlexusBackground from './PlexusBackground.vue'
import OptionsPanel from './OptionsPanel.vue'

const emit = defineEmits<{
  (e: 'newGame'): void
  (e: 'continue'): void
}>()

// ── Save detection ────────────────────────────────────────────────────────────
// No save system is implemented yet — Continue is disabled until a save key exists.
const SAVE_KEY = 'tp-save'
const hasSave = ref(false)

onMounted(() => {
  hasSave.value = localStorage.getItem(SAVE_KEY) !== null
})

// ── Options overlay ───────────────────────────────────────────────────────────
const showOptions = ref(false)

// ── Keyboard navigation ───────────────────────────────────────────────────────
// Focus starts on "NEW GAME" (index 1) since Continue is typically disabled.
const focusedIndex = ref(1)

// Selectable indices: skip index 0 when no save
function activeItems(): number[] {
  return hasSave.value ? [0, 1, 2] : [1, 2]
}

function activateItem(index: number): void {
  if (index === 0 && hasSave.value) {
    onContinue()
  } else if (index === 1) {
    onNewGame()
  } else if (index === 2) {
    onOptions()
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (showOptions.value) return

  const items = activeItems()
  const pos   = items.indexOf(focusedIndex.value)

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      e.preventDefault()
      if (pos > 0) focusedIndex.value = items[pos - 1]
      break
    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault()
      if (pos < items.length - 1) focusedIndex.value = items[pos + 1]
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      activateItem(focusedIndex.value)
      break
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

// ── Actions ───────────────────────────────────────────────────────────────────
function onNewGame(): void {
  emit('newGame')
}

function onContinue(): void {
  if (!hasSave.value) return
  emit('continue')
}

function onOptions(): void {
  showOptions.value = true
}
</script>

<style scoped>
/* ── Wrapper ─────────────────────────────────────────────────────────────────── */
.main-menu {
  position: fixed;
  inset: 0;
  background: #020610;
  display: flex;
  align-items: stretch;
  z-index: 9999;
  overflow: hidden;
}

/* ── Left panel ──────────────────────────────────────────────────────────────── */
.mm-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: clamp(280px, 34vw, 480px);
  flex-shrink: 0;

  /* Translucent dark panel matching CP2077 style */
  background: linear-gradient(
    to right,
    rgba(2, 3, 14, 0.97) 0%,
    rgba(2, 5, 20, 0.93) 70%,
    rgba(2, 5, 20, 0.82) 100%
  );
}

/* The narrow red/dark strip on the far left — CP2077 signature detail */
.mm-edge {
  width: 5px;
  flex-shrink: 0;
  background: linear-gradient(
    to bottom,
    #8b0000 0%,
    #cc1a00 30%,
    #ff2200 50%,
    #cc1a00 70%,
    #8b0000 100%
  );
  box-shadow: 2px 0 12px rgba(255, 34, 0, 0.4);
}

/* ── Inner content ───────────────────────────────────────────────────────────── */
.mm-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 48px 36px 32px 32px;
  gap: 0;
}

/* ── Logo ────────────────────────────────────────────────────────────────────── */
.mm-logo {
  width: 100%;
  max-width: 340px;
  height: auto;
  margin-bottom: 52px;
  filter:
    drop-shadow(0 0 16px rgba(0, 204, 255, 0.6))
    drop-shadow(0 0 36px rgba(0, 68, 170, 0.4));
}

/* ── Navigation ──────────────────────────────────────────────────────────────── */
.mm-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mm-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 10px 14px;
  background: transparent;
  border: 1.5px solid transparent;
  border-radius: 0;
  cursor: pointer;
  outline: none;
  text-align: left;

  font-family: monospace;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(200, 200, 215, 0.6);

  transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease,
              padding-left 0.12s ease;
}

/* Hover / keyboard-focus state */
.mm-item--active {
  color: #ffdd00;
  border-color: #ffdd00;
  background: rgba(255, 221, 0, 0.06);
  padding-left: 20px;
}

/* Disabled (no save) */
.mm-item--disabled,
.mm-item:disabled {
  opacity: 0.3;
  cursor: default;
  pointer-events: none;
}

.mm-item__bracket {
  color: #ff3c28;
  font-weight: 400;
  transition: color 0.12s ease;
}
.mm-item--active .mm-item__bracket {
  color: #ffdd00;
}

/* Small sub-label beneath disabled item */
.mm-item__sub {
  position: absolute;
  bottom: -2px;
  left: 36px;
  font-size: 8px;
  letter-spacing: 0.2em;
  color: #ff3c28;
  opacity: 0.7;
  font-weight: 400;
}

/* ── Footer ──────────────────────────────────────────────────────────────────── */
.mm-footer {
  margin-top: auto;
  padding-top: 32px;
}

.mm-build {
  font-family: monospace;
  font-size: 8px;
  letter-spacing: 0.2em;
  color: rgba(0, 204, 255, 0.25);
  text-transform: uppercase;
}

/* ── Options overlay transition ──────────────────────────────────────────────── */
.options-fade-enter-active,
.options-fade-leave-active {
  transition: opacity 0.25s ease;
}
.options-fade-enter-from,
.options-fade-leave-to {
  opacity: 0;
}
</style>
