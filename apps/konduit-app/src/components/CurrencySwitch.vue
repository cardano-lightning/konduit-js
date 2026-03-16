<script setup lang="ts">
import { computed } from "vue";
import CircleAdaSign from "./icons/CircleAdaSign.vue";
import CircleBitcoinSign from "./icons/CircleBitcoinSign.vue";
import CircleDolarSign from "./icons/CircleDolarSign.vue";
import type { AnyAmountSymbol } from "@konduit/konduit-consumer/amounts";

const props = defineProps<{
  modelValue: AnyAmountSymbol;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: AnyAmountSymbol): void;
}>();

const currentCurrency = computed<AnyAmountSymbol>(() => props.modelValue);

const nextCurrency = (currency: AnyAmountSymbol): AnyAmountSymbol => {
  if (currency === "ADA") return "BTC";
  if (currency === "BTC") return "USD";
  return "ADA";
};

const onClick = () => {
  const updated = nextCurrency(currentCurrency.value);
  emit("update:modelValue", updated);
};
</script>

<template>
  <div id="currency-switcher" @click="onClick">
    <template v-if="currentCurrency === 'ADA'">
      <CircleBitcoinSign />
    </template>
    <template v-else-if="currentCurrency === 'BTC'">
      <CircleDolarSign />
    </template>
    <template v-else-if="currentCurrency === 'USD'">
      <CircleAdaSign />
    </template>
    <template v-else-if="currentCurrency === 'EUR'">
      EUR
    </template>
    <template v-else-if="currentCurrency === 'GBP'">
      GBP
    </template>
  </div>
</template>

<style scoped>
#currency-switcher svg {
  height: 1.4rem;
  width: auto;
  stroke: var(--primary-color);
}
</style>
