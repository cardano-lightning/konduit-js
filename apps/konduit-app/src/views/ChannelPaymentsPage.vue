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
    { label: 'Adaptor', formattedValue: channel.adaptorUrl, actions: [] },
    { label: 'Channel tag', formattedValue: hex(channel.channelTag), actions: [] },
    "separator",
    // { label: 'Created at', formattedValue: formatters.formatShortDate(channel.createdAt) },
    // { label: 'Total', formattedValue: formatAdaInCurrent(channel.totalSubmittedCapacity).value },
    // { label: 'Available', formattedValue: formatAdaInCurrent(channel.availableApprovedCapacity).value },
  ];
});

// export type ExpiredPayment = {
//   cheque: LockedCheque;
//   expiredAt: ValidDate;
//   info: ({
//     error: ImmediatePaymentError;
//     invoice: Invoice;
//   });
// }
// export type ConfirmedPayment = {
//   cheque: UnlockedCheque;
//   // If we recover payments from the adaptor
//   // we won't get the full invoice back.
//   // We don't not yet implement that flow.
//   invoice: Invoice | null;
// };
// export type FailedPayment = {
//   cheque: LockedCheque;
//   info: {
//     error: ImmediatePaymentError | null;
//     invoice: Invoice;
//   } | null;
// };
// export type AnyPayment = FailedPayment | ConfirmedPayment | ExpiredPayment;
// export type PaymentBreakdown<T> = {
//   total: T;
//   invoice: T;
//   fee: T;
// };

const payments = computed(() => {
  const payments = props.channel.allPayments;
  if(!payments) return [];
  return payments.map(payment => {
    return {
      label: payment.paymentId,
      formattedValue: `${formatters.formatShortDate(payment.createdAt)} • ${formatAdaInCurrent(payment.amount).value}`,
      actions: {
        rowAction: [{ name: 'payment-details', params: { id: hex(payment.paymentId, '') }}, 'chevron-right'] as [OnClick, ActionIcon]
      }
    } as RowConfig;
  });
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
