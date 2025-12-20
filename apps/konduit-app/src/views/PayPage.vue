<script setup lang="ts">
/// import { DecodedInvoice } from "@konduit-js/bln/bolt11";
import { ref} from "vue";
import InvoiceInput from "./PayPage/InvoiceInput.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";

// A mock
type DecodedInvoice = string;

type Step
  = { index: "input"; title: "Input Invoice" }
  | { index: "approve"; decodedInvoice: DecodedInvoice; title: "Approve Invoice" }
  | { index: "quotes"; decodedInvoice: DecodedInvoice; quoteInfo: any; title: "Select Quote" }
  | { index: "submit"; decodedInvoice: DecodedInvoice; quoteInfo: any, pendingPay: any; title: "Submitting Payment" };

// const stepIndexMap: Record<string, number> = {
//   input: 0,
//   approve: 1,
//   quotes: 2,
//   submit: 3,
// };

// If the user go backs we do not preserve state for now and recompute or refetch it.
const currentStep = ref<Step>({ index: "input", title: "Input Invoice" });

</script>

<template>
  <TheHeader />
  <div class="container">
    <div v-if="currentStep.index === 'approve'" class="step-indicator">
      "Approve"
    </div>
    <InvoiceInput
      v-else
      @invoice="
        (val: string) => {
          currentStep = { index: 'approve', decodedInvoice: val, title: 'Approve Invoice' };
        }
      "
    />
  </div>
  <NavBar />
</template>
