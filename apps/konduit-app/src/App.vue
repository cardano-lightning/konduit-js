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

  background-color: var(--primary-background-color);
  color: var(--primary-color);

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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

/* Should we keep this default style here? */
#app #container {
  padding: 1rem;
  padding-bottom: calc(60px + env(safe-area-inset-bottom)); /* Navbar height + safe area */
}

/* BEGIN FIXME: The form styles were copied without validation/clean up. */
/* Probably we should build self contained components instead of global styles. */
/* Base styles for text inputs, numbers, selects, and textareas */

input[type="text"],
input[type="number"],
input[type="email"],
input[type="password"],
input[type="search"],
input[type="tel"],
input[type="url"],
select,
textarea {
  /* Font: Inherit the monospace font from :root */
  font-family: inherit;
  font-size: 1em;
  font-weight: 500; /* Match button weight */

  /* Sizing: Match button's vertical padding */
  padding: 0.6em 1em;
  margin-bottom: 0.4em;
  box-sizing: border-box;

  /* Theme: Sharp corners and dark blue border */
  border-radius: 0px; /* Match button style */
  border: 1px solid var(--primary-color);

  /* Colors: Light background with dark text */
  background-color: var(--primary-background-color);
  color: var(--primary-color);

  /* Transitions for a smooth focus effect */
  transition:
    border-color 0.25s,
    box-shadow 0.25s;
  width: 100%; /* Make inputs full-width by default */
  max-width: 100%;
}

/* Placeholder text style */
input::placeholder,
textarea::placeholder {
  color: rgba(22, 36, 86, 0.6); /* Muted version of the text color */
  opacity: 1; /* Override Firefox's default opacity */
}

/* Focus state: Use the link color for highlighting */
input:focus,
input:focus-visible,
select:focus,
select:focus-visible,
textarea:focus,
textarea:focus-visible {
  border-color: #646cff; /* Match 'a' tag color */
  /* A subtle glow is often nicer than the default outline */
  outline: none;
  box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.2);
}

/* Disabled state */
input:disabled,
select:disabled,
textarea:disabled {
  background-color: #f0f0f0;
  color: #999;
  border-color: #ccc;
  cursor: not-allowed;
}

/* Default label styling: 
  Above the input field and left-aligned.
*/
label {
  display: block;
  margin-bottom: 0.25em;
  font-weight: bold;
  cursor: default; /* Default cursor for block labels */
  vertical-align: middle; /* Ensure it doesn't inherit 'middle' */
  text-align: left; /* Ensure labels are left-aligned */
}

label.inline-label,
label:has(input[type="radio"]),
label:has(input[type="checkbox"]) {
  display: inline-flex; /* Make label inline */
  align-items: center;
  gap: 0.5em; /* Space between input and text */
  cursor: pointer; /* Pointer cursor for clickable label */
  font-weight: 500; /* Match input weight */
  width: auto; /* Don't be full-width */
  margin-bottom: 0.5em; /* Spacing for inline items */
}

/* Custom Radio & Checkbox Styles */
input[type="radio"],
input[type="checkbox"] {
  /* Hide the default input */
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;

  /* Shared dimensions and base style */
  width: 1.15em;
  height: 1.15em;
  margin: 0.25em;
  padding: 0;

  /* Reset width property from default input styles */
  width: 1.15em;
  max-width: 1.15em;

  font: inherit;
  background-color: var(--primary-background-color);
  border: 1px solid var(--primary-color);

  /* Transitions */
  transition: all 0.25s;

  /* For positioning the 'check' or 'dot' */
  position: relative;
  display: grid;

  /* Prevent shrinking in flex container */
  flex-shrink: 0;
}

/* Make radio buttons round */
input[type="radio"] {
  border-radius: 100%;
}

/* Keep checkboxes square */
input[type="checkbox"] {
  border-radius: 0; /* Match button style */
}

/* Create the 'dot' or 'check' using ::after */
input[type="radio"]::after,
input[type="checkbox"]::after {
  content: "";
  display: block;
  transform: scale(0); /* Hide when not checked */
  transition: transform 0.2s ease-in-out;
}

/* Style for the 'dot' (radio) */
input[type="radio"]::after {
  width: 0.7em;
  height: 0.7em;
  border-radius: 100%;
  background-color: var(--primary-background-color);
}

/* Style for the 'check' (checkbox) */
input[type="checkbox"]::after {
  width: 0.4em;
  height: 0.7em;

  /* Create a checkmark using border */
  border: solid var(--primary-color);
  border-width: 0 3px 3px 0; /* (right, bottom) */

  /* Rotate the L-shape to be a checkmark */
  transform: scale(0) rotate(45deg);
  margin-top: -0.1em; /* Fine-tune position */
}

/* For radio buttons, fill the background and make the dot white */
input[type="radio"]:checked {
  background-color: var(--primary-background-color);
  border-color: #000; /* Make the border also dark */
}

/* --- Checked States --- */
input[type="radio"]:checked::after {
  background-color: #000;
  transform: scale(1);
}

input[type="checkbox"]:checked::after {
  transform: scale(1) rotate(45deg);
}

/* --- Focus States (for radio/checkbox) --- */
input[type="radio"]:focus,
input[type="radio"]:focus-visible,
input[type="checkbox"]:focus,
input[type="checkbox"]:focus-visible {
  border-color: #646cff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.2);
}

/* --- Disabled States (for radio/checkbox) --- */
input[type="radio"]:disabled,
input[type="checkbox"]:disabled {
  background-color: #f0f0f0;
  border-color: #ccc;
  cursor: not-allowed;
}

/* Style the label of a disabled input */
label:has(input[type="radio"]:disabled),
label:has(input[type="checkbox"]:disabled) {
  color: #999;
  cursor: not-allowed;
}

/* Style the inner dot/check when disabled */
input[type="radio"]:disabled::after {
  background-color: #999;
}
input[type="checkbox"]:disabled::after {
  border-color: #999;
}

/* Fieldset and Legend for grouping form elements */
fieldset {
  border: 1px solid var(--primary-color);
  padding: 1.5em;
  margin: 1.5em 0;
  border-radius: 0; /* Keep it sharp */
}

legend {
  color: var(--primary-color);
  padding: 0 0 0.5rem; /* Spacing around the legend text */
  margin-left: 0; /* Align with padding */
  font-size: 1.1em;
}

/* END FIXME */


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


