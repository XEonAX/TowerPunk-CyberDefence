<template>
  <div class="app-container">
    <div id="pixi-container" class="canvas-container"></div>
    <div class="hud-overlay">
      <div class="hud-title">TowerPunk: Cyber Defence</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Root application component
// Vue overlays sit on top of the PixiJS canvas
</script>

<style scoped>
.app-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #0a0a0f;
}

.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.hud-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  justify-content: center;
  padding-top: 20px;
}

.hud-title {
  color: #00d4ff;
  font-family: monospace;
  font-size: 18px;
  letter-spacing: 3px;
  text-shadow: 0 0 10px #00d4ff;
  pointer-events: none;
}
</style>
