import { computed, onMounted, onUnmounted, ref, type Ref } from "vue";
import { BalanceInfo, CardanoConnectorWallet } from "@konduit/konduit-consumer/wallets/embedded";
import { Lovelace, NetworkMagicNumber } from "@konduit/konduit-consumer/cardano";
import { AnyPreciseDuration, NormalisedDuration, Seconds } from "@konduit/konduit-consumer/time/duration";
import { POSIXSeconds } from "@konduit/konduit-consumer/time/absolute";
import { useDefaultFormatters } from "./l10n";

const mkCardanoScanLink = (wallet: Ref<CardanoConnectorWallet | null>) => {
  if (!wallet.value) return null;
  let baseURL = (() => {
    switch (wallet.value.networkMagicNumber) {
      case NetworkMagicNumber.MAINNET:
        return "https://cardanoscan.io/address/";
      case NetworkMagicNumber.PREPROD:
        return "https://preprod.cardanoscan.io/address/";
      case NetworkMagicNumber.PREVIEW:
        return "https://preview.cardanoscan.io/address/";
      default:
        return null;
    }
  })();
  if (baseURL === null) return null;
  const addressBech32 = wallet.value.addressBech32;
  const url = baseURL + addressBech32;
  return url;
};

const formatters = useDefaultFormatters();

const formatLastSyncInfo = (walletBalanceInfo: Ref<BalanceInfo | null>) => {
  const now = POSIXSeconds.now();
  if(walletBalanceInfo?.value?.lastSuccessfulFetch != null) {
    const secondsSinceLastSync = Seconds.fromDiffTime(
      now,
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
    return `Synced ${formatters.formatDurationShort(normalized)} ago`;
  }
  return "Not synced";
};

export const useEmbeddedWalletDetails = (wallet: Ref<CardanoConnectorWallet | null>) => {
  const walletBalanceInfo = ref(wallet.value) as Ref<BalanceInfo | null>;
  const walletBalance = computed(() => {
    return walletBalanceInfo.value?.lastValue || Lovelace.zero;
  });
  const cardanoScanLink = computed(() => mkCardanoScanLink(wallet));

  const subscriptions: (() => void)[] = [];
  onMounted(() => {
    if(!wallet.value) return;
    subscriptions.push(wallet.value.subscribe('balance-fetched', () => {
      walletBalanceInfo.value = wallet.value?.balanceInfo || null;
    }));
    walletBalanceInfo.value = wallet.value.balanceInfo;
  });

  onUnmounted(() => {
    subscriptions.forEach(unsubscribe => unsubscribe());
  });
  return {
    formattedLastSyncInfo: computed(() => formatLastSyncInfo(walletBalanceInfo)),
    walletBalance,
    walletBalanceInfo,
    cardanoScanLink
  }
}
