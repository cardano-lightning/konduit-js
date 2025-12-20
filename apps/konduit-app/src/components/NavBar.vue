<script setup lang="ts">
import Sliders from "./icons/Sliders.vue";
import WalletMinimal from "./icons/WalletMinimal.vue";
import Zap from "./icons/Zap.vue";
</script>

<template>
  <nav id="navbar">
    <div class="content">
      <router-link :to="{ name: 'settings' }"><WalletMinimal /></router-link>
      <router-link :to="{ name: 'pay' }"><Zap /></router-link>
      <router-link :to="{ name: 'settings' }"><Sliders /></router-link>
    </div>
  </nav>
</template>

<style scoped>
#navbar {
  align-items: center;
  background: #162456;
  border-top: 1px solid #ccc;
  bottom: 0;
  display: flex;
  flex-direction: row;
  height: 60px; /* Adjust as needed */
  justify-content: space-around;
  left: 0;
  padding-bottom: env(safe-area-inset-bottom); /* Adds space for iOS home bar/notch */
  padding-top: 1rem;
  position: fixed;
  right: 0;
  z-index: 1000; /* Ensure it's above other content */
}

/* This content styling is following
 * the width setup of the #app
 */
#navbar .content {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  min-width: 320px;
  max-width: 60vh;
  width: calc(100vw - 2rem);
}

#navbar .content a {
  color: #fff1f2;
}
</style>
