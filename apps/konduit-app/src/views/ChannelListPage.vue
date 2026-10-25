<script setup lang="ts">
import type { RowConfig } from "../components/DataListing.vue";
import DataListing from "../components/DataListing.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import { channels } from "../store";
import { useDefaultFormatters } from "../composables/l10n";
import { computed } from "vue";
import { hex } from "../utils/formatters";
import type { OnClick } from "../components/Link.vue";
import type { ActionIcon } from "src/components/DataListing/DataRow.vue";
import type { Channel } from "@konduit/konduit-consumer/channel";
import { useFx } from "../composables/fx";

const formatters = useDefaultFormatters();
const fx = useFx();

const rows = computed((): RowConfig[] => {
  const channelRows: RowConfig[] = ((): RowConfig[] => {
    if(channels.value === null) return [] as RowConfig[];

    return channels.value.map((channel: Channel) => {
      return {
        label: channel.adaptorUrl,
        formattedValue: `${formatters.formatShortDate(channel.createdAt)} • ${fx.formatAdaInCurrent(channel.availableApprovedCapacity).value}`,
        actions: {
          rowAction: [{ name: 'channel-details', params: { tag: hex(channel.channelTag, '') }}, 'chevron-right'] as [OnClick, ActionIcon]
        }
      } as RowConfig;
    });
  })();
  const addAnotherChannelRow: RowConfig = {
    label: 'Open new channel',
    formattedValue: '',
    actions: [
      [{ name: 'channel-open-wallet-select' }, 'circle-plus']
    ],
  };
  return [...channelRows, "separator", addAnotherChannelRow] as RowConfig[];
});
</script>

<template>
  <MainContainer>
  <TheHeader :show-fx-currency-switcher="true" />
  <DataListing :rows="rows" />
  </MainContainer>
</template>
