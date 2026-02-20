<script setup lang="ts">
import { RouterView } from 'vue-router';
// Side effecting import to polyfill missing Intl API
import '@formatjs/intl-durationformat/polyfill-force.js';
</script>

<template>
  <RouterView />
</template>

<style>
/* The **only** global styles should only reference
 * the html and body elements, and #app container.
 * Everything else should be scoped to the component.
 *
 * Exception to the rule is overwrite of the notification styles.
 */
:root {
  /* You should rely and wrap your main content in the `MainContainer` by default */
  --main-container-padding: 2rem;
  --navbar-padding-bottom: calc(60px + env(safe-area-inset-bottom)); /* Navbar height + safe area */

  /* FIXME: The theming should be reorganized properly - it is still messy
   * as we use it for buttons and text etc. without distinction.
   */
  --primary-background-color: #162456;
  --primary-color: #fff1f2;

  --secondary-background-color: #2c3a70;
  --secondary-color: #888;
  /* A lighter version of primary-color */
  --missing-data-color: #fff8fa;

  --error-background-color: #ffe2e2;
  --error-color: #e57373;
  --error-border-color: var(--error-color);

  --success-background-color: #f4fbf8; /* #f0f8f2 #e6f4ea; */
  --success-color: #4caf50;
  --success-border-color: var(--success-color);

  /* Inputs, frames around qr codes, video preview etc. */
  --frame-border-color: #d1d5db;
}

@media (prefers-color-scheme: light) {
  :root {
    --primary-background-color: #fff1f2;
    --primary-color: #162456;

    --secondary-background-color: #888;
    --secondary-color: #2c3a70;

    --missing-data-color: #344480;
  }
}

html, body {
  background-color: var(--primary-background-color);
  color: var(--primary-color);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  font-family: monospace, Lucida Console, Courier New;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  color-scheme: light dark;

  height: 100vh; /* Or 100% */
  margin: 0;
  padding: 0;
  overflow-x: hidden; /* Prevent horizontal scroll */
}


/* Center the app column */
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
  max-width: 80vh;
  min-width: 320px;
  width: 100vw;
}

/*
 * Toasts: class specificity is required to override the default toast styles
 */

.Vue-Toastification__container.top-center {
  padding: 0;
  max-width: 80vh !important;
  min-width: 320px !important;
  width: 100vw !important;

  left: 50%;
  margin-left: 0 !important;
  transform: translateX(-50%);

  padding-top: 0;
  top: 0 !important;
}
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--error,
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--success,
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--warning,
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--info {
  background: #fff1f2;
  box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.1), 0 2px 15px 0 rgba(0, 0, 0, 0.05) !important;
  border-radius: 0;
  border: 1px solid var(--frame-border-color);
  border-left: none;
  border-right: none;
  border-top: none;
  color: var(--primary-color);
  font-family: monospace, Lucida Console, Courier New;
  font-weight: 400;
  max-width: none !important;
  text-align: center;
  width: 100% !important;
}
  .Vue-Toastification__container .Vue-Toastification__toast.cl-toast.cl-toast .Vue-Toastification__progress-bar {
    /* background: var(--secondary-color) !important; */
    background: #ddd;
  }
</style>


