import { computed, onMounted, onUnmounted, ref, type Ref } from "vue";
import { BalanceInfo, CardanoConnectorWallet } from "@konduit/konduit-consumer/wallets/embedded";
import { Lovelace, NetworkMagicNumber } from "@konduit/konduit-consumer/cardano";

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

export const useEmbeddedWalletDetails = (wallet: Ref<CardanoConnectorWallet | null>) => {
  const walletBalance = computed(() => {
    return walletBalanceInfo.value?.lastValue || Lovelace.zero;
  });
  const walletBalanceInfo = ref(wallet.value) as Ref<BalanceInfo | null>;
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
    walletBalance,
    walletBalanceInfo,
    cardanoScanLink
  }
}
