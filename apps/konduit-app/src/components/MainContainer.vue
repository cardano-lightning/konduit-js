<script setup lang="ts">
import NavBar from "./NavBar.vue";
</script>

<template>
  <div class="main-container">
    <slot />
  </div>
  <NavBar />
</template>

<style scoped>
.main-container {
  padding-bottom: calc(var(--navbar-padding-bottom) + env(safe-area-inset-bottom) + var(--main-container-padding)); /* Space for the navbar */
  padding-left: var(--main-container-padding);
  padding-right: var(--main-container-padding);
}
</style>
