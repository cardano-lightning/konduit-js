<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import FancyAmount from "../components/FancyAmount.vue";
import { useDefaultFormatters } from "../composables/l10n";
import { POSIXSeconds } from "@konduit/konduit-consumer/time/absolute";
import { AnyPreciseDuration, NormalisedDuration, Seconds } from "@konduit/konduit-consumer/time/duration";
import { Lovelace } from "@konduit/konduit-consumer/cardano";
import { useEmbeddedWalletDetails } from "../composables/walletDetails";
import { wallet } from "../store";
import { useFx } from "../composables/fx";
import { AdaAmount } from "@konduit/konduit-consumer/amounts";

const { walletBalance, walletBalanceInfo } = useEmbeddedWalletDetails(wallet);

const { toCurrentCurrency } = useFx();

// Amount section:
// * Total balance section
const amount = computed(() => {
  const adaAmount = AdaAmount.fromLovelace(walletBalance.value || Lovelace.zero);
  return toCurrentCurrency(adaAmount).unwrapOr(adaAmount);
});

// * Sync info section
const TIMER_REFRESH_INTERVAL_MS = 20_000;
const { formatDurationShort } = useDefaultFormatters();
const now = ref(POSIXSeconds.now());
// Let's refresh the sync info every 10 sec
onMounted(() => {
  const interval = setInterval(() => {
    now.value = POSIXSeconds.now();
  }, TIMER_REFRESH_INTERVAL_MS);
  onUnmounted(() => {
    clearInterval(interval);
  });
});

const formattedSyncInfo = computed(() => {
  if(walletBalanceInfo?.value?.lastSuccessfulFetch != null) {
    const secondsSinceLastSync = Seconds.fromDiffTime(
      now.value,
      POSIXSeconds.fromValidDate(walletBalanceInfo.value.lastSuccessfulFetch.fetchedAt)
    );
    if(secondsSinceLastSync == 0) return "Synced just now";

    let normalized = (() => {
      let normalized = NormalisedDuration.fromAnyPreciseDuration(AnyPreciseDuration.fromSeconds(secondsSinceLastSync));
      if(secondsSinceLastSync < 60) {
        return normalized;
      }
      return { ...normalized, seconds: Seconds.fromDigits(0) };
    })();
    return `Synced ${formatDurationShort(normalized)} ago`;
  }
  return "Not synced";
});
</script>

<template>
  <div class="wallet-balance">
    <FancyAmount :amount="amount">
    <template #subscript>{{ formattedSyncInfo }}</template>
    </FancyAmount>
  </div>
</template>

<style scoped>
.wallet-balance {
  font-size: 1.5em;
  text-align: center;
}
</style>
