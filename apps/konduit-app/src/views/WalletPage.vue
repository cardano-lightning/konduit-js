<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import qr from "qrcode";
import Hr from "../components/Hr.vue";
import DataListing from "../components/DataListing.vue";
import type { Action } from "../components/DataListing/DataRow.vue";
import NavBar from "../components/NavBar.vue";
import MainContainer from "../components/MainContainer.vue";
// import QrCode from "../components/icons/QrCode.vue";
// import Share2 from "../components/icons/Share2.vue";
import TheHeader from "../components/TheHeader.vue";
import { wallet, walletBalance, walletBalanceInfo } from "../store";
import { mkLovelaceAmount } from "../components/FancyAmount.vue";
import FancyAmount from "../components/FancyAmount.vue";
import { useDefaultFormatters } from "../composables/l10n";
import { POSIXSeconds } from "@konduit/konduit-consumer/time/absolute";
import { AnyPreciseDuration, NormalisedDuration, Seconds } from "@konduit/konduit-consumer/time/duration";
import { NetworkMagicNumber } from "@konduit/konduit-consumer/cardano";
import { MISSING_PLACEHOLDER, orPlaceholder } from "../utils/formatters";

// Amount section:
// * Total balance section
const amount = computed(() => {
  if (walletBalance.value != null) {
    return mkLovelaceAmount(walletBalance.value);
  }
  return null;
});

// * Sync info section
const TIMER_REFRESH_INTERVAL_MS = 20_000;
const { formatDurationShort } = useDefaultFormatters();
const now = ref(POSIXSeconds.now());
// Let's refresh the sync info every 10 sec
onMounted(() => {
  const interval = setInterval(() => {
    now.value = POSIXSeconds.now();
  }, TIMER_REFRESH_INTERVAL_MS);
  onUnmounted(() => {
    clearInterval(interval);
  });
});
const formattedSyncInfo = computed(() => {
  if(walletBalanceInfo?.value?.lastSuccessfulFetch != null) {
    const secondsSinceLastSync = Seconds.fromDiffTime(
      now.value,
      POSIXSeconds.fromValidDate(walletBalanceInfo.value.lastSuccessfulFetch.fetchedAt)
    );
    if(secondsSinceLastSync == 0) return "Synced just now";

    let normalized = (() => {
      let normalized = NormalisedDuration.fromAnyPreciseDuration(AnyPreciseDuration.fromSeconds(secondsSinceLastSync));
      if(secondsSinceLastSync < 60) {
        return normalized;
      }
      return { ...normalized, seconds: Seconds.fromDigits(0) };
    })();
    return `Synced ${formatDurationShort(normalized)} ago`;
  }
  return "Not synced";
});


// Address section:
// * Address display
const formattedAddress = computed(() => orPlaceholder(wallet.value?.addressBech32))

//* Cardano scan link
const cardanoScanLink = computed(() => {
  if (!wallet.value) return null;
  let baseURL = (() => {
    switch (wallet.value.networkMagicNumber) {
      case NetworkMagicNumber.MAINNET:
        return "https://cardanoscan.io/address/";
      case NetworkMagicNumber.PREPROD:
        return "https://preprod.cardanoscan.io/address/";
      case NetworkMagicNumber.PREVIEW:
        return "https://preview.cardanoscan.io/address/";
      default:
        return null;
    }
  })();
  if (baseURL === null) return null;
  const addressBech32 = wallet.value.addressBech32;
  const url = baseURL + addressBech32;
  return url;
});

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
  <TheHeader :back-page-name="'home'" />
  <MainContainer>
    <div id="total">
      <span class="amount"><FancyAmount :amount="amount" /></span>
      <div class="synced-at">{{ formattedSyncInfo }}</div>
    </div>
    <Hr />
    <DataListing :rows="[
      { label: 'Cardano Network', formattedValue: network },
      { label: 'Address', formattedValue: formattedAddress, actions: addressActions },
    ]" />
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
