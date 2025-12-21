<script setup lang="ts">
import { type DecodedInvoice } from "@konduit/bln/bolt11";
import { ref} from "vue";
import InvoiceInput from "./PayPage/InvoiceInput.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";

type Step
  = { index: "input"; title: "Input Invoice" }
  | { index: "approve"; decodedInvoice: DecodedInvoice; rawInvoice: string, title: "Approve Invoice" }
  | { index: "quotes"; decodedInvoice: DecodedInvoice; rawInvoice: string, quoteInfo: any; title: "Select Quote" }
  | { index: "submit"; decodedInvoice: DecodedInvoice; rawInvoice: string, quoteInfo: any, pendingPay: any; title: "Submitting Payment" };

// const stepIndexMap: Record<string, number> = {
//   input: 0,
//   approve: 1,
//   quotes: 2,
//   submit: 3,
// };

// If the user go backs we do not preserve state for now and recompute or refetch it.
const currentStep = ref<Step>({ index: "input", title: "Input Invoice" });
const onInvoice = (value: [string, DecodedInvoice]): void => {
  const [rawInvoice, decodedInvoice] = value;
  console.log('Invoice received in PayPage:', rawInvoice);
  currentStep.value = { index: 'approve', decodedInvoice, rawInvoice, title: 'Approve Invoice' };
}

</script>

<template>
  <TheHeader />
  <div v-if="currentStep.index === 'approve'" class="step-indicator">
    "Approve"
  </div>
  <InvoiceInput
    v-else
    @invoice="onInvoice"
  />
  <NavBar />
</template>
