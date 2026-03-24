<script setup lang="ts">
import FancyAmount from "../components/FancyAmount.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import type { Channel } from "@konduit/konduit-consumer/channel";
import { AdaAmount } from "@konduit/konduit-consumer/amounts";
import { computed } from "vue";
import { Lovelace } from "@konduit/konduit-consumer/cardano";

// You now get a fully validated & loaded channel object — guaranteed!
const props = defineProps<{
  channel: Channel
}>()

const amount = computed(() => {
  console.log("Channel details page - channel:", props.channel);
  return AdaAmount.fromLovelace(props.channel?.availableApprovedCapacity || Lovelace.zero);
});

</script>

<template>
  <MainContainer>
  <TheHeader />
  <div class="available">
    <FancyAmount :amount="amount">
      <template #subscript>Available effective capacity</template>
    </FancyAmount>
  </div>
  </MainContainer>
</template>


<style scoped>
.available {
  font-size: 1.5em;
}
</style>
