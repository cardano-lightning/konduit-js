<script setup lang="ts">
import type { DecodedInvoice, InvoiceInfo } from "@konduit/bln/invoice";
import { computed, ref, type ComputedRef} from "vue";
import InvoiceInput from "./PayPage/InvoiceInput.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";
import * as l10n from "../composables/l10n";
import { abbreviateHex, MISSING_PLACEHOLDER } from "../utils/formatters";
import { ValidDate } from "@konduit/konduit-consumer/time/absolute";

// Use title as subsection in TheHeader
type Step
  = { index: "input-invoice"; title: string }
  | { index: "invoice-details"; invoiceInfo: InvoiceInfo, title: string; }
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

</script>

<template>
  <TheHeader/>
  <div id="container">
    <div v-if="currentStep.index === 'invoice-details'">
      <dl id="invoice-details">
        <dt>Amount</dt>
        <dd class="detail-value amount">
          {{ formatters.formatBtc(currentStep?.invoiceInfo?.decoded.amount) }}
        </dd>

        <dt>Description</dt>
        <dd class="detail-value description">
          {{ currentStep.invoiceInfo.decoded.description || "No description provided" }}
        </dd>

        <dt>Expires</dt>
        <dd class="detail-value">
          {{ formattedExpiresAt }}
        </dd>

        <dt>Destination</dt>
        <dd class="detail-value mono">
          {{ abbreviateHex(invoice?.payee) }}
        </dd>

        <dt>Payment hash</dt>
        <dd class="detail-value mono">
          {{ abbreviateHex(invoice?.paymentHash) }}
        </dd>
      </dl>
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
  </div>
  <NavBar />
</template>

<style scoped>
#container {
  padding: 1rem;
}

#invoice-details {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 1rem;
}

#invoice-details dt {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: left;
}

#invoice-details dd {
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.4;
  text-align: right;
}

#invoice-details dd.amount {
  font-size: 1.2rem;
  font-weight: 700;
}
#invoice-details dd.amount span {
  font-size: 0.9rem;
  font-weight: 600;
  margin-left: 0.25rem;
}

#invoice-details dd.description {
  font-style: italic;
}
</style>
