<script setup lang="ts">
import DataListing, { type RowConfig } from "../components/DataListing.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import type { Channel } from "@konduit/konduit-consumer/channel";
import { AdaAmount } from "@konduit/konduit-consumer/amounts";
import { computed } from "vue";
import { Lovelace } from "@konduit/konduit-consumer/cardano";
import { useFx } from "../composables/fx";
import { hex } from "../utils/formatters";
import { useDefaultFormatters } from "../composables/l10n";
import type { OnClick } from "../components/Link.vue";
import type { ActionIcon } from "../components/DataListing/DataRow.vue";

// You now get a fully validated & loaded channel object — guaranteed!
const props = defineProps<{
  channel: Channel
}>()

const { formatAdaInCurrent, toCurrentCurrency } = useFx();

const amount = computed(() => {
  const adaAmount = AdaAmount.fromLovelace(props.channel?.availableApprovedCapacity || Lovelace.zero);
  return toCurrentCurrency(adaAmount)
    .match(
      amount => amount,
      () => adaAmount
    );
});

const formatters = useDefaultFormatters();

const rows = computed((): RowConfig[] => {
  const channel = props.channel;
  return [
    "separator",
    { label: 'Adaptor', formattedValue: channel.adaptorUrl, actions: [] },
    { label: 'Tag', formattedValue: hex(channel.channelTag), actions: [] },
    "separator",
    { label: 'Created at', formattedValue: formatters.formatShortDate(channel.createdAt) },
    { label: 'Total', formattedValue: formatAdaInCurrent(channel.totalSubmittedCapacity).value },
    { label: 'Available', formattedValue: formatAdaInCurrent(channel.availableApprovedCapacity).value },
    "separator",
    { label: 'History',
      formattedValue: '10 payments',
      actions: {
        rowAction: [{ name: 'channel-payments', params: { tag: hex(channel.channelTag, '') }}, 'chevron-right'] as [OnClick, ActionIcon]
      }
    },
    { label: 'On-chain',
      formattedValue: '1 transaction',
      actions: {
        rowAction: [{ name: 'channel-payments', params: { tag: hex(channel.channelTag, '') }}, 'chevron-right'] as [OnClick, ActionIcon]
      }
    },
    "separator",
    { label: 'Top up channel',
      formattedValue: '',
      actions: {
        rowAction: [{ name: 'channel-details', params: { tag: hex(channel.channelTag, '') }}, 'circle-plus'] as [OnClick, ActionIcon]
      }
    },
    { label: 'Close channel',
      formattedValue: ' ',
      actions: {
        rowAction: [{ name: 'channel-details', params: { tag: hex(channel.channelTag, '') }}, 'circle-x'] as [OnClick, ActionIcon]
      }
    },
  ];
});

</script>

<template>
  <MainContainer>
    <TheHeader
      :show-fx-currency-switcher="true"
    />
    <div id="body">
      <div class="available">
        <FancyAmount :amount="amount">
          <template #subscript>Available capacity</template>
        </FancyAmount>
      </div>
      <DataListing :rows="rows" />
    </div>
  </MainContainer>
</template>


<style scoped>
#body {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}
.available {
  font-size: 1.5em;
}
</style>
