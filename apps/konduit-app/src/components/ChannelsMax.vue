<script setup lang="ts">
import Info from "./icons/Info.vue";
import FancyAmount from "./FancyAmount.vue";
import { computed, type ComputedRef } from "vue";
import { konduitConsumer, type AppKonduitConsumer } from "../store";
import { PossibleAmount } from "../components/FancyAmount.vue";
import { Lovelace } from "@konduit/konduit-consumer/cardano";
import type { Channel } from "@konduit/konduit-consumer/channel";
import { AdaAmount } from "@konduit/konduit-consumer/amounts";
import { useFx } from "../composables/fx";

const activeChannels: ComputedRef<Channel[]> = computed(() => {
  if (!konduitConsumer.value) {
    return [] as Channel[];
  }
  const channels: Channel[] = konduitConsumer.value.channels as Channel[];
  return channels.filter((channel) => channel.isOperational);
});

const { currentCurrency, toCurrentCurrency } = useFx();

const amount = computed(() => {
  if (!konduitConsumer.value) return PossibleAmount.fromLovelace("unknown-yet");
  const consumer = konduitConsumer.value as AppKonduitConsumer;
  const capacity: Lovelace = consumer.maximumCapacity?.lovelace ?? Lovelace.zero;
  const capacityInCurrent = toCurrentCurrency(AdaAmount.fromLovelace(capacity));
  return capacityInCurrent.match(
    amount => amount,
    _err => ({ symbol: currentCurrency.value, value: "unknown-yet" } as PossibleAmount)
  );
});
</script>

<template>
  <div class="channels-total">
    <FancyAmount :amount="amount">
      <template #subscript>
        <template v-if="activeChannels.length == 0">No active channels</template>
        <!-- FIXME: Connect help messages -->
        <template v-if="activeChannels.length == 1">Effective channel capacity <Info /></template>
        <template v-if="activeChannels.length > 1">Largest effective capacity <Info /></template>
      </template>
    </FancyAmount>
  </div>
</template>

<style scoped>
.channels-total {
  text-align: center;
}
.channels-total :deep(.fancy-amount) {
  font-size: 1.5em;
}
/*
.channels-total .subscript {
  display: block;
  font-size: 0.8rem;
  font-style: italic;
  color: var(--text-secondary);
  margin-top: 1rem;
  text-align: center;
}
.channels-total .subscript svg {
  height: 1em;
  width: auto;
}
*/
</style>
