<script setup lang="ts">
import type { Props as ButtonProps } from "../components/Button.vue";
import CircleAdaSign from "../components/icons/CircleAdaSign.vue";
import Callout from "../components/Callout.vue";
import type { CalloutVariant } from "../components/Callout.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import WalletBalance from "../components/WalletBalance.vue";
import WalletSummary from "../components/WalletSummary.vue";
import { useEmbeddedWalletDetails } from "../composables/walletDetails";
import { computed, type ComputedRef } from "vue";
import { konduitConsumer, wallet } from "../store";
import { Ada, Lovelace } from "@konduit/konduit-consumer/cardano";
import { useDefaultFormatters } from "../composables/l10n";
import { useRouter } from "vue-router";

const { walletBalance } = useEmbeddedWalletDetails(wallet);

let initialWalletBalance: Lovelace = walletBalance.value ?? Lovelace.zero;

type OpeningContext =
  | { type: 'balance-is-zero' }
  | { type: 'balance-too-low' }
  | { type: 'first-opening-balance-is-zero' }
  | { type: 'first-opening-balance-too-low' }
  | { type: 'first-opening-ready' }
  | { type: 'misconfigured' }
  | { type: 'ready' }
  | { type: 'ready-topped-up' }

type OpeningContextType = OpeningContext['type'];

const openingContext: ComputedRef<OpeningContext> = computed(() => {
  if(konduitConsumer.value == null) return { type: 'misconfigured' };
  let walletIsEmpty = Lovelace.ord.areEqual(Lovelace.zero, walletBalance.value);
  let walletIsNearlyEmpty = Lovelace.ord.isGreaterThan(Lovelace.fromAda(Ada.fromDigits(2)), walletBalance.value);
  if(konduitConsumer.value.channels.length == 0)
    if(walletIsEmpty) return { type: 'first-opening-balance-is-zero' };
    else if(walletIsNearlyEmpty) return { type: 'first-opening-balance-too-low' };
    else return { type: 'first-opening-ready' };
  else
    if(walletIsEmpty) return { type: 'balance-is-zero' };
    else if(walletIsNearlyEmpty) return { type: 'balance-too-low' };
    else return { type: 'ready' };
});

type CalloutSetup = {
  title: string;
  variant: CalloutVariant;
  message: string | string[];
}

const formatters = useDefaultFormatters();

const calloutSetup: ComputedRef<CalloutSetup | null> = computed(() => {
  switch(openingContext.value.type as OpeningContextType) {
    case 'balance-too-low': return {
      title: 'Your wallet balance is too low',
      variant: 'info' as const,
      message: 'Copy or scan the below address and top up your embedded wallet with ADA so you can fund your channels.',
    }
    case 'balance-is-zero': return {
      title: 'Your wallet balance is too low',
      variant: 'warning' as const,
      message: 'Copy or scan the below address and top up your embedded wallet with ADA so you can fund your channels.',
    }
    case 'first-opening-balance-is-zero': return {
      title: 'Top up your embedded wallet',
      variant: 'hint' as const,
      message: [
        `Copy or scan the address below and send at least ${formatters.formatAda({ ada: Ada.fromSmallNumber(10) })} to it.`,
        '',
        `There is on an operational margin associtated with channel maintainance which is around ${formatters.formatAda({ ada: Ada.fromSmallNumber(5) })}.`,
        'Once funded, you\'re all set to proceed!',
      ]
    }
    case 'first-opening-balance-too-low': return {
      title: 'Your wallet balance is too low',
      variant: 'info' as const,
      message: 'Copy or scan the below address and top up your embedded wallet with ADA so you can fund your first channel.',
    }
    case 'first-opening-ready': return {
      title: 'Wallet ready!',
      variant: 'success' as const,
      message: [
        'Your embedded wallet is ready to use!',
        '',
        'You can proceed to open a channel.',
      ]
    }
    case 'misconfigured': return {
      title: 'Konduit is not properly configured',
      variant: 'error' as const,
      message: 'App is in a misconfigured state. Please reach out to support or try restarting the app.',
    }
    case 'ready-topped-up':
      const lovelaceDifference = Lovelace.subtractAbs(
        Lovelace.zero,
        initialWalletBalance
      );
      const lovelaceDifferenceFormatted = formatters.formatAda(lovelaceDifference);
      return {
        title: 'Wallet topped up - open up a channel!',
        variant: 'success' as const,
        message: `Your embedded wallet has been topped up with ${lovelaceDifferenceFormatted}! You can proceed to open a channel.`,
      }
    case 'ready': return null;
  }
});

const router = useRouter();

const backRoute = computed(() => {
  return { name: 'channel-open-wallet-select', query: router.currentRoute.value.query.redirectTo ? { redirectTo: router.currentRoute.value.query.redirectTo } : undefined };
});

const buttons: ComputedRef<ButtonProps[]> = computed(() => {
  const isReady = openingContext.value.type === 'ready' || openingContext.value.type === 'first-opening-ready' || openingContext.value.type === 'ready-topped-up';
  return [
    {
      label: 'Go back',
      action: backRoute.value,
    },
    {
      label: 'Open channel',
      disabled: !isReady,
      action: { 'name': 'channel-open-with-embedded-wallet' },
      primary: true,
    }
  ]
});

</script>

<template>
  <MainContainer :buttons="buttons">
    <TheHeader
      :show-fx-currency-switcher="true"
      :back="backRoute"
      title="Fund embedded wallet"
    />
    <div id="body">
      <WalletBalance />
      <Callout
        v-if="calloutSetup"
        :title="calloutSetup.title"
        :variant="calloutSetup.variant"
      >
        <template #icon>
          <CircleAdaSign />
        </template>
        <template v-if="typeof calloutSetup.message === 'string'">
          {{ calloutSetup.message }}
        </template>
        <!-- br in between -->
        <template v-else>
          <template v-for="(message, index) in calloutSetup.message" :key="index">
            {{ message }}<br v-if="index < calloutSetup.message.length - 1" />
          </template>
        </template>
      </Callout>
      <WalletSummary />
    </div>
  </MainContainer>
</template>

<style scoped>
#body {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}
</style>
