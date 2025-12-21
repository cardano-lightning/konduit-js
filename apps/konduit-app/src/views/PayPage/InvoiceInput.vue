<script setup lang="ts">
import { type DecodedInvoice } from "@konduit/bln/bolt11";
import { computed, onMounted, ref, watch, type ComputedRef, type Ref } from "vue";
import { type Props as ButtonProps } from "../../components/Button.vue";
import ButtonGroup from "../../components/ButtonGroup.vue";
import QrScan from "../../components/QrScan.vue";
import * as bolt11 from "@konduit/bln/bolt11";
import * as bip21 from "@konduit/bln/bip21";

import { err, ok, Result } from "neverthrow";

const emit: ((event: "invoice", value: [string, DecodedInvoice]) => void) = defineEmits(["invoice"]);

const useQrScan: Ref<boolean> = ref(true);

// Both QR scan and manual input use the same decodedInvoice ref to emit results
const decodedInvoice: Ref<[string, DecodedInvoice] | null> = ref(null);
watch(decodedInvoice, (newVal) => {
  if (newVal !== null) {
    emit("invoice", newVal);
  }
});

const validateInvoiceString = (
  raw: string,
  resultRef: Ref<Result<[string, DecodedInvoice], InvoiceError> | null>
) => {
  let val = raw.trim();
  if (val === "") {
    resultRef.value = null;
    return;
  }
  try {
    resultRef.value = bolt11.parse(val).match(
      (invoice) => ok([val, invoice]),
      (_error) => {
        return bip21.parse(val).match(
          ({ options }) => {
            if (!options.lightning) {
              return err({ message: "No invoice found in BIP21 string" });
            }
            return ok([val, options.lightning]);
          },
          (e: bip21.ParseError) => err(e as InvoiceError)
        );
      }
    );
  } catch (e) {
    console.error("Failed to parse request:", e);
    // TODO: This should be reported to the server and presented as application error, not user error
    resultRef.value = err({ message: (e as Error).message || "Unknown error" });
  }
};


// Debounce function (reusable utility)
const debounce = (callback: (val: string) => void, delay: number) => {
  let timeoutId: number | null = null;
  return function(val: string) {
    if(timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(val);
    }, delay);
  };
}

const qrButtons: ButtonProps[] = [
  {
    label: "Enter Manually",
    action: () => useQrScan.value = false,
    primary: false,
  },
];

const manualButtons: ButtonProps[] = [
  {
    label: "Use QR Scanner",
    action: () => useQrScan.value = true,
    primary: false,
  }
];

const textAreaRef: Ref<HTMLElement | null> = ref(null);
const resizeObserver: Ref<ResizeObserver | null> = ref(null);
const textAreaSize: Ref<{ width: number; height: number }> = ref({ width: 0, height: 0 });

onMounted(() => {
  if (textAreaRef.value) {
    resizeObserver.value = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        textAreaSize.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.width,
        };
      }
    });
    resizeObserver.value.observe(textAreaRef.value);
  }
});

type InvoiceError = bip21.ParseError | { message: string };

const invoiceInputContent: Ref<string | null> = ref(null);
const invoiceInputValidationResult: Ref<Result<[string, DecodedInvoice], InvoiceError> | null> = ref(null);
watch(invoiceInputValidationResult, (newVal) => {
  newVal?.match(
    (invoiceInfo) => {
      // Valid invoice
      decodedInvoice.value = invoiceInfo;
    },
    (_err) => {
      // Invalid invoice
      decodedInvoice.value = null;
    }
  );
});

const invoiceInputValidationError: ComputedRef<InvoiceError | null> = computed(() => {
  if(invoiceInputValidationResult.value === null) return null;
  return invoiceInputValidationResult.value.match(
    () => null,
    (error) => error
  );
});

// Debounce relies on the closure to keep the timeoutId
// between calls so we define it outside the watcher.
const validateInvoiceInputContent = debounce(
  (str) => validateInvoiceString(str, invoiceInputValidationResult),
  500
);

watch(invoiceInputContent, (val) => {
  if (val === null || val === "") {
    invoiceInputValidationResult.value = null;
    return;
  }
  validateInvoiceInputContent(val);
});

const qrPayloadValidationResult: Ref<Result<[string, DecodedInvoice], InvoiceError> | null> = ref(null);

const qrPayloadValidationError: ComputedRef<InvoiceError | null> = computed(() => {
  if(qrPayloadValidationResult.value === null) return null;
  return qrPayloadValidationResult.value.match(
    () => null,
    (error) => error
  );
});

watch(qrPayloadValidationResult, (newVal) => {
  newVal?.match(
    (invoiceInfo) => {
      // Valid invoice
      decodedInvoice.value = invoiceInfo;
    },
    (_err) => {
      // Invalid invoice
      decodedInvoice.value = null;
    }
  );
});

const onQrScan = (payload: string) => {
  console.log("Scanned QR payload:", payload);
  validateInvoiceString(payload, qrPayloadValidationResult);
};
</script>


<template>
  <div id="container">
      <div v-if="qrPayloadValidationError" style="color: red; margin-bottom: 0.5rem;">
        {{ qrPayloadValidationError.message || 'Invalid invoice format.' }}
      </div>
    <div v-if="useQrScan">
      <QrScan @payload="onQrScan" />
      <ButtonGroup :buttons="qrButtons" />
    </div>
    <div v-else>
      <div style="margin-bottom: 1rem; word-break: break-all;">
        Sample Invoice:
        <br />
      lightning:LNTB5U1P5503JXPP5RMCN6ACJEFVUWRZGGNY5UVC0NN0VT09335DWS3YG4U6SAJD9C2YQDQQCQZZSXQRRSSSP5957GWTRVHFUMS5P6MD2JSN2DVZF4XE2NFPFGP0AK2RJ23ACQFD6Q9QXPQYSGQM27VJFEZ46TGJ4KAVV7X8W78L0TX3ZQTWHUF8CW6XZRDQS2UUPAZGERVZK9NMYMTGTVPCPLC9JC39WPXF9WKVFGHM94FYREHM4Y9E2QPNEXYU9
      </div>
      <div v-if="invoiceInputValidationError" style="color: red; margin-bottom: 0.5rem;">
        {{ invoiceInputValidationError.message || 'Invalid invoice format.' }}
      </div>
      <form> <!-- @submit.prevent="handleManualNext"> -->
        <textarea
          ref="textAreaRef"
          class="text-input"
          id="invoice"
          v-model="invoiceInputContent"
          style="width: {{ textAreaSize.width }}px; height: {{ textAreaSize.height }}px;"
          placeholder="lnb..."
          />
      </form>
      <ButtonGroup :buttons="manualButtons" />
    </div>
  </div>
</template>

<style scoped>
/* This mirrors the scanner-view border from QrScan.vue */
form {
  background: #fff;
  border: 2px solid #d1d5db;
  padding: 1rem;
}

.text-input {
  aspect-ratio: 1 / 1;
  border: none;
  display: block;
  padding: 0;
  width: 100%;
}
.text-input:focus {
  outline: none;
}

/*
.input-invoice-container {
  width: 98%;
}

.buttons {
  padding: 4rem 0;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: space-around;
  align-content: space-around;
  align-items: center;
}

textarea {
  width: 98%;
}

.input {
  width: 100%;
  display: flex;
  justify-content: center;
}

.error-message {
  padding: 1rem;
  color: #d93025;
  background-color: #fbe9e7;
  margin-top: 1rem;
  text-align: center;
  width: 98%;
}

.input-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pay-container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
*/
</style>
