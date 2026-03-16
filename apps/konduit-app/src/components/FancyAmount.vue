<script lang="ts">
import { Lovelace } from "@konduit/konduit-consumer/cardano";
import { ExchangeRate, usCent2UsMillicent, usDollar2UsCent, type UsCent } from '@konduit/konduit-consumer/fx';
import { Millisatoshi, Satoshi } from '@konduit/konduit-consumer/bitcoin';
import { AdaAmount, BitcoinAmount, UsDollarAmount, type AnyAmount, type AnyAmountSymbol } from '@konduit/konduit-consumer/amounts';
import type { NonNegativeDecimal } from '@konduit/codec/decimals';

// Currencies like Lovelace is just bigint marked on the type level.
// We require explicit tagging in here to avoid mistakes on the caller side.
export type PossibleAmount = AnyAmount | { symbol: AnyAmountSymbol, value: "unknown-yet" }

export namespace PossibleAmount {
  export const fromLovelace = (value: Lovelace | "unknown-yet"): PossibleAmount => {
    if (value === "unknown-yet") return { symbol: "ADA", value: "unknown-yet" } as PossibleAmount;
    return AdaAmount.fromLovelace(value);
  };

  export const fromSatoshi = (value: Satoshi | "unknown-yet"): PossibleAmount => {
    if (value === "unknown-yet") return { symbol: "BTC", value: "unknown-yet" } as PossibleAmount;
    return BitcoinAmount.fromSatoshi(value);
  };

  export const fromMillisatoshi = (value: Millisatoshi | "unknown-yet"): PossibleAmount => {
    if (value === "unknown-yet") return { symbol: "BTC", value: "unknown-yet" } as PossibleAmount;
    return BitcoinAmount.fromMillisatoshi(value);
  };

  export const fromUsCent = (value: UsCent | "unknown-yet"): PossibleAmount => {
    if (value === "unknown-yet") return { symbol: "USD", value: "unknown-yet" } as PossibleAmount;
    return UsDollarAmount.fromUsCent(value);
  };
}
</script>

<script setup lang="ts">
import { useCurrencyFormatter } from '../composables/l10n';
import Decimal from 'decimal.js-i18n';
import { computed } from 'vue';
export type Props = {
  amount: PossibleAmount | null
};

const props = defineProps<Props>();

const adaFormatter = useCurrencyFormatter({
  currency: { code: 'ADA', unit: 'lovelace', lovelaceDisplayThreshold: new Decimal('-1') }
});

const btcFormatter = useCurrencyFormatter({
  currency: { code: 'BTC', unit: 'sat', satDisplayThreshold: new Decimal('0.0001') }
});
// Used only for tiny amounts below 1 satoshi, otherwise the satoshi formatter is used
const btcFormatterMsat = useCurrencyFormatter({
  currency: { code: 'BTC', unit: 'msat', msatDisplayThreshold: new Decimal('-1') }
});

const usdFormatter = useCurrencyFormatter({ currency: 'USD' });

// TODO: Unify this with the core currency formatting l10 composable
const parts = computed(() => {
  const mkUnknownAmount = (parts: Decimal.DecimalFormat.FormatPart[]) => {
    return parts.map(part => {
      if(part.type === "integer") {
        return { ...part, value: "??" };
      } else if(part.type === "fraction") {
        return { ...part, value: "??" };
      }
      return part;
    });
  };

  if(props.amount === null) return null;
  // TODO: Move unknown amount handling down the stream
  if(props.amount.symbol === "ADA")
    if(props.amount.value === "unknown-yet")
      return mkUnknownAmount(adaFormatter.value.formatToParts(Decimal("1000000")));
    else
      return adaFormatter.value.formatToParts(props.amount.value);

  if(props.amount.symbol === "BTC")
    if(props.amount.value === "unknown-yet")
      return mkUnknownAmount(btcFormatter.value.formatToParts(Decimal("10000000")));
    else {
      let oneSatoshiMs = Millisatoshi.fromSatoshi(Satoshi.fromDigits(1))
      if(Millisatoshi.ord.isGreaterThan(props.amount.value, oneSatoshiMs)) {
        const satoshiDecimal = Decimal(props.amount.value).div(1000);
        return btcFormatter.value.formatToParts(satoshiDecimal);
      } else {
        return btcFormatterMsat.value.formatToParts(props.amount.value);
      }
    }
  if(props.amount.symbol === "USD")
    if(props.amount.value === "unknown-yet")
      return mkUnknownAmount(usdFormatter.value.formatToParts(Decimal("1000")));
    else {
      const millicents2Dollars = ExchangeRate.reverse(ExchangeRate.pipe(usDollar2UsCent, usCent2UsMillicent));
      const valueInDollars:NonNegativeDecimal = ExchangeRate.convert2Any(
        millicents2Dollars,
        props.amount.value,
        (dec) => dec
      )
      return usdFormatter.value.formatToParts(valueInDollars);
    }
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
