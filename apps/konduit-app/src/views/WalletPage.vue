<script setup lang="ts">
import WalletBalance from "../components/WalletBalance.vue";
import WalletSummary from "../components/WalletSummary.vue";
import { computed, nextTick, ref, watch } from "vue";
import qr from "qrcode";
import Hr from "../components/Hr.vue";
import NavBar from "../components/NavBar.vue";
import MainContainer from "../components/MainContainer.vue";
// import QrCode from "../components/icons/QrCode.vue";
// import Share2 from "../components/icons/Share2.vue";
import TheHeader from "../components/TheHeader.vue";
import { wallet } from "../store";


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

// This is side-effectful as it directly maniputes the DOM
// that is why we watch instead of compute.
watch(addressBech32, generateQR, {
  immediate: true,
});
</script>


<template>
  <MainContainer>
    <TheHeader :back-page-name="'home'" />
    <WalletBalance />
    <Hr />
    <WalletSummary />
    <!-- TODO: Bring back this functionality
      <QrCode
        class="button"
        title="Show QR code"
      />
      <Share2
        v-if="shareSupported"
        class="button"
        title="Share address"
      />
    -->
    <!--
    <div id="qr-container" v-html="qrSvg" ref="qrContainer"></div>
    -->
  </MainContainer>
  <NavBar />
</template>

<style scoped>
h2 {
  font-size: 1.2rem;
  font-weight: normal;
  margin-top: 1rem;
}
#total {
  text-align: center;
}
#total .amount {
  font-size: 1.5rem;
}
#total .synced-at {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 1rem;
  text-align: center;
}

hr {
  margin: 2.5rem 0;
}

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
