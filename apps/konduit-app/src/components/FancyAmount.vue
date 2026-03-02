<script lang="ts">
import type { Lovelace } from "@konduit/konduit-consumer/cardano";

export type CryptoCurrency = "ADA" | "BTC";

export type Satoshi = bigint;

export const mkLovelaceAmount = (value: Lovelace | "uknown-yet"): Amount => {
  return { currency: "ADA", value };
};

export const mkSatoshiAmount = (value: Satoshi | "uknown-yet"): Amount => {
  return { currency: "BTC", value };
};
</script>

<script setup lang="ts">
import { useCurrencyFormatter } from '../composables/l10n';
import Decimal from 'decimal.js-i18n';
import { computed } from 'vue';

// Currencies like Lovelace is just bigint marked on the type level.
// We require explicit tagging in here to avoid mistakes on the caller side.
export type Amount =
  | { currency: "ADA", value: Lovelace  | "uknown-yet" }
  | { currency: "BTC", value: Satoshi | "uknown-yet" };

export type Props = {
  amount: Amount | null
};

const props = defineProps<Props>();

const adaFormatter = useCurrencyFormatter({
  currency: { code: 'ADA', unit: 'lovelace', lovelaceDisplayThreshold: new Decimal('-1') }
});

const btcFormatter = useCurrencyFormatter({
  currency: { code: 'BTC', unit: 'sat', satDisplayThreshold: new Decimal('-1') }
});

const parts = computed(() => {
  const mkUknownAmount = (parts: Decimal.DecimalFormat.FormatPart[]) => {
    return parts.map(part => {
      if(part.type === "integer") {
        return { ...part, value: "??" };
      } else if(part.type === "fraction") {
        return { ...part, value: "??" };
      }
      return part;
    });
  };

  if(props.amount === null) {
    return null;
  }
  // TODO: Move uknown amount handling down the stream
  if(props.amount.currency === "ADA")
    if(props.amount.value === "uknown-yet")
      return mkUknownAmount(adaFormatter.value.formatToParts(Decimal("1000000")));
    else
      return adaFormatter.value.formatToParts(props.amount.value);

  if(props.amount.currency === "BTC")
    if(props.amount.value === "uknown-yet")
      return mkUknownAmount(btcFormatter.value.formatToParts(Decimal("10000000")));
    else
      return btcFormatter.value.formatToParts(props.amount.value);
});

</script>
<template>
<!-- Let's check that is inside parts -->
<span v-if="!parts">-</span>
<span v-else class="fancy-currency">
  <span v-for="(part, _index) in parts" :class="part.type">{{ part.value }}</span>
</span>
</template>

<style scoped>
  .fancy-currency {
    font-family: 'JetBrains Mono', monospace;
  }
  .fancy-currency span {
    text-height: 1.4em;
  }
  .fancy-currency .currency {
    font-size: 1.4em;
    font-weight: normal;
    margin: 0 0.2em;
    vertical-align: top;
  }
  .fancy-currency .decimal {
    font-size: 1.0em;
    margin: 0 0.1em;
    vertical-align: bottom;
  }
  .fancy-currency .group {
    font-size: 1.4em;
    vertical-align: top;
  }
  .fancy-currency .integer {
    font-weight: 500;
    font-size: 1.4em;
    vertical-align: top;
  }
  .fancy-currency .fraction {
    font-size: 0.9em;
    opacity: 0.8;
    vertical-align: bottom;
  }

</style>
