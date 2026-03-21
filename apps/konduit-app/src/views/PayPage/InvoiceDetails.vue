<script setup lang="ts">
import * as l10n from "../../composables/l10n";
import * as env from "../../env";
import Callout, { type CalloutVariant } from "../../components/Callout.vue";
import ChargingInProgressCallout from "../../components/ChargingInProgressCallout.vue";
import DataListing from "../../components/DataListing.vue";
import FancyAmount from "../../components/FancyAmount.vue";
import BatteryThrobber from "../../components/BatteryThrobber.vue";
import ClockThrobber from "../../components/ClockThrobber.vue";
import CircleAdaSign from "../../components/icons/CircleAdaSign.vue";
import { AlertTriangle, Ban, BatteryLow, Bug, HandCoins, Home, WalletMinimal, Zap } from "lucide-vue-next";
import MainContainer from "../../components/MainContainer.vue";
import MissingDataPlaceholder from "../../components/MissingDataPlaceholder.vue";
import TheHeader from "../../components/TheHeader.vue";
import type { Props as ButtonProps } from "../../components/Button.vue";
import type { RowConfig } from "../../components/DataListing.vue";
import { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { Milliseconds } from "@konduit/konduit-consumer/time/duration";
import { POSIXMilliseconds } from "@konduit/konduit-consumer/time/absolute";
import { FailedPayment } from "@konduit/konduit-consumer/channel";
import { computed, type ComputedRef } from "vue";
import { hex, MISSING_PLACEHOLDER, orPlaceholder } from "../../utils/formatters";
import { type AppKonduitConsumer } from "../../store";
import { useInvoiceProcessor, type BlockedReason, type QuotingFailureReason } from "./invoiceProcessor";
import { useFx } from "../../composables/fx";
import { useFormattedLastSuccessfulSyncInfo } from "../../composables/polling";
import type { RouteLocationRaw } from "vue-router";
import { stringify } from "@konduit/codec/json";

type Props = {
  consumer: AppKonduitConsumer;
  invoice: Invoice;
};

const emit: (
  ((event: "back", value: null) => void) &
  ((event: 'reset-redirect', value: RouteLocationRaw) => void) &
  ((event: 'reset-scan', value: null) => void)
) = defineEmits(["back", "reset-redirect", "reset-scan"]);

const props = defineProps<Props>();

const { expirationInfo, paymentBreakdown, processingProgress, retry } = useInvoiceProcessor(
  props.consumer,
  props.invoice,
);

const formatters = l10n.useDefaultFormatters();

const hasExpired = computed(() => {
  return expirationInfo.value.type === 'expired';
});

const formattedExpiresAt = computed((): string => {
  const info = expirationInfo.value;
  if(info.type === 'invalid') return MISSING_PLACEHOLDER;
  if(info.type === 'expired') return formatters.formatShortDate(info.expiredAt);
  if(info.type === 'valid' && info.expiresAt === null) return 'Never';
  return formatters.formatShortDate(info.expiresAt);
});

const formattedExpiredAgo = computed((): string | null => {
  const info = expirationInfo.value;
  if(info.type !== 'expired') return null;
  const nowTimestamp = POSIXMilliseconds.now();
  const expirationTimestamp = POSIXMilliseconds.fromValidDate(info.expiredAt);
  const expiredMillisecondsAgo = Milliseconds.fromDiffTime(nowTimestamp, expirationTimestamp)
  return formatters.formatDurationLong(expiredMillisecondsAgo);
});

const totalAmount = computed(() => {
  if(paymentBreakdown.value.isErr()) return null;
  return paymentBreakdown.value.value.total;
});

const formattedInvoiceAmount: ComputedRef<string> = computed(() => {
  return paymentBreakdown.value.match(
    (breakdown) => formatters.formatAnyAmount(breakdown.invoice),
    () => MISSING_PLACEHOLDER
  );
});

const formattedRoutingFee: ComputedRef<string> = computed(() => {
  return paymentBreakdown.value.match(
    (breakdown) => formatters.formatAnyAmount(breakdown.fee),
    () => MISSING_PLACEHOLDER
  );
});

const routingFeeEstimated = computed(() => {
  return paymentBreakdown.value.match(
    (breakdown) => breakdown.estimate,
    () => null
  );
});

const fx = useFx();

const fxPollingInfo = useFormattedLastSuccessfulSyncInfo(fx.fxPollingInfo, "short");
const invoiceRows = computed((): RowConfig[] => {
  const rows: (RowConfig | null)[] = [
    {
      label: 'Invoice amount',
      formattedValue: {
        string: formattedInvoiceAmount.value,
        importance: 'very-important'
      },
      actions: [[() => console.log('INFO'), 'info']]
    },
    routingFeeEstimated.value === null?
     null
     :
    {
      label:  routingFeeEstimated.value ? 'Estimated routing fee' : 'Routing fee',
      formattedValue: formattedRoutingFee.value,
      actions: [
        [() => console.log('INFO'), 'info'],
      ]
    },
    'separator',
    { label: hasExpired.value?'Expired':'Expires',
      formattedValue: formattedExpiresAt.value, actions: []
    },
    { label: 'Destination',
      formattedValue: orPlaceholder(hex(props.invoice.payee)),
      actions: [
        { action: 'copy' as const,
          message: 'Destination copied to clipboard.',
          value: hex(props.invoice.payee)
        }
      ]
    },
    "separator" as const,
    {
      label: 'Currency exchange',
      formattedValue: `kraken.com (${fxPollingInfo.value})`,
      actions: { rowAction: ["https://www.kraken.com/", "external-link"] }
    },

  ];
  return rows.filter((row) => row !== null);
});

type PageSetup = {
  callout: {
    debug?: string | null;
    icon: 'alert-triangle' | 'ada' | 'ban' | 'battery-low' | 'battery-throbber' | 'blocked'
      | 'bug' | 'clock-throbber' | 'hand-coins' | 'hand-raised' | 'home' | 'wallet' | 'zap' ;
    message: string | string[];
    title: string;
    // export type CalloutVariant = "info" | "warning" | "error" | "success" | "hint" | "critical" | "neutral" | "bug";
    variant: CalloutVariant;
  } | 'charging-callout';
  buttons: ButtonProps[];
}

const pageSetup = computed((): PageSetup => {
  const mkButtons = (mainButton: ButtonProps | null) => {
    const backButton: ButtonProps = {
      label: 'Scan another invoice',
      action: () => emit('back', null),
      primary: false,
    };
    return mainButton ? [backButton, mainButton] : [backButton];
  };

  const mkPayButtons = (pay: (() => void | null)) => mkButtons({
    label: 'Pay',
    action: pay || (() => null),
    primary: true,
    disabled: pay === null,
  } as ButtonProps);

  const resetButtons = [
    {
      label: 'Cancel',
      action: () => emit('reset-redirect', { name: 'home' }),
      primary: false,
    },
    {
      label: 'Scan a new invoice',
      action: () => emit('reset-scan', null),
      primary: true,
    }
  ];

  const mkBlockedCallouts = (reason: BlockedReason): PageSetup => {
    switch(reason.type) {
      case 'no-channels-at-all':
        return {
          buttons: mkButtons({
            label: 'Open first channel',
            action: { name: 'channel-open' },
            primary: true,
          }),
          callout: {
            icon: 'hand-raised',
            title: 'First payment – almost there!',
            variant: 'info',
            message: [
              'Open a channel to make it possible.',
              'Setup should be super quick and in a few minutes you will be ready to pay.',
            ]
          }
        };
      case 'all-channels-closed':
        return {
          buttons: mkButtons({
            label: 'Open a channel',
            action: { name: 'channel-open' },
            primary: true,
          }),
          callout: {
            icon: 'blocked',
            title: 'All channels are closed',
            variant: 'warning',
            message: [
              'All your channels are closed, so you cannot pay this invoice.',
              'Please open a channel to proceed.',
            ]
          }
        };
      case 'fx-not-ready':
        return {
          buttons: mkButtons(null),
          callout: {
            icon: 'wallet',
            title: 'Currency exchange is not ready',
            variant: 'info',
            message: [
              'We have some problems communicating with the currency exchange service.',
              'It is better to wait until the problem is resolved before trying to pay the invoice.',
            ]
          }
        };
      case 'not-enough-capacity':
        return {
          buttons: mkButtons({
            action: '#',
            disabled: true,
            label: 'Coming soon: Top up channel',
            primary: true,
          }),
          callout: {
            icon: 'battery-low',
            title: 'Low on capacity!',
            variant: 'warning',
            message: [
              "Oops, your lighting channel can't cover this invoice amount.",
              'Please top up your channel to proceed.',
            ]
          }
        };
      case 'channels-not-ready':
        return {
          buttons: mkPayButtons(null!),
          callout: 'charging-callout',
        };
      case 'invoice-amount-conversion-failed':
        return {
          buttons: mkButtons(null),
          callout: {
            icon: 'alert-triangle',
            title: 'Invoice amount',
            variant: 'error',
            message:
              'Seems like the invoice amount is somewhat invalid or too large to handle.'
          }
        };
      case 'invoice-expired':
        return {
          buttons: resetButtons,
          callout: {
            icon: 'blocked',
            title: 'Invoice expired',
            variant: 'error',
            message: [
              `It has expired ${formattedExpiredAgo.value ? `${formattedExpiredAgo.value} ago` : ''}.`,
              'Please scan a new invoice to proceed.',
            ]
          }
        };
      case 'invoice-invalid':
        return {
          buttons: resetButtons,
          callout: {
            icon: 'ban',
            title: 'Invalid invoice',
            variant: 'error',
            message: [
              'The app had problems parsing the invoice, so it cannot be paid.',
              'This can be caused by an invalid invoice format or by unsupported features in the invoice.',
            ]
          }
        };
    }
  };
  switch(processingProgress.value.type) {
    case 'quoting-blocked':
      return mkBlockedCallouts(processingProgress.value.reason);
    case 'quoting-failed':
      switch(processingProgress.value.reason.type as QuotingFailureReason['type']) {
        case 'quoting-networking-failed':
          return {
            buttons: mkButtons({
              label: 'Retry',
              action: retry,
              primary: true,
            }),
            callout: {
              icon: 'clock-throbber',
              title: 'Network hiccup',
              variant: 'info',
              message: [
                'Trying again soon.',
                'Tap "Retry" if you\'re in a rush.'
              ]
            }
          } as PageSetup;
        case 'quotes-failed':
          return {
            buttons: resetButtons,
            callout: {
              icon: 'ban',
              title: 'Prelimnary routing failed',
              variant: 'warning',
              message: [
                // TODO:
                'We had some unexpected issues getting quotes for this invoice.',
                'Seems like we are not able to process it at the moment.'
              ]
            }
          } as PageSetup;
      }
    case 'quotes-loading':
      return {
        buttons: mkPayButtons(null!),
        callout: {
          icon: 'clock-throbber',
          title: 'Getting quotes',
          variant: 'info',
          message: [
            'Getting the best route for your payment.',
            'This usually takes just a few seconds.'
          ]
        }
      } as PageSetup;
    case 'quotes-loaded':
      return {
        buttons: mkPayButtons(processingProgress.value.pay),
        callout: {
          icon: 'zap',
          title: 'Route is ready!',
          variant: 'success',
          message: [
            'We found a good route for your payment.',
            'You can proceed to pay the invoice.'
          ]
        }
      } as PageSetup;
    case 'paying':
      return {
        buttons: mkPayButtons(null!),
        callout: {
          icon: 'clock-throbber',
          title: 'Paying the invoice',
          variant: 'info',
          message: [
            'Your payment is on its way.',
            'This usually takes just a few seconds, but can sometimes take longer.'
          ]
        }
      } as PageSetup;
    case 'payment-successful':
      return {
        buttons: [{
          label: 'Great, take me home',
          action: { name: 'home' },
          primary: true,
        }],
        callout: {
          icon: 'home',
          title: 'Payment successful!',
          variant: 'success',
          message: [
            'Your payment went through successfully.',
            'Thank you for using our app!'
          ]
        }
      } as PageSetup;
    case 'cheque-issuing-failed':
      return {
        buttons: resetButtons,
        callout: {
          icon: 'alert-triangle',
          title: 'Payment failed at the last step',
          variant: 'error',
          message: [
            // TODO: provide more details here
            'We were unable to create a payment request.',
            'Please retry scanning a new invoice'
          ]
        }
      } as PageSetup;
    case 'payment-failed':
      return {
        buttons: resetButtons,
        callout: {
          icon: 'alert-triangle',
          title: 'Payment failed',
          variant: 'error',
          debug: !env.debugMode? null : (() => {
              const json = FailedPayment.jsonCodec.serialise(processingProgress.value.payment);
              return stringify(json, undefined, 2);
          })(),
          message: [
              'Your payment failed to go through.',
              '',
              'Unfortunatelly this payment funds are locked till the invoice will timeout.',
          ]
        }
      } as PageSetup;
  }
});
</script>

<template>
  <MainContainer :buttons="pageSetup.buttons">
    <TheHeader
      :back="() => emit('back', null)"
      :title="'Payment'"
      id="header"
      :show-fx-currency-switcher="true"
    />
    <div id="invoice-amount">
      <span class="amount">
        <FancyAmount
          v-if="totalAmount"
          :amount="totalAmount"
        />
      </span>
      <div class="description">
        <MissingDataPlaceholder v-if="invoice.description">
          No description provided.
        </MissingDataPlaceholder>
        <span v-else>{{ invoice.description }}</span>
      </div>
    </div>
    <Callout
      v-if="pageSetup.callout !== 'charging-callout'"
      :title="pageSetup.callout.title"
      :variant="pageSetup.callout.variant"
    >
      <template #icon>
        <component :is="{
          'alert-triangle': AlertTriangle,
          'ada': CircleAdaSign,
          'ban': Ban,
          'battery-low': BatteryLow,
          'battery-throbber': BatteryThrobber,
          'blocked': HandCoins,
          'bug': Bug,
          'clock-throbber': ClockThrobber,
          'hand-coins': HandCoins,
          'hand-raised': HandCoins,
          'home': Home,
          'wallet': WalletMinimal,
          'zap': Zap,
        }[pageSetup.callout.icon]" />
      </template>
      <template v-if="typeof pageSetup.callout.message === 'string'">
        {{ pageSetup.callout.message }}
      </template>
      <!-- br in between -->
      <template v-else>
        <template v-for="(message, index) in pageSetup.callout.message" :key="index">
          {{ message }}<br v-if="index < pageSetup.callout.message.length - 1" />
        </template>
      </template>
      <template v-if="pageSetup.callout.debug">
        <hr />
        <pre class="debug-info">{{ pageSetup.callout.debug }}</pre>
      </template>
    </Callout>
    <ChargingInProgressCallout v-else :progress="{ type: 'submitted' }" />
    <DataListing :rows="invoiceRows" />
  </MainContainer>
