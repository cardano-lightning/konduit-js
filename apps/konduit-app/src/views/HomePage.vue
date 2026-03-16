<script setup lang="ts">
import type { Props as DataRowProps } from "../components/DataListing/DataRow.vue";
import CircleAdaSign from "../components/icons/CircleAdaSign.vue";
import CurrencySwitch from "../components/CurrencySwitch.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import type { Props as ButtonProps } from "../components/Button.vue";
import DataListing from "../components/DataListing.vue";
import Callout, { type CalloutVariant } from "../components/Callout.vue";
import HandRaised from "../components/icons/heroicons/HandRaised.vue";
import ChannelsMax from "../components/ChannelsMax.vue";
import Hr from "../components/Hr.vue";
import Konduit from "../components/icons/Konduit.vue";
import WalletMinimal from "../components/icons/WalletMinimal.vue";
import Zap from "../components/icons/Zap.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import { channels, wallet } from "../store";
import { type OnClick } from "../components/Link.vue";
import { useEmbeddedWalletDetails } from "../composables/walletDetails";
import { useDefaultFormatters } from "../composables/l10n";
import type { ActionIcon } from "../components/DataListing/DataRow.vue";
import { Lovelace } from "@konduit/konduit-consumer/cardano";
import { computed, type ComputedRef } from "vue";
import { Ban, BatteryLow } from "lucide-vue-next";
import { useFx } from "../composables/fx";
import { useFormattedLastSuccessfulSyncInfo } from "../composables/polling";
import { AdaAmount } from "@konduit/konduit-consumer/amounts";

const { walletBalance } = useEmbeddedWalletDetails(wallet);
const formatters = useDefaultFormatters();

// `ready` is captured directly by `first-channel-ready-no-payments` context
type ChannelOpeningProgress =
  | { type: 'submitted', status: string }
  | { type: 'on-chain', cardanoScanLink: string }
  | { type: 'error', message: string }

type RenderingContext =
  | { type: 'no-channels-wallet-empty' }
  | { type: 'no-channels-wallet-funded' }
  | { type: 'first-channel-opening-in-progress', progress: ChannelOpeningProgress }
  | { type: 'first-channel-ready-no-payments' }
  | { type: 'channel-charging' }
  | { type: 'regular-use' }
  | { type: 'misconfigured' }

const renderingContext: ComputedRef<RenderingContext> = computed(() => {
  if(channels.value.length == 0)
    if(Lovelace.ord.areEqual(walletBalance.value, Lovelace.zero))
      return { type: 'no-channels-wallet-empty' };
    else
      return { type: 'no-channels-wallet-funded' };
  console.log("Channels:", channels.value);
  console.log("First channel payments:", channels.value[0]!.allPayments);
  if(channels.value.length == 1 && channels.value[0]!.allPayments.length == 0)
    if(channels.value[0]!.wasApproved)
      return { type: 'first-channel-ready-no-payments' };
    else {
      // FIXME: setup the progress correctly
      return {
        type: 'first-channel-opening-in-progress',
        progress: { type: 'submitted', status: 'submitted' },
      };
    }
  // FIXME: handle non-first channel charging state
  return { type: 'regular-use' };
});

type CalloutSetup = {
  icon: 'ada' | 'battery-low' | 'blocked' | 'hand-raised' | 'konduit' | 'wallet' | 'zap';
  title: string;
  variant: CalloutVariant;
  message: string | string[];
  buttons: ButtonProps[];
}

//        <ButtonGroup
//          :buttons="[
//            { label: 'Open Your First Channel', action: { name: 'channel-open-wallet-select' }, primary: true },
//          ]"
//        />

