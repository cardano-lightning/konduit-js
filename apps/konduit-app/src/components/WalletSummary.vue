<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import qr from "qrcode";
import DataListing from "../components/DataListing.vue";
import type { Action } from "../components/DataListing/DataRow.vue";
// import QrCode from "../components/icons/QrCode.vue";
// import Share2 from "../components/icons/Share2.vue";
import { wallet } from "../store";
import { NetworkMagicNumber } from "@konduit/konduit-consumer/cardano";
import { MISSING_PLACEHOLDER } from "../utils/formatters";
import { useEmbeddedWalletDetails } from "../composables/walletDetails";
import { abbreviated } from "../composables/formatters";

const { cardanoScanLink } = useEmbeddedWalletDetails(wallet);

// Address section:
// * Address display
const formattedAddress = abbreviated(() => wallet.value?.addressBech32, 10, 10);

const addressBech32 = computed(() => wallet.value?.addressBech32 || null);

// Ref to hold the generated SVG string
const qrSvg = ref("");

// This ref is used to apply styles to the generated SVG
// which is hard to do without manipulating the DOM directly.
const qrContainer = ref<HTMLDivElement | null>(null);
const generateQR = async () => {
  if (!addressBech32.value) {
    qrSvg.value = "";
    return;
  }
  const svgString = await qr.toString(addressBech32.value, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    scale: 4,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
  qrSvg.value = svgString;
  await nextTick(); // Wait for DOM to render the new SVG
  const svgElement = qrContainer.value?.querySelector("svg");
  if (svgElement) {
    svgElement.style.border = "1px solid";
    svgElement.style.borderColor = "inherit";
    svgElement.style.width = "80%";
  }
};

const network = computed(() => {
  if (!wallet.value) return MISSING_PLACEHOLDER;
  const networkMagicNumber = wallet.value.networkMagicNumber;
  if (networkMagicNumber === NetworkMagicNumber.MAINNET) {
    return "Mainnet";
  } else if (networkMagicNumber === NetworkMagicNumber.PREPROD) {
    return "Preprod Testnet";
  } else if (networkMagicNumber === NetworkMagicNumber.PREVIEW) {
    return "Preview Testnet";
  } else {
    return `Cardano (Network Magic: ${networkMagicNumber})`;
  }
});

const addressActions = computed((): Action[] => {
  let actions: Action[] = [];
  actions.push({
    action: "copy" as const,
    message: "Address copied to clipboard.",
    value: addressBech32.value
  });
  if (cardanoScanLink.value) {
    actions.push([cardanoScanLink.value, "external-link"]);
  }
  return actions;
});

// This is side-effectful as it directly maniputes the DOM
// that is why we watch instead of compute.
watch(addressBech32, generateQR, {
  immediate: true,
});
</script>


<template>
  <DataListing :rows="[
    { label: 'Cardano Network', formattedValue: network },
    { label: 'Address', formattedValue: formattedAddress, actions: addressActions },
  ]" />
</template>

<style scoped>
#address-row {
  display: flex;
  font-size: 0.9rem;
  line-height: 1.2rem;
  margin-top: 3rem;
}
#address-row .address {
  flex-grow: 1;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#address-row .buttons {
  display: flex;
  align-items: center;
}

#address-row a.button {
  color: inherit;
  cursor: pointer;
  text-decoration: none;
}

#address-row .buttons svg {
  height: 1.2rem;
  margin-left: 0.2rem;
  vertical-align: middle;
}

#qr-container {
  /* This is inherited to the svg element */
  border-color: var(--primary-color);
  margin-top: 2rem;
  text-align: center;
}
</style>