</template>

<style scoped>
header :deep(.header-right) svg {
  height: 1.4rem !important;
  stroke: var(--primary-color);
  width: auto !important;
}

.buttons {
  margin-top: calc(var(--data-listing-gap) * 2);
}

.callout {
  margin-bottom: calc(var(--data-listing-gap));
}

#opening-steps {
  display: flex;
  flex-direction: column;
  gap: calc(var(--data-listing-gap) * 0.5);
  list-style: none;
  margin: 0;
  margin-bottom: 0;
  margin-left: var(--data-listing-gap);
  padding: 0;
  text-align: left;
}
  #opening-steps li {
    margin: 0;
    padding: 0;
  }
    #opening-steps li svg {
      height: 1em;
      width: auto;
      vertical-align: middle;
    }

#invoice-amount {
  margin-bottom: calc(var(--data-listing-gap) * 2);
  text-align: center;
}
  #invoice-amount .amount {
    font-size: 1.5rem;
  }
  #invoice-amount .description {
    font-size: 0.9rem;
    margin-top: 1rem;
    text-align: center;
  }
  #invoice-amount .description .missing {
    font-style: italic;
  }
.debug-info {
  background: var(--background-color);
  font-family: monospace;
  font-size: 0.8em;
  margin-top: calc(var(--data-listing-gap) * 0.5);
  max-height: 20em;
  overflow: auto;
  padding: calc(var(--data-listing-gap) * 0.5);
  text-align: left;
/* wrap long lines and break the words if needed */
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

