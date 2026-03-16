<script setup lang="ts">
import * as l10n from "../../composables/l10n";
import Ban from "../../components/icons/Ban.vue";
import BatteryLow from "../../components/icons/BatteryLow.vue";
import Callout from "../../components/Callout.vue";
import ChargingInProgressCallout from "../../components/ChargingInProgressCallout.vue";
import CurrencySwitch from "../../components/CurrencySwitch.vue";
import DataListing from "../../components/DataListing.vue";
import FancyAmount from "../../components/FancyAmount.vue";
import HandCoins from "../../components/icons/HandCoins.vue";
import MainContainer from "../../components/MainContainer.vue";
import MissingDataPlaceholder from "../../components/MissingDataPlaceholder.vue";
import TheHeader from "../../components/TheHeader.vue";
import type { Props as ButtonProps } from "../../components/Button.vue";
import type { RowConfig } from "../../components/DataListing.vue";
import { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { Milliseconds } from "@konduit/konduit-consumer/time/duration";
import { POSIXMilliseconds } from "@konduit/konduit-consumer/time/absolute";
import { computed, type ComputedRef } from "vue";
import { hex, MISSING_PLACEHOLDER, orPlaceholder } from "../../utils/formatters";
import { type AppKonduitConsumer } from "../../store";
import { useInvoiceProcessor } from "./invoiceProcessor";
import { useFx } from "../../composables/fx";
import { useFormattedLastSuccessfulSyncInfo } from "../../composables/polling";

type Props = {
  consumer: AppKonduitConsumer;
  invoice: Invoice;
};

const emit: ((event: "back", value: null) => void) = defineEmits(["back"]);

const props = defineProps<Props>();

const { expirationInfo, paymentBreakdown, processingProgress } = useInvoiceProcessor(
  props.consumer,
  props.invoice,
);

const formatters = l10n.useDefaultFormatters();

const hasExpired = computed(() => {
  return expirationInfo.value.type === 'expired';
});

const formattedExpiresAt = computed((): string => {
  const info = expirationInfo.value;
  if(info.type === 'invalid') return MISSING_PLACEHOLDER;
  if(info.type === 'expired') return formatters.formatShortDate(info.expiredAt);
  if(info.type === 'valid' && info.expiresAt === null) return 'Never';
  return formatters.formatShortDate(info.expiresAt);
});

const formattedExpiredAgo = computed((): string | null => {
  const info = expirationInfo.value;
  if(info.type !== 'expired') return null;
  const nowTimestamp = POSIXMilliseconds.now();
  const expirationTimestamp = POSIXMilliseconds.fromValidDate(info.expiredAt);
  const expiredMillisecondsAgo = Milliseconds.fromDiffTime(nowTimestamp, expirationTimestamp)
  return formatters.formatDurationLong(expiredMillisecondsAgo);
});

//  result.match(
//    (_payment) => notifications.redirectSuccess(
//      "Payment successful.",
//      { name: "home" }
//    ),
//    (error) => notifications.redirectError(
//      `Payment failed: ${stringify(error)}`,
//      { name: "home" }
//    )
//  );

const buttons = computed((): ButtonProps[] => {
  const mkPayButton = (disabled: boolean) => ({
    label: 'Pay',
    action: pay,
    primary: true,
    disabled,
  } as ButtonProps);
  if(currentStep.value.index !== 'invoice-details') return [];
  const processingProgress = currentStep.value.step.processingProgress;
  if(processingProgress.type === 'blocked') {
    switch(processingProgress.reason.type) {
      case 'no-channels-at-all':
        return [
        {
          label: 'Cancel',
          action: () => router.push({ name: 'home' }),
          primary: false,
        },
        {
          label: 'Open channel',
          action: () => router.push({
            name: 'channel-open-wallet-select',
            query: { redirectTo: router.currentRoute.value.fullPath }
          }),
          primary: true,
        }];
      case 'not-enough-capacity':
        return [
          {
            label: 'Cancel',
            action: () => router.push({ name: 'home' }),
            primary: false,
          },
          {
            label: 'Top up',
            action: () => router.push({
              name: 'channel-top-up',
              query: { redirectTo: router.currentRoute.value.fullPath }
            }),
            primary: true,
          },
        ];
      case 'channels-not-ready':
        return [
          {
            label: 'Cancel',
            action: () => router.push({ name: 'home' }),
            primary: false,
          },
          mkPayButton(true),
        ];
      case 'all-channels-closed':
        return [
          {
            label: 'Cancel',
            action: () => router.push({ name: 'home' }),
            primary: false,
          },
          {
            label: 'Open channel',
            action: () => router.push({
              name: 'channel-open-wallet-select',
              query: { redirectTo: router.currentRoute.value.fullPath }
            }),
            primary: true,
          },
        ];
      case 'invoice-expired':
        return [];
      case 'invoice-invalid':
        return [];
    }
  } else {
    return [
      {
        label: 'Cancel',
        action: () => router.push({ name: 'home' }),
        primary: false,
      },
      mkPayButton(processingProgress.type === 'loading'),
    ];
  }
});

const totalAmount = computed(() => {
  if(paymentBreakdown.value.isErr()) return null;
  return paymentBreakdown.value.value.total;
});

const formattedInvoiceAmount: ComputedRef<string> = computed(() => {
  return paymentBreakdown.value.match(
    (breakdown) => formatters.formatAnyAmount(breakdown.invoice),
    () => MISSING_PLACEHOLDER
  );
});

const formattedRoutingFee: ComputedRef<string> = computed(() => {
  return paymentBreakdown.value.match(
    (breakdown) => formatters.formatAnyAmount(breakdown.fee),
    () => MISSING_PLACEHOLDER
  );
});

const routingFeeEstimated = computed(() => {
  return paymentBreakdown.value.match(
    (breakdown) => breakdown.estimate,
    () => null
  );
});

const fx = useFx();

/*
    <DataListing :rows="[
      {
        label: 'Invoice amount',
        formattedValue: {
          string: formattedInvoiceAmount,
          importance: 'very-important'
        },
        actions: [[() => console.log('INFO'), 'info']]
      },
      routingFeeEstimated === null?
       null
       :
      {
        label:  'Routing fee' : 'Estimated routing fee',
        formattedValue: formattedRoutingFee,
        actions: [
          [() => console.log('INFO'), 'info'],
        ]
      },
      'separator',
      { label: hasExpired?'Expired':'Expires',
        formattedValue: formattedExpiresAt, actions: []
      },
      { label: 'Destination',
        formattedValue: orPlaceholder(hex(currentStep.step.invoice.payee)),
        actions: [
          { action: 'copy' as const,
            message: 'Destination copied to clipboard.',
            value: hex(currentStep.step.invoice.payee)
          }
        ]
      },
    ]" />
*/

const fxPollingInfo = useFormattedLastSuccessfulSyncInfo(fx.fxPollingInfo, "short");
const invoiceRows = computed((): RowConfig[] => {
  const rows: (RowConfig | null)[] = [
    {
      label: 'Invoice amount',
      formattedValue: {
        string: formattedInvoiceAmount.value,
        importance: 'very-important'
      },
      actions: [[() => console.log('INFO'), 'info']]
    },
    routingFeeEstimated.value === null?
     null
     :
    {
      label:  routingFeeEstimated.value ? 'Estimated routing fee' : 'Routing fee',
      formattedValue: formattedRoutingFee.value,
      actions: [
        [() => console.log('INFO'), 'info'],
      ]
    },
    'separator',
    { label: hasExpired.value?'Expired':'Expires',
      formattedValue: formattedExpiresAt.value, actions: []
    },
    { label: 'Destination',
      formattedValue: orPlaceholder(hex(props.invoice.payee)),
      actions: [
        { action: 'copy' as const,
          message: 'Destination copied to clipboard.',
          value: hex(props.invoice.payee)
        }
      ]
    },
    "separator" as const,
    {
      label: 'Currency exchange',
      formattedValue: `kraken.com (${fxPollingInfo.value})`,
      actions: { rowAction: ["https://www.kraken.com/", "external-link"] }
    },

  ];
  return rows.filter((row) => row !== null);
});

</script>

<template>
  <MainContainer :buttons="buttons">
    <TheHeader
      :back="() => emit('back', null)"
      :title="'Payment'"
      id="header"
    >
      <template #header-right>
        <CurrencySwitch v-model="fx.currentCurrency.value" />
      </template>
    </TheHeader>
    <div id="invoice-amount">
      <span class="amount">
        <FancyAmount
          v-if="totalAmount"
          :amount="totalAmount"
        />
      </span>
      <div class="description">
        <MissingDataPlaceholder v-if="invoice.description">
          No description provided.
        </MissingDataPlaceholder>
        <span v-else>{{ invoice.description }}</span>
      </div>
    </div>
    <template v-if="processingProgress.type === 'quoting-blocked'">
      <Callout
        v-if="paymentBreakdown?.isErr()"
        :title="'Processing error'"
        :variant="'error'"
      >
        <template #icon>
          <Ban />
        </template>
        An unexpected error happened during internal processing of the invoice:<br /> {{ paymentBreakdown?.error }}. <br />
      </Callout>
      <Callout
        v-else-if="processingProgress.reason.type === 'invoice-expired'"
        :title="'Invoice expired'"
        :variant="'error'"
      >
        <template #icon>
          <Ban />
        </template>
        It has expired {{ formattedExpiredAgo ? `${formattedExpiredAgo} ago` : '' }}. <br />
      </Callout>
      <Callout
        v-else-if="processingProgress.reason.type === 'invoice-invalid'"
        :title="'Invalid invoice'"
        :variant="'error'"
      >
        <template #icon>
          <Ban />
        </template>
        The app had problems parsing the invoice, so it cannot be paid. This can be caused by an invalid invoice format or by unsupported features in the invoice.
      </Callout>
      <ChargingInProgressCallout
        v-else-if="processingProgress.reason.type === 'channels-not-ready'"
        :progress="{ type: 'submitted' }"
      />
      <Callout
        v-else-if="processingProgress.reason.type === 'not-enough-capacity'"
        :title="'Low on capacity!'"
        :variant="'warning'"
      >
        <template #icon>
          <BatteryLow />
        </template>
        Oops, your lighting channel can't cover this invoice amount.<br />
        Please top up your channel to proceed.
      </Callout>
      <Callout
        v-else-if="processingProgress.reason.type === 'no-channels-at-all'"
        :title="'First payment – almost there!'"
        :variant="'info'"
      >
        <template #icon>
          <HandCoins />
        </template>
        <div>
        Open a channel to make it possible.<br />
        Setup should be super quick and
        in a few minutes you will be ready to pay.
        </div>
      </Callout>

      <p v-else-if="processingProgress.reason.type === 'all-channels-closed'">
        All your channels are closed, so you cannot pay this invoice.
      </p>

    </template>
    <DataListing :rows="invoiceRows" />
  </MainContainer>
</template>

<style scoped>
header :deep(.header-right) svg {
  height: 1.4rem !important;
  stroke: var(--primary-color);
  width: auto !important;
}

.buttons {
  margin-top: calc(var(--data-listing-gap) * 2);
}

.callout {
  margin-bottom: calc(var(--data-listing-gap));
}

#opening-steps {
  display: flex;
  flex-direction: column;
  gap: calc(var(--data-listing-gap) * 0.5);
  list-style: none;
  margin: 0;
  margin-bottom: 0;
  margin-left: var(--data-listing-gap);
  padding: 0;
  text-align: left;
}
  #opening-steps li {
    margin: 0;
    padding: 0;
  }
    #opening-steps li svg {
      height: 1em;
      width: auto;
      vertical-align: middle;
    }

