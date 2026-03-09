<script setup lang="ts">
import Link from "../components/Link.vue";
import Square from "../components/icons/Square.vue";
import SquareCheckBig from "../components/icons/SquareCheckBig.vue";
import BatteryLow from "../components/icons/BatteryLow.vue";
import Ban from "../components/icons/Ban.vue";
import BatteryThrobber from "../components/BatteryThrobber.vue";
import HandCoins from "../components/icons/HandCoins.vue";
import Callout from "../components/Callout.vue";
import type { Props as ButtonProps } from "../components/Button.vue";
import FancyAmount, { mkLovelaceAmount } from "../components/FancyAmount.vue";
import { mkSatoshiAmount } from "../components/FancyAmount.vue";
import MissingDataPlaceholder from "../components/MissingDataPlaceholder.vue";
import DataListing from "../components/DataListing.vue";
import MainContainer from "../components/MainContainer.vue";
import { computed, onMounted, ref, type Ref} from "vue";
import InvoiceInput from "./PayPage/InvoiceInput.vue";
import TheHeader from "../components/TheHeader.vue";
import * as l10n from "../composables/l10n";
import { hex, MISSING_PLACEHOLDER, orPlaceholder } from "../utils/formatters";
import { POSIXMilliseconds, ValidDate } from "@konduit/konduit-consumer/time/absolute";
import type { Channel } from "@konduit/konduit-consumer/channel";
import { konduitConsumer, type AppKonduitConsumer } from "../store";
import { useRouter } from "vue-router";
import type { ChannelQuoteInfo, ChannelQuoteResult } from "@konduit/konduit-consumer";
import { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { Lovelace, PublicNetwork } from "@konduit/konduit-consumer/cardano";
import { invoice as previousStoreInvoice } from "../store";
import { Millisatoshi, Satoshi } from "@konduit/konduit-consumer/bitcoin";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import { Milliseconds } from "@konduit/konduit-consumer/time/duration";
import { CardanoScan } from "../utils/cardano";
import { useNotifications } from "../composables/notifications";
import { stringify } from "@konduit/codec/json";


onMounted(() => {
  // Try to resume interrupted payment flow.
  if(previousStoreInvoice.value) {
    onInvoice(previousStoreInvoice.value);
  }
});

const previousInovice: Ref<Invoice | null> = ref(null);
const invoiceDetailsStep: Ref<InvoiceDetailsStep| null> = ref(null);

type Step
  = { index: "input-invoice"; title: string; previousInvoice: Invoice | null }
  | { index: "invoice-details"; step: InvoiceDetailsStep};

const currentStep = computed(() => {
  if(invoiceDetailsStep.value) {
    return {
      index: 'invoice-details',
      step: invoiceDetailsStep.value,
    } as Step;
  }
  return {
    index: 'input-invoice',
    previousInvoice: previousInovice.value,
    title: inputInvoiceTitle.value
  } as Step;
});


const DEBUGGING_NO_CHANNELS_AT_ALL = false;
const DEBUGGING_CHANNELS_NOT_READY = false;

type BlockedReason =
  | { type: 'invoice-expired' } // TODO: 1 +
  | { type: 'invoice-invalid' } // TODO: 1 +
  | { type: 'no-channels-at-all' } // TODO: 2 +
  | { type: 'channels-not-ready', channel: Channel }
  | { type: 'not-enough-capacity' } // TODO: 4 ~ (Message is displayed. Flow not implemented)
  | { type: 'all-channels-closed' } // TODO: 5 + (Not tested yet).

type QuotingProgress =
  | {
    type: 'blocked';
    reason: BlockedReason;
    quoteEstimate: Lovelace;
  }
  | {
    // If we are in `loaded` state and `bestSoFar == null`
    // it means that all the quotes failed.
    type: 'loading' | 'loaded';
    bestSoFar: ChannelQuoteInfo | null;
    allQuoteResults: ChannelQuoteResult[];
  };

type InvoiceDetailsStep = {
  expirationInfo: InvoiceExpirationInfo;
  invoice: Invoice;
  quotingProgress: QuotingProgress;
  title: string;
};

type InvoiceExpirationInfo =
  | { type: 'invalid' }
  | { type: 'expired', expiredAt: ValidDate }
  | { type: 'valid', expiresAt: ValidDate }
  | { type: 'never' };

const getInvoiceExpirationInfo = (invoice: Invoice): InvoiceExpirationInfo => {
  const possibleExpirationDate = Invoice.expirationDate(invoice);
  if(possibleExpirationDate != null) {
    if(possibleExpirationDate.isErr()) {
      return { type: 'invalid' };
    }
    const now = ValidDate.now();
    if(ValidDate.ord.isGreaterThan(now, possibleExpirationDate.value) && !(DEBUGGING_NO_CHANNELS_AT_ALL || DEBUGGING_CHANNELS_NOT_READY)) {
      return { type: 'expired', expiredAt: possibleExpirationDate.value };
    } else {
      return { type: 'valid', expiresAt: possibleExpirationDate.value };
    }
  }
  return { type: 'never' };
}

const checkInvoicePayable = (invoice: Invoice, expirationInfo: InvoiceExpirationInfo, consumer: AppKonduitConsumer): BlockedReason | null => {
  if(expirationInfo.type === 'invalid') {
    return { type: 'invoice-invalid' };
  }
  if(expirationInfo.type === 'expired' && !(DEBUGGING_NO_CHANNELS_AT_ALL || DEBUGGING_CHANNELS_NOT_READY)) {
    return { type: 'invoice-expired' };
  }

  if(consumer.maximumCapacity === null || DEBUGGING_NO_CHANNELS_AT_ALL || DEBUGGING_CHANNELS_NOT_READY) {
    if(consumer.channels.length == 0 || DEBUGGING_NO_CHANNELS_AT_ALL)
      return { type: 'no-channels-at-all' };
    else {
      const notReady = (consumer.channels.filter(ch => !ch.wasApproved || DEBUGGING_CHANNELS_NOT_READY));
      if(notReady.length > 0 || DEBUGGING_CHANNELS_NOT_READY)
        return { type: 'channels-not-ready', channel: notReady[0]! };
      return { type: 'all-channels-closed' };
    }
  }
  // const invoiceAmount =
  console.log("Consumer maximum capacity", consumer.maximumCapacity);
  if(Lovelace.ord.isLessThan(consumer.maximumCapacity, invoice.amount)) {
    return { type: 'not-enough-capacity' };
  }
  return null;
}

const mkInvoiceDetailsBlockedState = (invoice: Invoice, expirationInfo: InvoiceExpirationInfo, reason: BlockedReason): InvoiceDetailsStep => ({
  expirationInfo,
  invoice,
  quotingProgress: {
    type: 'blocked',
    reason,
    // FIXME:
    quoteEstimate: Lovelace.zero,
  },
  title: invoiceDetailsStep.value?.title || 'Payment',
});

const onInvoice = async (invoice: Invoice): Promise<void> => {
  console.log("INVOICE RECEIVED");
  //previousStoreInvoice.value = invoice;
  const consumer = konduitConsumer.value as AppKonduitConsumer | null;
  if(consumer == null) return;
  const expirationInfo = getInvoiceExpirationInfo(invoice);
  const possibleBlockedReason = checkInvoicePayable(invoice, expirationInfo, consumer);
  if(possibleBlockedReason) {
    invoiceDetailsStep.value = mkInvoiceDetailsBlockedState(invoice, expirationInfo, possibleBlockedReason);
    if(possibleBlockedReason.type === 'invoice-expired' || possibleBlockedReason.type === 'invoice-invalid') {
      // If the invoice is already expired, we can clear the invoice cache to avoid confusion.
      previousStoreInvoice.value = null;
    }
    return;
  }
  invoiceDetailsStep.value = {
    expirationInfo,
    invoice,
    quotingProgress: {
      type: 'loading',
      bestSoFar: null,
      allQuoteResults: [],
    },
    title: invoiceDetailsStep.value?.title || 'Payment',
  };

  const [results, theBest] = await consumer.queryQuotes(invoice.raw, (results, bestSoFar) => {
    invoiceDetailsStep.value = {
      expirationInfo,
      invoice,
      quotingProgress: {
        type: 'loading',
        bestSoFar,
        allQuoteResults: results,
      },
      title: invoiceDetailsStep.value?.title || 'Payment',
    };
  });
  invoiceDetailsStep.value = {
    expirationInfo,
    invoice,
    quotingProgress: {
      type: 'loaded',
      bestSoFar: theBest,
      allQuoteResults: results,
    },
    title: invoiceDetailsStep.value?.title || 'Payment',
  };
}

// We want to be able to update the title from a subcomponent.
// Currently it is only valid in the `input-invoice` step.
const inputInvoiceTitle = ref("Input invoice");
const onTitle = (title: string): void => {
  if(currentStep.value?.index === 'input-invoice') {
    inputInvoiceTitle.value = title;
  }
}
const title = computed(() => {
  if(currentStep.value.index === 'input-invoice') {
    return inputInvoiceTitle.value;
  } else if(currentStep.value.index === 'invoice-details') {
    return currentStep.value.step.title;
  }
  return '';
});

const formatters = l10n.useDefaultFormatters();

const hasExpired = computed(() => {
  if(currentStep.value.index !== 'invoice-details') return false;
  const expirationInfo = currentStep.value.step.expirationInfo;
  return expirationInfo.type === 'expired';
});

const formattedExpiresAt = computed((): string => {
  const expirationInfo = currentStep.value.index === 'invoice-details' ? currentStep.value.step.expirationInfo : null;
  if(expirationInfo == null) return MISSING_PLACEHOLDER;
  if(expirationInfo.type === 'invalid') return MISSING_PLACEHOLDER;
  if(expirationInfo.type === 'never') return 'Never';
  if(expirationInfo.type === 'expired') return formatters.formatShortDate(expirationInfo.expiredAt);
  return formatters.formatShortDate(expirationInfo.expiresAt);
});

const formattedExpiredAgo = computed((): string | null => {
  const expirationInfo = currentStep.value.index === 'invoice-details' ? currentStep.value.step.expirationInfo : null;
  if(expirationInfo == null || expirationInfo.type !== 'expired') return null;
  const nowTimestamp = POSIXMilliseconds.now();
  const expirationTimestamp = POSIXMilliseconds.fromValidDate(expirationInfo.expiredAt);
  const expiredMillisecondsAgo = Milliseconds.fromDiffTime(nowTimestamp, expirationTimestamp)
  return formatters.formatDurationLong(expiredMillisecondsAgo);
});

const router = useRouter();

const goBack = () => {
  if(currentStep.value.index === 'input-invoice') {
    return router.push({ name: 'home' });
  } else if(currentStep.value.index === 'invoice-details') {
    // Check if invoice has expired
    const expirationInfo = getInvoiceExpirationInfo(currentStep.value.step.invoice);
    if(expirationInfo.type != 'expired' && expirationInfo.type != 'invalid') {
      previousInovice.value = currentStep.value.step.invoice;
    }
    invoiceDetailsStep.value = null;
  }
};

type PossiblyEstimated<T> = { type: 'real'; actual: T } | { type: 'estimate'; actual: T };
// TODO: handle estimate
const routingFee = computed((): PossiblyEstimated<Millisatoshi> | null => {
  if (currentStep.value.index === 'invoice-details') {
    const quotingProgress = currentStep.value.step.quotingProgress;
    if((quotingProgress.type === 'loaded' || quotingProgress.type === 'loading')
        && quotingProgress.bestSoFar) {
      console.log('Best quote so far', quotingProgress.bestSoFar);
      return { actual: quotingProgress.bestSoFar.quote.routingFee, type: 'real' };
    }
    const milliSats = currentStep.value.step.invoice.amount;
    // ~2%
    return {
      type: 'estimate',
      actual: Millisatoshi.scaleDown(milliSats, PositiveBigInt.fromSmallNumber(50))
    } as PossiblyEstimated<Millisatoshi>;
  }
  return null;
});

const total = computed(()  => {
  if (currentStep.value.index === 'invoice-details') {
    // return mkLovelaceAmount(currentStep.value.quote[1].amount);
    const quotingProgress = currentStep.value.step.quotingProgress;
    if((quotingProgress.type === 'loaded' || quotingProgress.type === 'loading')
        && quotingProgress.bestSoFar) {
      return mkLovelaceAmount(quotingProgress.bestSoFar.quote.amount);
    }
    if(routingFee.value) {
      const routingFeeAmount = routingFee.value.actual;
      const invoiceAmount = currentStep.value.step.invoice.amount;
      return Millisatoshi.add(routingFeeAmount, invoiceAmount).match(
        (totalMilliSats) => mkSatoshiAmount(Satoshi.fromMillisatoshiFloor(totalMilliSats)),
        (error) => {
          console.error('Error calculating total amount', error);
          return mkLovelaceAmount('uknown-yet' as const);
        }
      );
    }
  }
  return mkLovelaceAmount('uknown-yet' as const);
});

const buttons = computed((): ButtonProps[] => {
  const mkPayButton = (disabled: boolean) => ({
    label: 'Pay',
    action: pay,
    primary: true,
    disabled,
  } as ButtonProps);
  if(currentStep.value.index !== 'invoice-details') return [];
  const quotingProgress = currentStep.value.step.quotingProgress;
  if(quotingProgress.type === 'blocked') {
    switch(quotingProgress.reason.type) {
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
      mkPayButton(quotingProgress.type === 'loading'),
    ];
  }
});

const notifications = useNotifications();

const pay = async () => {
  if(currentStep.value.index !== 'invoice-details'
    || currentStep.value.step.quotingProgress.type !== 'loaded'
    || !currentStep.value.step.quotingProgress.bestSoFar) return;
  const quote = currentStep.value.step.quotingProgress.bestSoFar;
  const invoice = currentStep.value.step.invoice;
  const consumerInstance = konduitConsumer.value;
  if(!consumerInstance) return;
  const result = await consumerInstance.pay(quote.channel, quote.quote, invoice);
  result.match(
    (_payment) => notifications.redirectSuccess(
      "Payment successful.",
      { name: "home" }
    ),
    (error) => notifications.redirectError(
      `Payment failed: ${stringify(error)}`,
      { name: "home" }
    )
  );
}

const chargedChannelTxHash = computed(() => {
  if(currentStep.value.index !== 'invoice-details') return null;
  const quotingProgress = currentStep.value.step.quotingProgress;
  if((quotingProgress.type === 'blocked' && quotingProgress.reason.type === 'channels-not-ready')) {
    const openTx = quotingProgress.reason.channel.l1.openTx;
    if(openTx) {
      return openTx.txHash;
    }
  }
  return null;
});

const txUrl = computed(() => {
  const txHash = chargedChannelTxHash.value;
  const networkMagic = konduitConsumer.value?.networkMagicNumber;
  const publicNetwork = networkMagic? PublicNetwork.fromNetworkMagicNumber(networkMagic) : null;

  if(!txHash || !publicNetwork) return null;
  return CardanoScan.mkTransactionPageUrl(publicNetwork, txHash);
});

</script>

<template>
  <MainContainer :buttons="buttons">
    <TheHeader :back-page-name="goBack" :title="title" />
    <template v-if="currentStep.index === 'invoice-details'">
      <div id="invoice-amount">
        <span class="amount">
          <FancyAmount :amount="total" />
        </span>
        <div class="description">
          <MissingDataPlaceholder v-if="!currentStep.step.invoice.description">
            No description provided.
          </MissingDataPlaceholder>
          <span v-else>{{ currentStep.step.invoice.description }}</span>
        </div>
      </div>
      <template v-if="currentStep.step.quotingProgress.type === 'blocked'">
        <Callout
          v-if="currentStep.step.quotingProgress.reason.type === 'invoice-expired'"
          :title="'Invoice expired'"
          :variant="'error'"
        >
          <template #icon>
            <Ban />
          </template>
          It has expired {{ formattedExpiredAgo ? `${formattedExpiredAgo} ago` : '' }}. <br />
        </Callout>
        <Callout
          v-else-if="currentStep.step.quotingProgress.reason.type === 'invoice-invalid'"
          :title="'Invalid invoice'"
          :variant="'error'"
        >
          <template #icon>
            <Ban />
          </template>
          The app had problems parsing the invoice, so it cannot be paid. This can be caused by an invalid invoice format or by unsupported features in the invoice.
        </Callout>
        <Callout
          v-else-if="currentStep.step.quotingProgress.reason.type === 'channels-not-ready'"
          :title="'Lightning charging in progress'"
          :variant="'info'"
        >
          <template #icon>
            <BatteryThrobber />
          </template>
          <!-- Should we add this: It usually takes just a few minutes. -->
          <ul id="opening-steps">
            <li>
              <SquareCheckBig />
              The opening transaction was submitted.
            </li>
            <li>
              <template v-if="txUrl">
                <SquareCheckBig />
                The transaction <Link :href="txUrl" :use-bold="true" :show-icon="true">was&nbsp;confirmed</Link>.
              </template>
              <span v-else>
                <Square />
                Opening transaction is being added to the chain
              </span>
            </li>
            <li><Square /> The adaptor approved the channel.</li>
          </ul>
        </Callout>
        <Callout
          v-else-if="currentStep.step.quotingProgress.reason.type === 'not-enough-capacity'"
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
          v-else-if="currentStep.step.quotingProgress.reason.type === 'no-channels-at-all'"
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

        <p v-else-if="currentStep.step.quotingProgress.reason.type === 'all-channels-closed'">
          All your channels are closed, so you cannot pay this invoice.
        </p>

      </template>
      <DataListing :rows="[
        {
          label: 'Invoice amount',
          formattedValue: {
            string: formatters.formatBtc(Satoshi.fromMillisatoshiFloor(currentStep.step.invoice.amount)),
            importance: 'very-important'
          },
          actions: [[() => console.log('INFO'), 'info']]
        },
        routingFee ? {
          label: routingFee.type == 'real'? 'Routing fee' : 'Estimated routing fee',
          formattedValue: formatters.formatBtcMsat(routingFee.actual),
          actions: [
            [() => console.log('INFO'), 'info'],
          ]
        } : {
          label: 'Routing fee',
          formattedValue: formatters.formatBtc(routingFee),
          actions: [{ action: 'loading' }]
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
      <!--<ButtonGroup class="buttons" v-if="currentStep.index === 'invoice-details' && buttons" :buttons="buttons" /> -->
      <!-- { label: 'Payment hash', formattedValue: hex(currentStep.step.invoice.paymentHash), actions: [] } -->
    </template>
    <InvoiceInput
      v-else
      :previous-invoice="currentStep.previousInvoice"
      @invoice="onInvoice"
      @title="onTitle"
    />
  </MainContainer>
</template>

<style scoped>
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
-->
