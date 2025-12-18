<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from "vue-router";

// Either a route name, a route object, or a navigation function
type Action = RouteLocationRaw | (() => void);

type Props = {
  label?: string;
  action: Action;
  primary?: boolean;
};

const props = defineProps<Props>();

const router = useRouter();

function handleClick() {
  if (typeof props.action === "function") {
    props.action();
  } else {
    router.push(props.action);
  }
}

</script>

<template>
  <button
    :class="primary ? 'primary' : 'secondary'"
    @click="handleClick"
  >
    {{ label }}
  </button>
</template>


<style scoped>
button {
  border: 2px solid #444;
  border-radius: 0;
  padding: 0.6em 1.5em;
  font-size: 1em;
  font-weight: 500;
  color: #fff1f2;
  background-color: #162456;
  cursor: pointer;
  transition: border-color 0.25s;
  font-family: inherit;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 0 auto -webkit-focus-ring-color;
}

button.secondary {
  border: 1px solid;
  color: #162456;
  background-color: #fff1f2;
}
</style>

