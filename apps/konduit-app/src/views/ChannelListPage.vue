<script setup lang="ts">
import type { RowConfig } from "../components/DataListing.vue";
import DataListing from "../components/DataListing.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import { channels } from "../store";
import { useDefaultFormatters } from "../composables/l10n";
import { computed } from "vue";
import { abbreviateHex, hex } from "../utils/formatters";
import type { OnClick } from "../components/Link.vue";
import type { ActionIcon } from "src/components/DataListing/DataRow.vue";
import type { Channel } from "@konduit/konduit-consumer/channel";

const formatters = useDefaultFormatters();

const rows = computed((): RowConfig[] => {
  const channelRows: RowConfig[] = ((): RowConfig[] => {
    if(channels.value === null) return [] as RowConfig[];
    return channels.value.map((channel: Channel) => {
      return {
        label: `Channel: ${abbreviateHex(channel.channelTag, 10, 0)}`,
        formattedValue: `initial: ${formatters.formatAda(channel.totalEffectiveSubmittedCapacity)}, available: ${formatters.formatAda(channel.availableApprovedCapacity)}`,
        actions: {
          rowAction: [{ name: 'channel-details', params: { tag: hex(channel.channelTag, '') }}, 'chevron-right'] as [OnClick, ActionIcon]
        }
      } as RowConfig;
    });
  })();
  const addAnotherChannelRow: RowConfig = {
    label: 'Add another channel',
    formattedValue: '',
    actions: [
      [{ name: 'open-channel' }, 'square-plus']
    ],
  };
  return [...channelRows, "separator", addAnotherChannelRow] as RowConfig[];
});
</script>

<template>
  <MainContainer>
  <TheHeader />
  <DataListing :rows="rows" />

  </MainContainer>
</template>
