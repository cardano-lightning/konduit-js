<script setup lang="ts">
import NavBar from "../components/NavBar.vue";
import { type Props as ButtonProps } from "../components/Button.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import TheHeader from "../components/TheHeader.vue";
import { HexString } from "@konduit/codec/hexString";

let channels = [
  { keytag: new Uint8Array([1, 2, 3, 4]) },
  { keytag: new Uint8Array([5, 6, 7, 8]) },
];

let channelButtons: ButtonProps[] = [
  { action: "add-channel", label: "+", primary: false, disabled: false },
];
</script>

<template>
  <div>
    <TheHeader />
    <div id="container">
      <div id="channels">
        <h2>Channels</h2>
        <!-- when there are no channels use class="missing" to show the missing state -->
        <div v-if="channels.length === 0" class="missing">
          <p>No channels available.</p>
          <p>Please open a channel to start transacting.</p>
        </div>
        <ul v-else class="channel-list">
          <li v-for="channel in channels" :key="HexString.fromUint8Array(channel.keytag)" class="channel-item">
            <div class="channel-info">
              <h3>Channel KeyTag: {{ HexString.fromUint8Array(channel.keytag) }}</h3>
            </div>
          </li>
        </ul>
        <ButtonGroup :buttons="channelButtons" />
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

#channels .button-group {
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
