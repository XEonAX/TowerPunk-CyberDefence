<template>
  <div class="bs">
    <h1>Hello, World!</h1>
    <p>Welcome to the game.</p>
    <p>We need you to click the button below to initialize the mono-aural digital audio systems</p>
    <hr />
    <p>Please click the button below to continue. Use a mouse ofcourse.</p>
    <p>
      <button @click="onEnter">This button. Please click</button>
    </p>
    <p>Please click the above button. It is its prerogative to be clicked.</p>
    <hr />
    <p>
      <small>
        NOTE: This page requires a browser with WebGL and Web Audio support and a device with mouse and keyboard<br />
        JavaScript is prolly enabled.<br />
        Cookies are not required. But would be appreciated if they are tasty. <br />
        This page is best viewed at 1920&times;1080 or higher resolution. Or not. We don't judge.
        But the game itself is designed on a 43″ TV at 133% Zoom at 3840&times;2160 resolution, so... yeah.<br />
      </small>
    </p>
    <p>
      <small>
        &copy; 2027 DVD Projet Red. 4 rights reserved. See what we did there?<br />
        Special thanks to you. Yes, you, reading this. Thanks for giving our game a chance. We hope
        you enjoy it!<br />
        And us. for creating this game. We deserve some credit too. I mean, we did make it after
        all.<br />
        It was a lot of commits and tokens. Please consider supporting us by sharing it with your
        friends. and enemies.<br />
        Or just telling people about it. Every little bit helps! Bigger bits too!<br />
      </small>
    </p>
    <hr />
    <footer>Server Version Information: Internet Information Services (IIS) 6.7</footer>
  </div>
</template>

<script setup lang="ts">
import { audioManager } from '@audio/audioManager'

const emit = defineEmits<{ (e: 'enter'): void }>()

function onEnter(): void {
  audioManager.init()
  emit('enter')
}
</script>

<style scoped>
/* Override the global dark theme reset — make this look like a bare browser page */
.bs {
  position: fixed;
  inset: 0;
  background: #ffffff;
  color: #000000;
  font-family: 'Times New Roman', Times, serif;
  font-size: medium;
  padding: 8px;
  overflow-y: auto;
  z-index: 99999;
}

/* Re-apply browser default block margins stripped by App.vue's global reset */
.bs h1 {
  font-size: 2em;
  font-weight: bold;
  margin: 0.67em 0;
}

.bs p {
  margin: 1em 0;
}

.bs hr {
  border: 1px inset;
  margin: 0.5em 0;
}

.bs small {
  font-size: 0.8em;
}

/* Default OS-style button — undo everything from the game styles */
.bs button {
  all: revert;
  cursor: pointer;
}
</style>
