<script setup lang="ts">
import NavBar from "../components/NavBar.vue";
import TheHeader from "../components/TheHeader.vue";
</script>

<template>
  <TheHeader :back-page-name="'home'" />
  <div id="container">
  </div>
  <NavBar />
</template>

<style scoped>
h2 {
  font-size: 1.2rem;
  font-weight: normal;
  margin-top: 1rem;
}
</style>
