<script setup lang="ts">
import DataListing, { type RowConfig } from "../components/DataListing.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import type { Channel } from "@konduit/konduit-consumer/channel";
import { computed } from "vue";
import { useFx } from "../composables/fx";
import { abbreviateHex, hex } from "../utils/formatters";
import { useDefaultFormatters } from "../composables/l10n";
import type { OnClick } from "../components/Link.vue";
import type { ActionIcon } from "../components/DataListing/DataRow.vue";
import {
  AnyPayment,
} from "@konduit/konduit-consumer/channel";

// You now get a fully validated & loaded channel object — guaranteed!
const props = defineProps<{
  channel: Channel
}>()

const { formatAdaInCurrent } = useFx();

const formatters = useDefaultFormatters();

const iconForPayment = (payment: AnyPayment): ActionIcon => {
  if (AnyPayment.isFailed(payment)) {
    return "alert-triangle";
  }
  if (AnyPayment.isExpired(payment)) {
    return "clock";
  }
  return "square-check";
};

const labelPrefixForPayment = (payment: AnyPayment): string => {
  if (AnyPayment.isFailed(payment)) {
    return "Failed";
  }
  if (AnyPayment.isExpired(payment)) {
    return "Expired";
  }
  return "Confirmed";
};

const payments = computed((): RowConfig[] => {
  const channelPayments: AnyPayment[] = props.channel.allPayments;
  if (!channelPayments || channelPayments.length === 0) return [];

  return channelPayments.map((payment) => {
    const amount = payment.cheque.body.amount;
    const value = `${formatters.formatShortDate(payment.createdAt)} • ${formatAdaInCurrent(amount).value}`;
    const icon = iconForPayment(payment as AnyPayment);
    const paymentIndex = payment.cheque.body.index;
    const paymentId: string = (() => {
      if( payment?.invoice && payment.invoice.description ) {
        return payment.invoice.description;
      }
      const lockHex = abbreviateHex(AnyPayment.getLock(payment), 20, 0);
      return `#${lockHex}`;
    })();
    const label = `${labelPrefixForPayment(payment)} ${paymentId}`;

    // const paymentIdHex = hex(paymentId, "");
    const channelTagHex = hex(props.channel.channelTag, "");

    return {
      label,
      formattedValue: value,
      actions: {
        rowAction: [
          { name: "payment-details", params: { channelTag: channelTagHex, id: paymentIndex.toString() } },
          icon,
        ] as [OnClick, ActionIcon],
      },
    } as RowConfig;
  });
});


const rows = computed((): RowConfig[] => {
  const channel = props.channel;
  return [
    { label: 'Adaptor', formattedValue: channel.adaptorUrl, actions: [] },
    { label: 'Channel tag', formattedValue: hex(channel.channelTag), actions: [] },
    "separator",
    ...payments.value,
  ];
});

</script>

<template>
  <MainContainer>
    <TheHeader
      :show-fx-currency-switcher="true"
    />
    <div id="body">
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
</style>
