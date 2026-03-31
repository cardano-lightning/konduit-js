<script setup lang="ts">
import { RouterView } from 'vue-router';
// Side effecting import to polyfill missing Intl API
import '@formatjs/intl-durationformat/polyfill-force.js';

/* The only externals styles are loaded in the main.ts
 * (css does not load in the `.vue` files). We specifically
 * restricted ourselves there to: normalize.css, toastification and
 * colar extension over open-colors.
 */
import "./colar.css";
import "normalize.css";
import "vue-toastification/dist/index.css";
import { useTheme } from "./composables/theme";
useTheme();
</script>

<template>
  <RouterView />
</template>
<style>


/* The **only** global styles should reference
 * the html and body elements, and #app container at minimum.
 * Nothing more.
 * Everything else should be scoped to the component.
 *
 * Exception to the rule is the customization of the notification styles.
 */
:root {
  --max-app-width: 1240px;

  /* This variable is used usually for spacing and gaps in the main body of the app.
   * We use it or its multiples or halves.
   */
  --data-listing-gap: 1.2rem;
  /* The main container provides what you need (navbar) so just wrap your content in it.
   * Currently the header has to be included by the page itself.
   */
  --main-container-padding: var(--data-listing-gap);
  --navbar-padding-bottom: calc(60px + env(safe-area-inset-bottom)); /* Navbar height + safe area */

  /* FIXME: The theming should be reorganized properly - it is still a bit messy
   * but in the future should simplify the refactoring. Ideally we should avoid
   * "custom" colors in the components.
   * In some sens we are still using "global" styling but with proper, restricted balance :-P
   */
  --primary-background-color: var(--colar-blue-12);
  --primary-color: var(--colar-pink-0);

  /* Inputs, frames, hrs around qr codes, video preview etc. */
  /* TODO: rename this to primary-border-color? */
  --frame-border-color: var(--colar-blue-10);
  --separator-color: var(--frame-border-color);
  --separator-subtle-color: var(--colar-blue-11);

  /* TODO: Drop "secondary color" - use more semantically named colors instead. */
  /* --secondary-background-color: var(--colar-blue-10); */
  --secondary-color: var(--colar-blue-0);

  --error-background-color: var(--colar-pink-11);
  --error-color: var(--colar-pink-1);
  --error-border-color: var(--colar-pink-10);

  --hint-background-color: var(--colar-blue-11);
  --hint-border-color: var(--colar-blue-10);
  --hint-color: var(--colar-blue-0);

  /* A bit less muted than the hint, to be used for "card buttons" etc. */
  --focus-background-color: var(--colar-blue-10);
  --focus-border-color: var(--frame-blue-8);
  --focus-color: var(--colar-blue-0);

  /* Nice green but doesn't necessarily play nicely with our background. */
  --success-background-color: var(--colar-cyan-10);
  --success-border-color: var(--colar-cyan-9);
  --success-color: var(--colar-cyan-0);

  --warning-background-color: var(--colar-pink-10);
  --warning-border-color: var(--colar-orange-10);
  --warning-color: var(--colar-pink-1);

  --missing-data-color: var(--colar-gray-6);
}
/* @media (prefers-color-scheme: light) { */
:root[data-theme="light"],
:root[data-theme="system"][data-prefers-color="light"] {
  --primary-background-color: var(--colar-pink-0);
  --primary-color: var(--colar-blue-12);

  /* --secondary-background-color: var(--colar-gray-0); */
  --secondary-color: var(--colar-pink-12);

  --hint-background-color: var(--colar-purple-0);
  --hint-border-color: var(--colar-purple-1);
  --hint-color: var(--colar-purple-10);

  --focus-background-color: var(--colar-gray-0);
  --focus-border-color: var(--frame-border-color);
  --focus-color: var(--colar-gray-10);

  --error-background-color: var(--colar-red-1);
  --error-color: var(--colar-red-11);
  --error-border-color: var(--colar-red-2);

  --success-background-color: var(--colar-blue-0);
  --success-border-color: var(--colar-blue-1);
  --success-color: var(--colar-blue-10);

  --warning-background-color: #fdeee0;
  --warning-color: #c3630a;
  --warning-border-color: #fac798;

  --frame-border-color: var(--colar-pink-2);
  --separator-color: var(--frame-border-color);
  --separator-subtle-color: var(--colar-pink-1);

  --missing-data-color: var(--colar-gray-7);
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

  height: 100dvh; /* Or 100% */
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
  max-width: var(--max-app-width);
  min-width: 320px;
  width: 100vw;
}

/*
 * Toasts: class specificity is required to override the default toast styles
 */

.Vue-Toastification__container.top-center {
  padding: 0;
  max-width: var(--max-app-width) !important;
  min-width: 320px !important;
  width: 100vw !important;

  left: 50%;
  margin-left: 0 !important;
  transform: translateX(-50%);

  padding-top: 0;
  top: 0 !important;
}

.Vue-Toastification__container.top-center .Vue-Toastification__close-button {
  color: var(--primary-color) !important;
  opacity: 0.6;
}
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--error,
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--success,
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--warning,
.Vue-Toastification__container.top-center .Vue-Toastification__toast.cl-toast.Vue-Toastification__toast--info {
  background: var(--primary-background-color) !important;
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
    background: var(--frame-border-color) !important;
  }
</style>