#invoice-amount {
  margin-bottom: calc(var(--data-listing-gap) * 2);
  text-align: center;
}
  #invoice-amount .amount {
    font-size: 1.5rem;
  }
  #invoice-amount .description {
    font-size: 0.9rem;
    margin-top: 1rem;
    text-align: center;
  }
  #invoice-amount .description .missing {
    font-style: italic;
  }

</style>

<!--
<div v-else-if="currentStep.index === 'channels-missing'">
  <p>You need to have at least one open channel to pay this invoice.</p>
  <ButtonGroup :buttons="[
    {
      label: 'Add channel',
      action: () => router.push({ name: 'add-channel' }),
      primary: true,
    }
  ]" />
</div>
<div v-else-if="currentStep.index === 'channels-not-ready'">
  <template v-if="channels && channels.length == 1">
    <MissingDataPlaceholder>
      You have an open channel, but it's not ready yet.
      <p>
      The openning transaction was already submitted but the adaptor server did not confirmed and approved it yet.
      </p>
      <p>
        We will <b>automatically move to the next step</b> once the channel is ready.
      </p>
    </MissingDataPlaceholder>
    <Hr />
    <DataListing :rows="
      (channels && channels[0])?
      [
        { label: 'Channel Tag', formattedValue: hex(channels[0].channelTag) },
        { label: 'Last Synced',
          formattedValue: channels[0].squashingInfo.lastFetchedAt? formatters.formatShortDate(channels[0].squashingInfo.lastFetchedAt) : MISSING_PLACEHOLDER
        },
        { label: 'Status', formattedValue: channels[0].isOperational ? 'Operational' : 'Not operational' },
      ]
      :[]" />
  </template>
