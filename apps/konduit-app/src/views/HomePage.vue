<script setup lang="ts">
import WalletMinimal from "../components/icons/WalletMinimal.vue";
import Zap from "../components/icons/Zap.vue";
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
  <MainContainer>
    <TheHeader />
    <div v-if="channels.length === 0" class="missing">
      <div v-if="!walletBalance">
        <p>No open channels found and your wallet is empty. Please:</p>
        <ul class="steps">
          <li>
            <WalletMinimal /> <Link href="/wallet" :click="'wallet'">Fund your wallet</Link>.
          </li>
          <li>
            <Zap /> Then <Link href="/add-channel" :click="'add-channel'">open a channel</Link>.
          </li>
        </ul>
      </div>
      <div v-else>
        <p>No open channels found. Please:</p>
        <ul class="steps">
          <li>
            <Zap /> <Link href="/add-channel" :click="'add-channel'">Open a channel</Link>.
          </li>
        </ul>
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
  color: var(--missing-data-color);
  margin: 2rem 0;
  text-align: center;
}
  .missing .steps {
    display: flex;
    flex-direction: column;
    list-style: none;
    gap: 1rem;
    margin: 0 auto;
    align-items: center;
  }
    .missing .steps li {
      text-align: left;
    }
    .missing .steps li svg {
      height: 1.2em;
      vertical-align: top;
    }

#channels .button-group {
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
