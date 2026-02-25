<script setup lang="ts">
import FancyAmount, { mkSatoshiAmount } from "../components/FancyAmount.vue";
import MissingDataPlaceholder from "../components/MissingDataPlaceholder.vue";
import MainContainer from "../components/MainContainer.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import type { DecodedInvoice, InvoiceInfo } from "@konduit/bln/invoice";
import DataListing from "../components/DataListing.vue";
import { computed, ref, type ComputedRef} from "vue";
import InvoiceInput from "./PayPage/InvoiceInput.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";
import * as l10n from "../composables/l10n";
import { hex, MISSING_PLACEHOLDER, orPlaceholder } from "../utils/formatters";
import { ValidDate } from "@konduit/konduit-consumer/time/absolute";
import { channels } from "../store";
import { useRouter } from "vue-router";

// Use title as subsection in TheHeader
type Step
  = { index: "input-invoice"; title: string }
  | { index: "invoice-details"; invoiceInfo: InvoiceInfo, title: string; }
  | { index: "channels-missing"; invoiceInfo: InvoiceInfo, title: string; }
  | { index: "channels-not-ready"; invoiceInfo: InvoiceInfo, title: string; }
  | { index: "quotes"; invoiceInfo: InvoiceInfo, quoteInfo: any; title: string; }
  | { index: "submit"; invoiceInfo: InvoiceInfo, quoteInfo: any, pendingPay: any; title: string; };

const currentStep = ref<Step>({ index: "input-invoice", title: "Input invoice" });
const onInvoice = (invoiceInfo: InvoiceInfo): void => {
  currentStep.value = { index: 'invoice-details', invoiceInfo, title: 'Invoice details' };
}

const invoice: ComputedRef<DecodedInvoice| null> = computed(() => {
  if(currentStep.value.index == "input-invoice") return null;
  return currentStep.value.invoiceInfo.decoded;
});

const formatters = l10n.useDefaultFormatters();

type ExpiresAt = ValidDate | 'never';

const expiresAt = computed((): ExpiresAt | null => {
  const inv = invoice.value;
  if(inv === null) return null;
  if(!inv.expiry) return 'never';
  return ValidDate.fromDate(new Date((inv.timestamp + inv.expiry) * 1000)).match(
    (vd) => vd,
    // FIXME: This should be reported
    () => null
  );
});

const formattedExpiresAt = computed((): string => {
  const exp = expiresAt.value;
  if(exp === null) return MISSING_PLACEHOLDER;
  if(exp === 'never') return 'Never';
  return formatters.formatShortDate(exp);
});

const router = useRouter();

const goBack = () => {
  if(currentStep.value.index === 'input-invoice') {
    return router.push({ name: 'home' });
  } else if(currentStep.value.index === 'invoice-details') {
    currentStep.value = { index: 'input-invoice', title: 'Input invoice' };
  } else if (currentStep.value.index === 'channels-missing' || currentStep.value.index === 'channels-not-ready') {
    currentStep.value = { index: 'invoice-details', invoiceInfo: currentStep.value.invoiceInfo, title: 'Invoice details' };
  } else if (currentStep.value.index === 'quotes') {
    currentStep.value = { index: 'invoice-details', invoiceInfo: currentStep.value.invoiceInfo, title: 'Invoice details' };
  } else if (currentStep.value.index === 'submit') {
    currentStep.value = { index: 'quotes', invoiceInfo: currentStep.value.invoiceInfo, quoteInfo: currentStep.value.quoteInfo, title: 'Quotes' };
  }
};

const goToQuotes = () => {
  if(currentStep.value.index !== 'invoice-details') return;
  if(channels.value.length === 0) {
    currentStep.value = {
      index: 'channels-missing',
      invoiceInfo: currentStep.value.invoiceInfo,
      title: 'Channels missing'
    };
    return;
  } else if (channels.value.some(ch => !ch.isOperational)) {
    currentStep.value = {
      index: 'channels-not-ready',
      invoiceInfo: currentStep.value.invoiceInfo,
      title: 'Channels not ready'
    };
    return;
  }
  currentStep.value = { index: 'quotes', invoiceInfo: currentStep.value.invoiceInfo, quoteInfo: null, title: 'Quotes' };
}

// const amount = formatters.formatBtc(currentStep?.invoiceInfo?.decoded.amount || 0)

const amount = computed(() => {
  if (currentStep.value.index === 'invoice-details' && currentStep.value.invoiceInfo.decoded.amount) {
    return mkSatoshiAmount(currentStep.value.invoiceInfo.decoded.amount);
  }
  return null;
});
</script>

<template>
  <TheHeader :back-page-name="goBack" />
  <MainContainer>
    <template v-if="currentStep.index === 'invoice-details'">
      <div id="total">
        <span class="amount"><FancyAmount :amount="amount" /></span>
        <div class="description">
          <MissingDataPlaceholder v-if="!currentStep.invoiceInfo.decoded.description">
            No description provided
          </MissingDataPlaceholder>
          <span v-else>{{ currentStep.invoiceInfo.decoded.description }}</span>
        </div>
      </div>
      <Hr />
      <DataListing :rows="[
        { label: 'Expires', formattedValue: formattedExpiresAt },
        { label: 'Destination',
          formattedValue: orPlaceholder(invoice?hex(invoice?.payee):''),
          actions: invoice?.payee? [
            { action: 'copy' as const, message: 'Destination copied to clipboard.', value: hex(invoice.payee) }
          ]:[]
        },
        { label: 'Payment hash', formattedValue: invoice?hex(invoice?.paymentHash):'', actions: [] }
      ]" />
      <ButtonGroup class="buttons" v-if="currentStep.index === 'invoice-details'" :buttons="[
        {
          label: 'Continue',
          action: () => goToQuotes(),
          primary: true,
        }
      ]" />
    </template>
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
      <!-- Quotes component would go here -->
      <p>Quotes step (not implemented)</p>
    </div>
    <div v-else-if="currentStep.index === 'submit'">
      <!-- Submit payment component would go here -->
      <p>Submit payment step (not implemented)</p>
    </div>
    <InvoiceInput
      v-else
      @invoice="onInvoice"
    />
  </MainContainer>
  <NavBar />
</template>

<style scoped>
.buttons {
  margin-top: 3rem;
}
#total {
  text-align: center;
}
  #total .amount {
    font-size: 1.5rem;
  }
  #total .description {
    font-size: 0.8rem;
    margin-top: 1rem;
    text-align: center;
  }
  #total .description .missing {
    font-style: italic;
  }

hr {
  margin: 2.5rem 0;
}

</style>
