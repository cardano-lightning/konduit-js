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

  --primary-background-color: #162456;
  --primary-color: #fff1f2;

  --error-background-color: #ffe2e2;
  --error-color: #e57373;

  background-color: var(--primary-background-color);
  color: var(--primary-color);

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* Theming with CSS variables */
  /* To use them just reference `attribute: var(--variable-name) */
  /* Color constants */

  /*
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --error-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;

  /* Spacing constants (if needed)
  --spacing-small: 0.5rem;
  --spacing-medium: 1rem;
  --spacing-large: 1.5rem;
  */
  /* Typography constants
  --font-family: ...
  --font-size-base: ...
  --font-size-small: ...
  --font-size-large: ...
  */
  /* Other theme bits (e.g., borders, shadows)
  --border-radius: 4px;
  --box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  */
}

@media (prefers-color-scheme: light) {
  :root {
    --primary-background-color: #fff1f2;
    --primary-color: #162456;
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

/* Distance of 60px is based on the navbar height which is set in the NavBar.vue component */
#app #container {
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


