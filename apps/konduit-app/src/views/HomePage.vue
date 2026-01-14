<script setup lang="ts">
import NavBar from "../components/NavBar.vue";
import TheHeader from "../components/TheHeader.vue";
import { channels } from "../store.js";
import * as hex from "@konduit/hex";
</script>

<template>
  <div>
    <TheHeader />
    <div id="container">
      <h2>Channels</h2>
      <!-- when there are no channels use class="missing" to show the missing state -->
      <div v-if="channels.length === 0" class="missing">
        <p>No channels available.</p>
        <p>Please open a channel to start transacting.</p>
      </div>
      <ul v-else class="channel-list">
        <li v-for="channel in channels" :key="hex.encode(channel.keytag)" class="channel-item">
          <div class="channel-info">
            <h3>Channel KeyTag: {{ hex.encode(channel.keytag) }}</h3>
          </div>
        </li>
      </ul>
      <div class="channel-buttons">
        <Button class="secondary" @action="$router.push({ name: 'add-channel' })">+</Button>
      </div>
    </div>

    <NavBar />
  </div>
</template>

<style scoped>
#container {
  padding: 1rem;
}

h2 {
  font-size: 1.2rem;
  font-weight: normal;
  margin-top: 1rem;
}

.missing {
  background-color: var(--secondary-background-color);
  color: #888;
  margin: 2rem 0;
  text-align: center;
}
</style>
