<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from "vue-router";

// Either a route name, a route object, or a navigation function
export type Action = RouteLocationRaw | ((event: MouseEvent) => void);

export type Props = {
  action: Action;
  disabled?: boolean;
  label?: string;
  primary?: boolean;
  styleFlipped?: boolean;
};

const props = defineProps<Props>();

const router = useRouter();

function handleClick(event: MouseEvent) {
  if (typeof props.action === "function") {
    props.action(event);
  } else {
    router.push(props.action);
  }
}
</script>

<template>
  <button
    :class="(props.primary ? 'primary' : 'secondary') + (props.styleFlipped ? ' flipped' : '')"
    :disabled="props.disabled"
    @click="handleClick"
  >
  {{ label }}
  </button>
</template>


<style scoped>
button {
  border: 2px solid var(--button-border-color);
  border-radius: 0;
  padding: 0.6em 1.5em;
  font-size: 1em;
  font-weight: 500;
  /* Primary button should contrast against the background */
  color: var(--primary-background-color);
  background-color: var(--primary-color);
  cursor: pointer;
  transition: border-color 0.25s;
  font-family: inherit;
}

/* TODO: Fix this coloring here */
button:hover {
  border-color: #646cff;
}

button.flipped {
  color: var(--primary-color);
  background-color: var(--primary-background-color);
}

button.secondary {
  border: 1px solid;
  /* Secondary button should blend in with the background */
  color: var(--primary-color);
  background-color: var(--primary-background-color);
}

button.secondary.flipped {
  color: var(--primary-background-color);
  background-color: var(--primary-color);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:focus,
button:focus-visible {
  outline: 0 auto -webkit-focus-ring-color;
}

</style>

