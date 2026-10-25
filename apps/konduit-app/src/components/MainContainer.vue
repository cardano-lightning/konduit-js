<script setup lang="ts">
import { type Props as ButtonProps } from "../components/Button.vue";
import NavBar from "./NavBar.vue";

type Props = {
  buttons?: ButtonProps[];
  styleFlipped?: boolean;
};

const props = defineProps<Props>();

console.log("MainContainer props:", props);
</script>

<template>
  <div class="main-container">
    <slot />
  </div>
  <NavBar :buttons="props.buttons" :style-flipped="props.styleFlipped" />
</template>

<style scoped>
.main-container {
  padding-bottom: calc(var(--navbar-padding-bottom) + env(safe-area-inset-bottom) + var(--main-container-padding)); /* Space for the navbar */
  padding-left: var(--main-container-padding);
  padding-right: var(--main-container-padding);
}
</style>
