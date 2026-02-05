<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import qr from "qrcode";
import Hr from "../components/Hr.vue";
import SettingRow from "./SettingsPage/SettingRow.vue";
import type { Action } from "./SettingsPage/SettingRow.vue";
import NavBar from "../components/NavBar.vue";
// import QrCode from "../components/icons/QrCode.vue";
// import Share2 from "../components/icons/Share2.vue";
import TheHeader from "../components/TheHeader.vue";
import { wallet, walletBalance, walletBalanceInfo } from "../store";
import FancyAmount from "../components/FancyAmount.vue";
import { useDefaultFormatters } from "../composables/l10n";
import { POSIXSeconds } from "@konduit/konduit-consumer/time/absolute";
import { AnyPreciseDuration, NormalisedDuration, Seconds } from "@konduit/konduit-consumer/time/duration";
import { abbreviated } from "../composables/formatters";
import { useClipboard } from "@vueuse/core";
import { useNotifications } from "../composables/notifications";
import { NetworkMagicNumber } from "@konduit/konduit-consumer/cardano";
import { MISSING_PLACEHOLDER } from "../utils/formatters";

const notifications = useNotifications();

// Amount section:
// * Total balance section
const amount = computed(() => {
  if (walletBalance.value != null) {
    return { value: walletBalance.value, currency: "Lovelace" as const };
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
  if(walletBalanceInfo?.value?.successfulFetch != null) {
    const secondsSinceLastSync = Seconds.fromDiffTime(
      now.value,
      POSIXSeconds.fromValidDate(walletBalanceInfo.value.successfulFetch.fetchedAt)
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
const formattedAddress = abbreviated((() => wallet.value?.addressBech32), 20, 0);

//* Copy button
const clipboard = useClipboard();

function copyAddress() {
  if (!wallet.value?.addressBech32) return;
  notifications.success("Address copied to clipboard.");
  return clipboard.copy(wallet.value.addressBech32);
}

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
  actions.push([copyAddress, "copy"]);
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
  <div id="container">
    <div id="total">
      <span class="amount"><FancyAmount :amount="amount" /></span>
      <div class="synced-at">{{ formattedSyncInfo }}</div>
    </div>
    <Hr />
    <SettingRow :label="'Cardano Network'" :formatted-value="network" />
    <SettingRow :label="'Address'" :formatted-value="formattedAddress" :actions="addressActions" />
    <!--
      <span class="address">{{ formattedAddress }}</span>
      <div class="buttons">
        <Copy
          class="button"
          @click="copyAddress()"
          data-label="key"
          title="Copy address"
        />
        <a v-if="cardanoScanLink" :href="cardanoScanLink" target="_blank" rel="noopener" class="button" title="View on CardanoScan" ><ExternalLink :size="16" /></a>
      </div>
    </div>
    -->
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
  </div>
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
