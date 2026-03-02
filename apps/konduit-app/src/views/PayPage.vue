<script setup lang="ts">
import HandCoins from "../components/icons/HandCoins.vue";
import Callout from "../components/Callout.vue";
import Button from "../components/Button.vue";
import Zap from "../components/icons/Zap.vue";
import type { Props as ButtonProps } from "../components/Button.vue";
import TriangleAlert from "../components/icons/TriangleAlert.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import FancyAmount, { mkLovelaceAmount } from "../components/FancyAmount.vue";
import Hr from "../components/Hr.vue";
import { mkSatoshiAmount } from "../components/FancyAmount.vue";
import MissingDataPlaceholder from "../components/MissingDataPlaceholder.vue";
import DataListing from "../components/DataListing.vue";
import MainContainer from "../components/MainContainer.vue";
import { computed, onMounted, ref, type Ref} from "vue";
import InvoiceInput from "./PayPage/InvoiceInput.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";
import * as l10n from "../composables/l10n";
import { hex, MISSING_PLACEHOLDER, orPlaceholder } from "../utils/formatters";
import { ValidDate } from "@konduit/konduit-consumer/time/absolute";
import { konduitConsumer, type AppKonduitConsumer } from "../store";
import { useRouter } from "vue-router";
import type { Channel } from "@konduit/konduit-consumer/channel";
import type { ChannelQuoteInfo, ChannelQuoteResult } from "@konduit/konduit-consumer";
import type { Quote } from "@konduit/konduit-consumer/adaptorClient";
import { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { Lovelace } from "@konduit/konduit-consumer/cardano";
import { invoice as previousStoreInvoice } from "../store";
import { stringify, type Json } from "@konduit/codec/json";
import { Millisatoshi, Satoshi } from "@konduit/konduit-consumer/bitcoin";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import type { Result } from "neverthrow";


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


const DEBUGGING_NO_CHANNELS_AT_ALL=true;
type BlockedReason =
  | 'invoice-expired' // TODO: 1 +
  | 'invoice-invalid' // TODO: 1 +
  | 'no-channels-at-all' // TODO: 2 ~
  | 'channels-not-ready' // TODO: 3 -
  | 'not-enough-capacity' // TODO: 4 -
  | 'all-channels-closed' // TODO: 5 -

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
    if(ValidDate.ord.isGreaterThan(now, possibleExpirationDate.value) && !DEBUGGING_NO_CHANNELS_AT_ALL) {
      return { type: 'expired', expiredAt: possibleExpirationDate.value };
    } else {
      return { type: 'valid', expiresAt: possibleExpirationDate.value };
    }
  }
  return { type: 'never' };
}

const checkInvoicePayable = (invoice: Invoice, consumer: AppKonduitConsumer): BlockedReason | null => {
  const invoiceExpirationInfo = getInvoiceExpirationInfo(invoice);
  if(invoiceExpirationInfo.type === 'invalid') {
    return 'invoice-invalid';
  }
  if(invoiceExpirationInfo.type === 'expired') {
    return 'invoice-expired';
  }

  if(consumer.maximumCapacity === null) {
    if(consumer.channels.length == 0)
      return 'no-channels-at-all';
    else if(consumer.channels.some(ch => !ch.wasApproved))
      return 'channels-not-ready';
    else
      return 'all-channels-closed';
  }
  if(consumer.maximumCapacity < invoice.amount) {
    return 'not-enough-capacity';
  }
  return null;
}

