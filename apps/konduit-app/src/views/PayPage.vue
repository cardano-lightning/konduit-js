<script setup lang="ts">
import { AlertTriangle } from "lucide-vue-next";
import Callout from "../components/Callout.vue";
import InvoiceDetails from "./PayPage/InvoiceDetails.vue";
import InvoiceInput from "./PayPage/InvoiceInput.vue";
import MainContainer from "../components/MainContainer.vue";
import { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { onMounted, ref } from "vue";
import { invoice as previousStoreInvoice } from "../store";
import { konduitConsumer, type AppKonduitConsumer } from "../store";

// The flow is as follows:
// * If we are initializing we check the store invoice and load it

const invoice = ref<Invoice | null>(null);

// We set this only when we go back to scanning
// so the input component can propose the previous invoice
// for convenience.
// We need some invalidation signaling from the details
// page so we can drop the invalid invoice from the
// context.
const previousInvoice = ref<Invoice | null>(null);

onMounted(() => {
  if(previousStoreInvoice.value) {
    invoice.value = previousStoreInvoice.value;
  }
});

const onInvoice = async (newInvoice: Invoice): Promise<void> => {
  const consumer = konduitConsumer.value as AppKonduitConsumer | null;
  if(consumer == null) return;
  invoice.value = newInvoice;
  previousStoreInvoice.value = newInvoice;
}

const onBackToScanning = () => {
  previousInvoice.value = invoice.value;
  invoice.value = null;
  previousStoreInvoice.value = null;
}
</script>

<template>
  <InvoiceInput
    v-if="invoice === null"
    :previous-invoice="previousInvoice"
    @invoice="onInvoice"
  />
  <InvoiceDetails
    v-else-if="konduitConsumer && invoice"
    :invoice="invoice"
    :consumer="konduitConsumer as AppKonduitConsumer"
    @back="onBackToScanning"
  />
  <div v-else>
    <MainContainer>
      <Callout
        :title="'Invalid application state'"
        :variant="'error'"
      >
        <template #icon>
          <AlertTriangle />
        </template>
        The application is in an invalid state. Please restart the app and try again.
      </Callout>
    </MainContainer>
  </div>
</template>

