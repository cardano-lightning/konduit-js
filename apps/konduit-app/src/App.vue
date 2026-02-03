<script setup lang="ts">
import { RouterView } from 'vue-router';
// Side effecting import to polyfill missing Intl API
import '@formatjs/intl-durationformat/polyfill-force.js';
</script>

<template>
  <RouterView />
</template>

// We keep all the css embedded in JS for simplicity.
// The only external CSS is normalize.css loaded in main.ts.
<style>
:root {
  font-family: monospace, Lucida Console, Courier New;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  color-scheme: light dark;

  /* FIXME: The theming should be reorganized properly - it is still messy
   * as we use it for buttons and text etc. without distinction.
   */
  --primary-background-color: #162456;
  --primary-color: #fff1f2;

  --secondary-background-color: #2c3a70;
  --secondary-color: #888;

  --error-background-color: #ffe2e2;
  --error-color: #e57373;
  --error-border-color: var(--error-color);

  /* Inputs, frames around qr codes, video preview etc. */
  --frame-border-color: #d1d5db;

  /* A padding which should be applied to the botton of the main container
   * to avoid content being hidden under the navbar.
   */
  --navbar-padding-bottom: calc(60px + env(safe-area-inset-bottom)); /* Navbar height + safe area */

  background-color: var(--primary-background-color);
  color: var(--primary-color);

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@media (prefers-color-scheme: light) {
  :root {
    --primary-background-color: #fff1f2;
    --primary-color: #162456;

    --secondary-background-color: #888;
    --secondary-color: #2c3a70;
  }
}

html, body {
  height: 100vh; /* Or 100% */
  margin: 0;
  padding: 0;
  overflow-x: hidden; /* Prevent horizontal scroll */
}


body {
  display: flex;
  flex-direction: column;
  place-items: center;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0;
  max-width: 60vh;
  min-width: 320px;
  padding: 0 1rem;
  width: calc(100vw - 2rem);
}

#app a {
  font-weight: 500;
  color: #646cff;
  text-decoration: none;
}

/* Should we keep this default style here? */
#app #container {
  padding: 1rem;
  padding-bottom: calc(60px + env(safe-area-inset-bottom)); /* Navbar height + safe area */
}

/*
 * Toasts: class specificity is required to override the default toast styles
 */
.Vue-Toastification__container .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--error,
.Vue-Toastification__container .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--success,
.Vue-Toastification__container .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--warning,
.Vue-Toastification__container .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--info {
  background: #fff1f2;
  border: 1px solid #444;
  font-family: monospace, Lucida Console, Courier New;
  font-weight: 400;
  color: #162456;
  border-radius: 0;
}

  .Vue-Toastification__container .Vue-Toastification__toast.cl-toast.cl-toast .Vue-Toastification__progress-bar {
    background: #162456;
  }
</style>