</div>

<div v-else-if="currentStep.index === 'quotes'">
  <p>Quotes step (not implemented)</p>
</div>
<div v-else-if="currentStep.index === 'submit'">
  <p>Submit payment step (not implemented)</p>
</div>



// FIXME: Move to the charging component
// const chargedChannelTxHash = computed(() => {
//   if(currentStep.value.index !== 'invoice-details') return null;
//   const processingProgress = currentStep.value.step.processingProgress;
//   if((processingProgress.type === 'blocked' && processingProgress.reason.type === 'channels-not-ready')) {
//     const openTx = processingProgress.reason.channel.l1.openTx;
//     if(openTx) {
//       return openTx.txHash;
//     }
//   }
//   return null;
// });
// 
// const txUrl = computed(() => {
//   const txHash = chargedChannelTxHash.value;
//   const networkMagic = konduitConsumer.value?.networkMagicNumber;
//   const publicNetwork = networkMagic? PublicNetwork.fromNetworkMagicNumber(networkMagic) : null;
// 
//   if(!txHash || !publicNetwork) return null;
//   return CardanoScan.mkTransactionPageUrl(publicNetwork, txHash);
// });

// const { tickersInfo } = useKrakenTickers(Seconds.fromSmallNumber(30));
// 
// const krakenFx: ComputedRef<Fx | null>  = computed(() => {
//   if(tickersInfo.value && tickersInfo.value.lastValue) {
//     return mkKrakenFxFromTickers(tickersInfo.value.lastValue);
//   }
//   return null;
// });
-->

