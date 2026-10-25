<script setup lang="ts">
import ButtonGroup from "../components/ButtonGroup.vue";
import { type Props as ButtonProps } from "../components/Button.vue";
import WalletMinimal from "./icons/WalletMinimal.vue";
import Sliders from "./icons/Sliders.vue";
/* import WalletMinimal from "./icons/WalletMinimal.vue"; */
import Zap from "./icons/Zap.vue";
import { computed } from "vue";

type Props = {
  buttons?: ButtonProps[];
  styleFlipped?: boolean;
};

const props = defineProps<Props>();

const buttons = computed(() => {
  return props?.buttons ? props.buttons : [];
});

const showButtons = computed(() => {
  return props?.buttons && props.buttons.length > 0;
});

const styleFlipped = computed(() => {
  return props?.styleFlipped ?? false;
});

</script>

<template>
  <nav id="navbar" :class="styleFlipped ? 'style-flipped' : ''">
    <!-- navbar by default has dark background on the light theme so we sholud flip the button styles accordingly -->
    <ButtonGroup class="content" :buttons="buttons" :style-flipped="!styleFlipped" v-if="showButtons" />
    <div class="content" v-else>
      <router-link :to="{ name: 'home' }"><WalletMinimal /></router-link>
      <router-link :to="{ name: 'pay' }"><Zap /></router-link>
      <router-link :to="{ name: 'settings' }"><Sliders /></router-link>
    </div>
  </nav>
</template>

<style scoped>
#navbar {
  /* padding-top: 1rem; */
  align-items: center;
  background: var(--primary-color);
  border-top: 1px solid #ccc;
  bottom: 0;
  color: var(--primary-background-color);
  display: flex;
  flex-direction: row;
  height: 60px; /* Adjust as needed */
  justify-content: space-around;
  left: 0;
  padding-bottom: env(safe-area-inset-bottom); /* Adds space for iOS home bar/notch */
  position: fixed;
  right: 0;
  z-index: 1000; /* Ensure it's above other content */
}

#navbar.style-flipped {
  background: var(--primary-background-color);
  color: var(--primary-color);
}

/* This content styling is following
 * the width setup of the #app
 */
#navbar .content {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  min-width: 320px;
  max-width: var(--max-app-width);
  width: calc(100vw - 2rem);
}

#navbar .content a {
  color: var(--primary-background-color);
}
</style>
