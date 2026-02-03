<script setup lang="ts">
import type { InvoiceInfo, InvoiceError } from "@konduit/bln/invoice";
import * as invoice from "@konduit/bln/invoice";
import { computed, onMounted, ref, watch, type ComputedRef, type Ref } from "vue";
import { type Props as ButtonProps } from "../../components/Button.vue";
import ButtonGroup from "../../components/ButtonGroup.vue";
import QrScan from "../../components/QrScan.vue";
import { Result } from "neverthrow";

// InvoiceInfo is just a tuple of `[InvoiceString, DecodedInvoice]`
const emit: ((event: "invoice", value: InvoiceInfo) => void) = defineEmits(["invoice"]);

const useQrScan: Ref<boolean> = ref(true);

// Both QR scan and manual input use the same decodedInvoice ref to emit results
const decodedInvoice: Ref<InvoiceInfo | null> = ref(null);
watch(decodedInvoice, (newVal) => {
  if (newVal !== null) {
    emit("invoice", newVal);
  }
});

const validateInvoiceString = (
  raw: string,
  resultRef: Ref<Result<InvoiceInfo, InvoiceError> | null>
) => {
  let val = raw.trim();
  if (val === "") {
    resultRef.value = null;
    return;
  }
  return invoice.parse(raw);
};


// Debounce function (reusable utility)
const debounce = (callback: (val: string) => void, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(val: string) {
    if(timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(val);
    }, delay);
  };
}
const textAreaRef: Ref<HTMLElement | null> = ref(null);
const resizeObserver: Ref<ResizeObserver | null> = ref(null);
const textAreaSize: Ref<{ width: number; height: number }> = ref({ width: 0, height: 0 });

const testing = {
  invoice: "lightning:LNTB6U1P54HQLJPP5EZUCLJSJFWNNYX5XDPUHH4NHPVPTCG330TTHQ6L7RAS9SJM9AWDQDQQCQZZSXQRRSSSP54XRLF7PZ2EEGPN7EL4SY9WZEZTJWVW9TUTN83L70CMM3H4LF3M7S9QXPQYSGQFTY8SYDWU4HKCAVKA3FTXKD52V0L9LQMA9UN4A3FMWW38STU9NS5GKL0GAMV73595ZUNJ3R80V3U6J0JKKR2PVVW80TRRQ0G8RAFTDCQZF36N3",
  autoTrigger: true,
};

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
  if(testing.autoTrigger) {
    setTimeout(() => {
      invoiceInputContent.value = testing.invoice;
    }, 500);
  }
});

const invoiceInputContent: Ref<string | null> = ref(null);
const invoiceInputValidationResult: Ref<Result<InvoiceInfo, InvoiceError> | null> = ref(null);
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
const validateInvoiceInputContent = debounce((str) => validateInvoiceString(str, invoiceInputValidationResult), 500);

watch(invoiceInputContent, (val) => {
  if (val === null || val === "") {
    invoiceInputValidationResult.value = null;
    return;
  }
  validateInvoiceInputContent(val);
});


const qrPayloadValidationResult: Ref<Result<InvoiceInfo, InvoiceError> | null> = ref(null);

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
</script>


<template>
  <div v-if="useQrScan">
    <div v-if="qrPayloadValidationError" class="parsing-error">
      {{ qrPayloadValidationError.message || 'Invalid invoice format.' }}
    </div>
    <QrScan @payload="onQrScan" />
    <div class="alternative">or</div>
    <ButtonGroup :buttons="qrButtons" />
  </div>
  <div v-else>
    <div v-if="invoiceInputValidationError" class="parsing-error">
      {{ invoiceInputValidationError.message || 'Invalid invoice format.' }}
    </div>
    <form>
      <textarea
        ref="textAreaRef"
        class="text-input"
        id="invoice"
        v-model="invoiceInputContent"
        style="width: {{ textAreaSize.width }}px; height: {{ textAreaSize.height }}px;"
        placeholder="lntb..."
        />
    </form>
    <div class="alternative">or</div>
    <ButtonGroup :buttons="manualButtons" />
  </div>
</template>

<style scoped>
.alternative {
  text-align: center;
  margin: 1rem 0 0;
  font-size: 0.9rem;
  color: #6b7280;
  width: 100%;
}

form {
  border: 2px solid var(--frame-border-color);
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

.parsing-error {
  color: var(--error-color);
  background-color: var(--error-background-color);
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  word-break: break-all;
}
</style>
