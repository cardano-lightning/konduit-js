<script lang="ts">
import type { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";

export type Props = {
  previousInvoice: Invoice | null;
};
</script>

<script setup lang="ts">
import ButtonGroup from "../../components/ButtonGroup.vue";
import MainContainer from "../../components/MainContainer.vue";
import QrScan from "../../components/QrScan.vue";
import TheHeader from "../../components/TheHeader.vue";
import type { JsonError } from "@konduit/codec/json/codecs";
import { Result } from "neverthrow";
import { computed, onMounted, onUnmounted, ref, watch, type ComputedRef, type Ref } from "vue";
import { string2InvoiceCodec } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { stringify } from "@konduit/codec/json";
import { type Props as ButtonProps } from "../../components/Button.vue";

const props = defineProps<Props>();

const emit: ((event: "invoice", value: Invoice) => void) = defineEmits(["invoice"]);

const useQrScan: Ref<boolean> = ref(true);

const title: ComputedRef<string> = computed(() => useQrScan.value ? "Scan invoice" : "Enter invoice");

// Both QR scan and manual input use the same decodedInvoice ref to emit results
const decodedInvoice: Ref<Invoice | null> = ref(null);
watch(decodedInvoice, (newVal) => {
  if (newVal !== null) {
    console.log(newVal.raw);
    console.log("Emitting decoded invoice:", newVal);
    emit("invoice", newVal);
  }
});

const validateInvoiceString = (
  raw: string,
  resultRef: Ref<Result<Invoice, JsonError> | null>
) => {
  let val = raw.trim();
  if (val === "") {
    resultRef.value = null;
    return;
  }
  resultRef.value = string2InvoiceCodec.deserialise(raw);
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

const testingInvoices = [
  {
    // ~10 ADA
    invoice: "lightning:LNTB60U1P5EG5P2PP5NXSKU3D3GX6HZ8Q4HU2Q6VC0DACHYNLR5J6U08FQGN5HT2DTD4JSDQQCQZZSXQRRSSSP5QN2CWRQ9QSLU86GQZQF90Q3836GQZ0RPVQRLSVQREELTRZWWMPYS9QXPQYSGQKVM2UDCHS9M35DCA766N9K58JEMTKSCFFME2KRLKDAC0YQTCZNKSTMMFPXSL0NKC3M65605MPXLZTSZDHHZT3A04C43V2DLHVCYWNKSPFTALSW",
    autoTrigger: false,
  }, {
    // ~24 ADA
    invoice: "LNTB146870N1P56QW8DPP544PK5QXFCY4PGYVRT2MVLCW2KW960U36WP6A54PMUUW70Y68YGXSDQQCQZZSXQRRSSSP5L2GA492ZCW2SXCVHCGY0NPX6LGWJCHT4HY5WVX0K293YL7MG0GYQ9QXPQYSGQ5FXRKFSJXASRYW73SQVYC9N6GXGH850TV5LR9U7PY6VCGW4TA2F4KERZ27TUC575NZMUJNPCSDXPXEKXPZTNRULE3C7EZGZGX6MS0XCP4MJ6QX",
    autoTrigger: false,
  }, {
    // ~1 BTC
    invoice: "LNTB11P56RYSPPP5JYQU0EUUG7745QREFW2GG4SS875WF744WLMF3SCEVZEKX6ENXKMQDQQCQZZSXQRRSSSP5XTM2LYY46PCUCTYCDJ92PFP2D4G3F78RP285JZVYVH2PFP3GLVYQ9QXPQYSGQ6H8URLRJ2C3RQD39Y3SPJQ6K3JCN0RAH77G09N8U3VVGEV0U77KNW855EDYMM48UKHC3JKF37LYZ55TY26H0H4DHRWXGU3ZFPM60XTSQFLRSN0",
    autoTrigger: false,
  }, {
    invoice: "LNTB50U1P566LFGPP528SCGWF4L8LNPLP6Q3DQ44VZVRC8F0AY2DCFCXUA966ZPN2YV4LQDQQCQZZSXQRRSSSP5FKF8NNS9XSCGEUURUQYP7G0EK8UZHZ56ERPCT99DVXX2FLGPWGZS9QXPQYSGQ0K7PLQQEM4EHANVA0VHEQUWCS5WSEV53YSKG322RA5TLTVS6WNUYL2ALTSGF7LMV3NNDPSG8W8MJXTHWDQX82MDJ9EASULSAQPCX38GPMYCRCC",
    autoTrigger: false,
  }, {
    invoice: "LNTB50U1P56ARVEPP5ZM40QW7EH9S69DWY5Q8F7TALXGK82M2V5QRN4GREY9HSM4LGQ5GQDQQCQZZSXQRRSSSP5W7A4XNAM2PXKT94M9K70AH2Y7LXTSKHLL8S3FYQ66PN4MJVT28YS9QXPQYSGQAEJ37CDPYUEKHS75QTDKWT0VJ5CAJ8P0KFJLQZLAH5MCQSC2V7EQY3QQA4XHEJZKARCHGW20UXTH57M6SSEHNZGNHGUJ7SX6L6A6JXGPC06RWM",
    autoTrigger: false,
  }, {
    invoice: "LNTB3U1P5MQC0QPP5Y3SN97PATVSDY9644HP9Y7F086UUV0FUY8FAR7S9EKF8TWP3LECSDQQCQZZSXQRRSSSP5DH2NAR3ULU7TMZUU5SZRRGTSZL7XUSK8QTWH8HN2L2TRHWSDGMTQ9QXPQYSGQME4G3XW5QWQYL0NJFW2SZKSTVL244T8YN2X78T3N2MX6G25PPZ75SWZTTTUQ9P4WGRG3PZTXDYWDJJ677H5L6XNGAKKJH0HHL2S3VJQQKCLVST",
    autoTrigger: false,
  }, {
    invoice: "LNTB2001P5MSQ3APP5XAXTFUT5CF4V970GEZM878N6D3K98RG40QY7T3Q3AD98NFZH9A2QDQQCQZZSXQRRSSSP57CHXD2SCEKCHXGQJJF6PRNFC6MUHDVFJQZF9PC27JX082J2J7J2S9QXPQYSGQ959VVP8EE9KTXZCCVLGVVCQ7E5UZ2VW8PKX4RMYASLDP45W682W82H9DFTVGXY0KTHKLVWDL6MVWE2SVPSWCLYX8R72D7U5A5Y37PAGQWL0LHZ",
    autoTrigger: true,
  }
];

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
  for(const testing of testingInvoices) {
    if(testing.autoTrigger) {
      setTimeout(() => {
        console.log("Auto-triggering invoice input for testing purposes.");
        invoiceInputContent.value = testing.invoice;
      }, 500);
      break; // Only trigger the first one that has autoTrigger enabled
    }
  }
  onUnmounted(() => {
    if (resizeObserver.value && textAreaRef.value) {
      resizeObserver.value.unobserve(textAreaRef.value);
    }
  });

});

