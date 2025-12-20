<script setup lang="ts">
import { onMounted, ref, type Ref } from "vue";
import { type Props as ButtonProps } from "../../components/Button.vue";
import ButtonGroup from "../../components/ButtonGroup.vue";
import QrScan from "../../components/QrScan.vue";
// import { parsePayRequest } from "../bln/payRequest.js";

const emit = defineEmits(["invoice"]);

const useQrScan: Ref<boolean> = ref(false);

const toggleInputMode = () => {
  useQrScan.value = !useQrScan.value;
};

const invoiceRaw: Ref<string | null> = ref(null);
// const error = ref(null);

const onQrScan = (payload: string) => {
  emit("invoice", payload);
};

// // Called by the "Next" button in manual mode
const handleManualNext = () => {
  console.log("Manual invoice entered:", invoiceRaw.value);
  // handleParse(invoiceRaw.value);
};

const qrButtons: ButtonProps[] = [
  {
    label: "Cancel",
    action: toggleInputMode,
    primary: false,
  },
  {
    label: "Enter Manually",
    action: toggleInputMode,
    primary: false,
  },
];

const manualButtons: ButtonProps[] = [
  {
    label: "Use QR Scanner",
    action: toggleInputMode,
    primary: false,
  },
  {
    label: "Next",
    action: handleManualNext,
    primary: true,
  },
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


// // The core parsing logic
// const handleParse = (rawInvoice) => {
//   error.value = null;
//   if (!rawInvoice || rawInvoice.trim() === "") {
//     error.value = "Invoice string cannot be empty.";
//     return;
//   }
//   try {
//     console.log("Parsed request:", parsePayRequest(rawInvoice));
//     emit("invoice", parsePayRequest(rawInvoice));
//   } catch (e) {
//     console.error("Failed to parse request:", e);
//     error.value = `Invalid Input: ${e.message || "Unknown error"}`;
//   }
// };
// @click="invoiceRaw = 'lntb123450n1p5sh2fspp57pqutvc6q9d30kh6qyxvpx07qrqrrut8czk45wvut8trluqxnpqsdqdfahhqumfv5sjzcqzzsxqr3jssp5qpntdg40qcxeh3xy43us0zk3djqh5v2peldrtdp70gd7vpcy6wes9qxpqysgqa54uah5f9sw065t9unereh0vm0jjqwq6tulnd42pnxa6yl8e92xpkpgz5tpw0fx7v05lfkl93qumr80dk4xrnakkgh57xxk53e3kccqp5kwles'">

</script>


<template>
  <div id="container">
    <div v-if="useQrScan">
      <QrScan @payload="onQrScan" />
      <ButtonGroup :buttons="qrButtons" />
    </div>
    <div v-else>
      <form @submit.prevent="handleManualNext">
        <textarea
          ref="textAreaRef"
          class="text-input"
          id="invoice"
          v-model="invoiceRaw"
          style="width: {{ textAreaSize.width }}px; height: {{ textAreaSize.height }}px;"
          placeholder="lnb..."
          />
      </form>
      <ButtonGroup :buttons="manualButtons" />
    </div>
  </div>

  <!--
    <div class="input">
      <QrScan v-if="invoiceRaw == null" @payload="onQrScan" />
      <form v-else @submit.prevent="handleManualNext">
        <textarea id="invoice" v-model="invoiceRaw" placeholder="lnb..." />
      </form>
    </div>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    <div class="buttons">
      <button v-if="invoiceRaw == null" @click="invoiceRaw = 'lntb123450n1p5sh2fspp57pqutvc6q9d30kh6qyxvpx07qrqrrut8czk45wvut8trluqxnpqsdqdfahhqumfv5sjzcqzzsxqr3jssp5qpntdg40qcxeh3xy43us0zk3djqh5v2peldrtdp70gd7vpcy6wes9qxpqysgqa54uah5f9sw065t9unereh0vm0jjqwq6tulnd42pnxa6yl8e92xpkpgz5tpw0fx7v05lfkl93qumr80dk4xrnakkgh57xxk53e3kccqp5kwles'">
        Enter Manually
      </button>
      <button v-else @click="handleManualNext">Next</button>
    </div>
  </div>
  -->
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
