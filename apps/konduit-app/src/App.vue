<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

// We do not use any external CSS files beside the library normalize.css.
<style>
:root {
  font-family: monospace, Lucida Console, Courier New;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #162456;
    background-color: #fff1f2;
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


