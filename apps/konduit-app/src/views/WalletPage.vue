<script setup lang="ts">
import { computed } from "vue";
import NavBar from "../components/NavBar.vue";
import TheHeader from "../components/TheHeader.vue";
import { walletBalance } from "../store";
import FancyAmount from "../components/FancyAmount.vue";
import type { Amount } from "../components/FancyAmount.vue";
import { Lovelace } from "@konduit/konduit-consumer/cardano";

const mkLovelaceAmount = (value: Lovelace): Amount => {
  return { currency: "Lovelace", value };
};

const amount = computed(() => {
  if (walletBalance.value != null) {
    console.log("Wallet balance:", walletBalance.value);
    return mkLovelaceAmount(Lovelace.fromDigits(3,1, 4, 1, 5, 9, 2,0,0,0,0)); // walletBalance.value);
  }
  console.log("Wallet balance is null");
  return null;
});
</script>


<template>
  <TheHeader :back-page-name="'home'" />
  <div id="container">
    <div>
      <span><FancyAmount :amount="amount" /></span>
    </div>
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