const mkInvoiceDetailsBlockedState = (invoice: Invoice, reason: BlockedReason): InvoiceDetailsStep => ({
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
  const consumer = konduitConsumer.value as AppKonduitConsumer | null;
  if(consumer == null) return;
  const possibleBlockedReason = checkInvoicePayable(invoice, consumer);
  if(possibleBlockedReason) {
    invoiceDetailsStep.value = mkInvoiceDetailsBlockedState(invoice, possibleBlockedReason);
    if(possibleBlockedReason === 'invoice-expired' || possibleBlockedReason === 'invoice-invalid') {
      // If the invoice is already expired, we can clear the previous invoice to avoid confusion.
      previousStoreInvoice.value = null;
    } else {
      previousStoreInvoice.value = invoice;
    }
    return;
  }
  invoiceDetailsStep.value = {
    invoice,
    quotingProgress: {
      type: 'loading',
      bestSoFar: null,
      allQuoteResults: [],
    },
    title: 'Loading quotes…',
  };

  const [results, theBest] = await consumer.queryQuotes(invoice.raw, (results, bestSoFar) => {
    invoiceDetailsStep.value = {
      invoice,
      quotingProgress: {
        type: 'loading',
        bestSoFar,
        allQuoteResults: results,
      },
      title: 'Quotes loaded',
    };
  });
  invoiceDetailsStep.value = {
    invoice,
    quotingProgress: {
      type: 'loaded',
      bestSoFar: theBest,
      allQuoteResults: results,
    },
    title: 'Quotes loaded',
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

const formattedExpiresAt = computed((): string => {
  if(currentStep.value.index !== 'invoice-details') return MISSING_PLACEHOLDER;
  const expirationInfo = getInvoiceExpirationInfo(currentStep.value.step.invoice);
  if(expirationInfo.type === 'invalid') return MISSING_PLACEHOLDER;
  if(expirationInfo.type === 'never') return 'Never';
  if(expirationInfo.type === 'expired') return formatters.formatShortDate(expirationInfo.expiredAt);
  return formatters.formatShortDate(expirationInfo.expiresAt);
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
    if(quotingProgress.reason === 'no-channels-at-all') {
      return [
      {
        label: 'Cancel',
        action: () => router.push({ name: 'home' }),
        primary: false,
      },
      {
        label: 'Open channel',
        action: () => router.push({
          name: 'open-channel',
          query: { redirectTo: router.currentRoute.value.fullPath }
        }),
        primary: true,
      }];
    }
    return [];
  }
  return [
    {
      label: 'Forget',
      action: () => router.push({ name: 'home' }),
      primary: false,
    },
    mkPayButton(quotingProgress.type === 'loading'),
  ];

});

const pay = () => {
  // OLD:
  // if(currentStep.value.index !== 'invoice-details' || !currentStep.value.quote) return;
  //  const [channel, quote] = currentStep.value.quote;
  //  const invoice = currentStep.value.invoice;

  //  // We want to test different scenarios
  //  const invalidQuote = {
  //    ...quote,
  //    amount: quote.amount + BigInt(10000000) as Lovelace
  //  }
  //  konduitConsumer.value?.pay(channel, invalidQuote, invoice).then(result => {
  //    result.match(
  //      (payment) => {
  //        console.log('Payment successful', payment);
  //      },
  //      (error) => {
  //        console.error('Payment failed', error);
  //      }
  //    );
  //  });


  // OLDER:
  // public pay = async (channel: Channel, quote: Quote, invoice: Invoice): Promise<Result<ConfirmedPayment | FailedPayment, PayError>> => {
  // result.match(
  //   (payment) => {
  //     console.log('Payment successful', payment);

  // console.log('Paying invoice with quote', currentStep.value.quote);
}
</script>

<template>
  <MainContainer>
    <TheHeader :back-page-name="goBack" :title="title" />
    <template v-if="currentStep.index === 'invoice-details'">
      <div id="invoice-amount">
        <span class="amount">
          <FancyAmount :amount="total" />
        </span>
        <div class="description">
          <MissingDataPlaceholder v-if="!currentStep.step.invoice.description">
            No description provided
          </MissingDataPlaceholder>
          <span v-else>{{ currentStep.step.invoice.description }}</span>
        </div>
      </div>
      <!--
        // title: (() => {
        //   switch(reason) {
        //     case 'invoice-expired':
        //       return 'Invoice expired';
        //     case 'invoice-invalid':
        //       return 'Invoice invalid';
        //     case 'no-channels-at-all':
        //       return 'No channels available';
        //     case 'channels-not-ready':
        //       return 'Channels not ready';
        //     case 'not-enough-capacity':
        //       return 'Not enough capacity';
        //     case 'all-channels-closed':
        //       return 'All channels closed';
        //   }
        // })(),
      -->
      <template v-if="currentStep.step.quotingProgress.type === 'blocked'">
        <p v-if="currentStep.step.quotingProgress.reason === 'invoice-expired'">
          <b>Invoice expired</b>
          This invoice has expired at {{ formattedExpiresAt }}.
        </p>
        <p v-else-if="currentStep.step.quotingProgress.reason === 'invoice-invalid'">
          <b>Invalid invoice</b>
          The app had problems parsing the invoice, so it cannot be paid. This can be caused by an invalid invoice format or by unsupported features in the invoice.
        </p>
        <p v-else-if="currentStep.step.quotingProgress.reason === 'channels-not-ready'">
          You have channels that are not ready yet. Once they are ready, you will be able to pay this invoice.
        </p>
        <p v-else-if="currentStep.step.quotingProgress.reason === 'not-enough-capacity'">
          You don't have enough capacity in your channels to pay this invoice.
        </p>
        <p v-else-if="currentStep.step.quotingProgress.reason === 'all-channels-closed'">
          All your channels are closed, so you cannot pay this invoice.
        </p>

        <Callout
          v-else-if="currentStep.step.quotingProgress.reason === 'no-channels-at-all'"
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
        <!-- <Hr id="error-separator" /> -->
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
          formattedValue: formatters.formatBtc(Satoshi.fromMillisatoshiFloor(routingFee.actual)),
          actions: [
            [() => console.log('INFO'), 'info'],
          ]
        } : {
          label: 'Routing fee',
          formattedValue: formatters.formatBtc(routingFee),
          actions: [{ action: 'loading' }]
        },
        'separator',
        { label: 'Expires', formattedValue: formattedExpiresAt, actions: [] },
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
      <ButtonGroup class="buttons" v-if="currentStep.index === 'invoice-details' && buttons" :buttons="buttons" />
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

#error-block {
  background-color: var(--hint-background-color);
  border: 1px solid var(--frame-border-color);
  color: var(--hint-color);
  display: flex;
  flex-direction: column;
  padding: 1em 1em;
  place-items: center;
}
  #error-block h2 {
    align-items: center;
    display: flex;
    font-size: 1em;
    gap: 0.5em;
    margin: 0 0 1em 0;
  }
    #error-block h2 svg {
      width: 1.5em;
      height: 1.5em;
      flex-shrink: 0;
    }

  #error-block p {
    flex: 1;
    line-height: 1.4em;
    margin: 0;
    padding: 0;
    text-align: center;
  }

hr#error-separator {
  margin-bottom: var(--data-listing-gap);
  margin-top: var(--data-listing-gap);
  padding-top: 0;
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
