<script setup lang="ts">
import NavBar from "../components/NavBar.vue";
import { type Props as ButtonProps } from "../components/Button.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import { HexString } from "@konduit/codec/hexString";
import { channels, walletBalance } from "../store";
import Link from "../components/Link.vue";

let channelButtons: ButtonProps[] = [
  { action: "add-channel", label: "+", primary: false, disabled: false },
];
</script>

<template>
  <div>
    <TheHeader />
    <MainContainer>
      <div v-if="channels.length === 0" class="missing">
        <div v-if="!walletBalance">
          <p>No open channels found and your wallet seems to be empty.</p>
          <p>Please <Link href="/wallet" :click="'wallet'">fund your wallet</Link> first, then <Link href="/add-channel" :click="'add-channel'">add a channel</Link> to get started.</p>
        </div>
        <div v-else>
          <p>No open channels found.</p>
          <p><Link href="/add-channel" :click="'add-channel'">Add a channel</Link> to get started.</p>
        </div>
        <!-- Let's put this into a tooltip: In order to start using Konduit, you need to add at least one channel. -->
      </div>
      <div v-else id="channels">
        <h2>Channels</h2>
        <!-- when there are no channels use class="missing" to show the missing state -->
        <ul class="channel-list">
          <li v-for="channel in channels" class="channel-item">
            <div class="channel-info">
              <h3>Channel KeyTag: {{ HexString.fromUint8Array(channel.channelTag) }}</h3>
            </div>
          </li>
        </ul>
        <ButtonGroup :buttons="channelButtons" />
      </div>
    </MainContainer>
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
  color: #888;
  margin: 2rem 0;
  text-align: center;
}

#channels .button-group {
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
