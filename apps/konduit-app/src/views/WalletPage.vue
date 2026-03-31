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
  <TheHeader :back="'home'" :show-fx-currency-switcher="true" />
    <div id="body">
      <WalletBalance />
      <Hr />
      <WalletSummary />
    </div>
  </MainContainer>
  <NavBar />
</template>

<style scoped>
#body {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}
</style>