// This ref is wired to the textarea input and triggers validation on change.
// Another path for setting the invoice is through QR code scanning which
// directly updates the validation result ref.
const invoiceInputContent: Ref<string | null> = ref(null);
const invoiceInputValidationResult: Ref<Result<Invoice, JsonError> | null> = ref(null);
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

const invoiceInputValidationError: ComputedRef<string | null> = computed(() => {
  if(invoiceInputValidationResult.value === null) return null;
  return invoiceInputValidationResult.value.match(
    () => null,
    (error: JsonError) => {
      // TODO: Introduce a better helper for generic error processing
      if(error != null && typeof error === "object" && "message" in error && typeof error.message === "string") {
        return error.message;
      }
      // TODO: This should be a rather a DEBUG mode
      return `Invalid invoice format. Detailed error information: ${stringify(error)}`;
    }
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
  console.log("Validating invoice input content:", val);
  validateInvoiceInputContent(val);
});


const qrPayloadValidationResult: Ref<Result<Invoice, JsonError> | null> = ref(null);
const qrPayloadValidationError: ComputedRef<JsonError | null> = computed(() => {
  if(qrPayloadValidationResult.value === null) return null;
  return qrPayloadValidationResult.value.match(
    () => null,
    (error) => error
  );
});

watch(qrPayloadValidationResult, (newVal) => {
  newVal?.match(
    (invoice) => {
      // Valid invoice
      decodedInvoice.value = invoice;
    },
    (_err) => {
      // Invalid invoice
      decodedInvoice.value = null;
    }
  );
});

const onQrScan = (payload: string) => {
  validateInvoiceString(payload, qrPayloadValidationResult);
};

const qrButtons: ButtonProps[] = [{
  label: "Enter Manually",
  action: () => useQrScan.value = false,
  primary: false,
}];

const manualButtons: ButtonProps[] = [{
    label: "Use QR Scanner",
    action: () => useQrScan.value = true,
    primary: false,
}];
</script>


<template>
  <MainContainer>
    <TheHeader :title="title" id="header" />
    <div id="input-container">
      <div v-if="useQrScan" id="qr-input">
        <div v-if="qrPayloadValidationError" class="parsing-error">
          {{ qrPayloadValidationError || 'Invalid invoice format.' }}
        </div>
        <QrScan @payload="onQrScan" />
        <div class="alternative">or</div>
        <ButtonGroup :buttons="qrButtons" />
      </div>
      <div v-else id="manual-input">
        <div v-if="invoiceInputValidationError" class="parsing-error">
          {{ invoiceInputValidationError || 'Invalid invoice format.' }}
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
      <template v-if="props.previousInvoice">
        <div class="alternative">or</div>
        <ButtonGroup :buttons="[{
          label: 'Use Existing Invoice',
          action: () => decodedInvoice = props.previousInvoice || null,
          primary: false,
        }]" />
      </template>
    </div>
  </MainContainer>
</template>

<style scoped>
#input-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
}
  #input-container #qr-input, #input-container #manual-input {
    flex-grow: 1;
    max-width: 70vh;
  }

.alternative {
  text-align: center;
  margin: 1rem 0;
  font-size: 0.9rem;
  color: var(--primary-color);
  width: 100%;
}

form {
  background-color: var(--hint-background-color);
  border: 2px solid var(--frame-border-color);
  padding: 1rem;
}

.text-input {
  aspect-ratio: 1 / 1;
  background-color: var(--hint-background-color);
  border: none;
  display: block;
  padding: 0;
  width: 100%;
}

.text-input:focus {
  outline: none;
}
textarea.text-input::placeholder {
  color: var(--missing-data-color);
}

.parsing-error {
  color: var(--error-color);
  background-color: var(--error-background-color);
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  word-break: break-all;
}
</style>