const calloutSetup: ComputedRef<CalloutSetup | null> = computed(() => {
  switch (renderingContext.value.type) {
    case 'no-channels-wallet-empty':
      return {
        buttons: [
          { label: 'Open Your First Channel', action: { name: 'channel-open-wallet-select' }, primary: true },
        ],
        icon: 'hand-raised',
        message: [
          'Welcome to lightning payments on Cardano.',
          'Top up your embedded wallet with a bit of ADA and you’ll be ready to open your first channel.',
        ],
        title: 'Welcome',
        variant: 'neutral',
      };
    case 'no-channels-wallet-funded': {
      const balanceFormatted = formatters.formatAda(walletBalance.value);
      return {
        buttons: [
          { label: 'Open Your First Channel', action: { name: 'channel-open-with-embedded-wallet' }, primary: true },
        ],
        // FIXME:
        icon: 'wallet',
        message: [
          `Your embedded wallet has ${balanceFormatted}.`,
          'Open your first channel to start using instant Lightning payments on Cardano.',
        ],
        title: 'Wallet ready',
        variant: 'success',
      };
    }
    // Should we replace this with ChargingInProgressCallout
    case 'first-channel-opening-in-progress': {
      const progress = renderingContext.value.progress;
      switch(progress.type) {
        case 'error':
          return {
            // FIXME:
            icon: 'konduit',
            title: 'Issue while opening channel',
            variant: 'error',
            message: [
              'Something went wrong while opening your channel.',
              progress.message,
            ],
            buttons: []
          };
        case 'on-chain':
        case 'submitted':
          return {
            // FIXME:
            icon: 'konduit',
            title: 'Channel opening in progress',
            variant: 'info',
            message: [
              'Your first channel request has been submitted.',
              'This may take a short while to confirm on-chain.',
            ],
            buttons: []
          };
      }
    }
    case 'first-channel-ready-no-payments':
      return {
        buttons: [{
          label: 'Scan an invoice',
          action: { name: 'pay' },
        }],
        icon: 'zap',
        message: [
          'Your first channel is open and ready.',
          'Make your first payment to see it in action.',
        ],
        title: 'Channel ready',
        variant: 'success',
      };
    case 'channel-charging':
      return {
        buttons: [],
        // FIXME:
        icon: 'battery-low',
        message: 'Your channel is active and handling payments.',
        title: 'Channel in use',
        variant: 'neutral',
      };
    case 'misconfigured':
      return {
        buttons: [],
        icon: 'blocked',
        message: 'The app seems misconfigured. Please try restarting or contact support.',
        title: 'Something looks off',
        variant: 'error',
      };

    case 'regular-use':
      return null;
  }
});

const fx = useFx();

const infoRows = computed((): (DataRowProps | "separator")[] => {
  // console.log("current currency:", fx.currentCurrency.value);
  // console.log(fx.formatAmount.value(mkLovelaceAmount(walletBalance.value)));
  return [
    {
      label: 'Channels',
      formattedValue: channels.value? channels.value.length.toString() : "0",
      actions: { rowAction: ["#", "chevron-right"] as [OnClick, ActionIcon] }
    },
    {
      label: 'Embedded wallet',
      formattedValue: fx.formatCryptoInCurrent(computed(() => AdaAmount.fromLovelace(walletBalance.value))).value,
      actions: { rowAction: ["wallet", "chevron-right"] as [OnClick, ActionIcon] }
    },
  ];
});

</script>
<template>
  <MainContainer>
    <TheHeader>
      <template #header-right>
        <CurrencySwitch v-model="fx.currentCurrency.value" />
      </template>
    </TheHeader>
    <div id="body">
      <Callout
        v-if="calloutSetup"
        :title="calloutSetup.title"
        :variant="calloutSetup.variant"
      >
        <template #icon>
          <component
            :is="{
              'hand-raised': HandRaised,
              'konduit': Konduit, // FIXME: replace with actual konduit icon
              'zap': Zap,
              'battery-low': BatteryLow,
              'blocked': Ban,
              'wallet': WalletMinimal,
              'ada': CircleAdaSign,
            }[calloutSetup.icon]"
          />
        </template>
        <template v-if="typeof calloutSetup.message === 'string'">
          {{ calloutSetup.message }}
        </template>
        <template v-else>
          <template v-for="(message, index) in calloutSetup.message" :key="index">
            {{ message }}<br v-if="index < calloutSetup.message.length - 1" />
          </template>
        </template>
      </Callout>
      <ButtonGroup v-if="calloutSetup && calloutSetup.buttons.length > 0" :buttons="calloutSetup.buttons" />
      <template v-else>
        <ChannelsMax />
        <Hr />
        <DataListing :rows="infoRows" />
      </template>
    </div>
  </MainContainer>
</template>

<style scoped>
#body {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}

#welcome-callout :deep(.content) {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}
/* 
#welcome-buttons {
  margin-top: var(--data-listing-gap);
}
*/

/*
.missing {
  color: var(--missing-data-color);
  margin: 2rem 0;
  text-align: center;
}
  .missing .steps {
    display: flex;
    flex-direction: column;
    list-style: none;
    gap: 1rem;
    margin: 0 auto;
    align-items: center;
  }
    .missing .steps li {
      text-align: left;
    }
    .missing .steps li svg {
      height: 1.2em;
      vertical-align: top;
    }
*/

</style>
