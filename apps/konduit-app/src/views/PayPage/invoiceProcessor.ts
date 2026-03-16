import type { AppKonduitConsumer } from "../../store";
import { AnyPayment, type Channel } from "@konduit/konduit-consumer/channel";
import type { ChannelQuoteInfo, ChannelQuoteResult } from "@konduit/konduit-consumer";
import type { JsonError } from "@konduit/codec/json/codecs";
import type { Tagged } from "type-fest";
import { Fx } from "@konduit/konduit-consumer/fx";
import { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { Lovelace } from "@konduit/konduit-consumer/cardano";
import { ValidDate } from "@konduit/konduit-consumer/time/absolute";
import { err, ok, Result } from "neverthrow";
import { useFx } from "../../composables/fx";
import { computed, ref, type ComputedRef, type Ref } from "@vue/reactivity";
import type { AnyAmount, AnyAmountSymbol } from "@konduit/konduit-consumer/amounts";
import type { PollingInfo } from "@konduit/konduit-consumer/polling";

export type BlockedReason =
  | { type: 'invoice-expired' } // TODO: 1. Retest
  | { type: 'invoice-invalid' } // TODO: 2. Retest
  | { type: 'no-channels-at-all' } // TODO: 3. Retest
  | { type: 'not-enough-capacity' } // TODO: 4 ~ (Message is displayed. Flow not implemented)
  | { type: 'all-channels-closed' } // TODO: 5. Not tested yet.
  | { type: 'fx-not-ready' } // TODO: 6. Not tested yet.
  | { type: 'channels-not-ready', channel: Channel } // TODO: 7. Not tested yet.
  | { type: 'invoice-amount-conversion-failed', message: string }; // TODO: 8. Not tested yet.

export type InvoiceExpirationInfo =
  | { type: 'invalid' }
  | { type: 'expired', expiredAt: ValidDate }
  | { type: 'valid', expiresAt: ValidDate | null } // null means no expiration

export type ValidatedInvoice = Tagged<{ invoice: Invoice, expirationInfo: InvoiceExpirationInfo }, "ValidedInvoice">;

export type QuotingFailureReason =
  | { type: 'quoting-networking-failed' }
  // FIXME: We should be more insightful here
  // * For example we can detect a case where all the quotes failed due to insufficient capacity.
  | { type: 'quotes-failed' };

export type ProcessingProgress =
  | {
    reason: BlockedReason;
    type: 'quoting-blocked';
  }
  | {
    abortController: AbortController;
    allQuoteResults: ChannelQuoteResult[];
    bestSoFar: ChannelQuoteInfo | null;
    type: 'quotes-loading';
  }
  | {
    allQuoteResults: ChannelQuoteResult[];
    reason: QuotingFailureReason;
    type: 'quoting-failed';
  }
  | {
    allQuoteResults: ChannelQuoteResult[];
    // Not sure if aborting should be possible in this case.
    pay: (() => void);
    theBest: ChannelQuoteInfo;
    type: 'quotes-loaded';
  }
  | {
      allQuoteResults: ChannelQuoteResult[];
      // Aborting will be allowed only mid-payment.
      // abortController?: AbortController;
      lastRetryTime?: Date;
      // FIXME: We should switch to a more
      // robust error handling here.
      lastRetryError?: string;
      retryCount: number;  // Starts at 0, increments on auto-retries
      theBest: ChannelQuoteInfo;
      type: 'paying';
  }
  | {
    allQuoteResults: ChannelQuoteResult[];
    usedQuote: ChannelQuoteInfo;
    type: 'payment-successful';
  }
  | {
    allQuoteResults: ChannelQuoteResult[];
    reason: string;
    retryCount: number;  // Total attempts made in the previous round.
    retryable: boolean;
    theBest: ChannelQuoteInfo;
    type: 'payment-failed';
  };

export type ProcessorState = {
  expirationInfo: Ref<InvoiceExpirationInfo>;
  processingProgress: Ref<ProcessingProgress>;
};

const DEBUGGING_NO_CHANNELS_AT_ALL = false;
const DEBUGGING_CHANNELS_NOT_READY = false;

const getInvoiceExpirationInfo = (invoice: Invoice): InvoiceExpirationInfo => {
  const possibleExpirationDate = Invoice.expirationDate(invoice);
  if(possibleExpirationDate != null) {
    if(possibleExpirationDate.isErr()) {
      return { type: 'invalid' };
    }
    const now = ValidDate.now();
    if(ValidDate.ord.isGreaterThan(now, possibleExpirationDate.value)
       && !(DEBUGGING_NO_CHANNELS_AT_ALL
            || DEBUGGING_CHANNELS_NOT_READY)) {
      return { type: 'expired', expiredAt: possibleExpirationDate.value };
    } else {
      return { type: 'valid', expiresAt: possibleExpirationDate.value };
    }
  }
  return { type: 'valid', expiresAt: null };
}

const validateInvoice = (
  invoice: Invoice,
  expirationInfo: InvoiceExpirationInfo,
  consumer: AppKonduitConsumer,
  fx: Fx | null,
): Result<ValidatedInvoice, BlockedReason> => {
  if(expirationInfo.type === 'invalid')
    return err({ type: 'invoice-invalid' });
  if(expirationInfo.type === 'expired' && !(DEBUGGING_NO_CHANNELS_AT_ALL || DEBUGGING_CHANNELS_NOT_READY))
    return err({ type: 'invoice-expired' });
  const maximumCapacity = consumer.maximumCapacity;
  if(maximumCapacity === null || DEBUGGING_NO_CHANNELS_AT_ALL || DEBUGGING_CHANNELS_NOT_READY) {
    if(consumer.channels.length == 0 || DEBUGGING_NO_CHANNELS_AT_ALL)
      return err({ type: 'no-channels-at-all' });
    else {
      const notReady = (consumer.channels.filter(ch => !ch.wasApproved || DEBUGGING_CHANNELS_NOT_READY));
      if(notReady.length > 0 || DEBUGGING_CHANNELS_NOT_READY)
        return err({ type: 'channels-not-ready', channel: notReady[0]! });
      return err({ type: 'all-channels-closed' });
    }
  }
  if(fx === null)
    return err({ type: 'fx-not-ready' });
  return Fx.msat2Lovelace(fx, invoice.amount)
    .match(
      (invoiceAmountInLovelace) => {
        if(Lovelace.ord.isLessThan(maximumCapacity.lovelace, invoiceAmountInLovelace))
          return err({ type: 'not-enough-capacity' });
        return ok({ invoice, expirationInfo } as ValidatedInvoice);
      },
      (error) => err({ type: 'invoice-amount-conversion-failed', message: error })
    );
}

const createOrReuseRef = <T>(existingRef: Ref<T> | undefined, initialValue: T): Ref<T> => {
  if(existingRef) {
    existingRef.value = initialValue;
    return existingRef;
  }
  return ref(initialValue) as Ref<T>;
}

const paymentInProgress = ref(false);

// Please note that this function is non reactive by design:
// * It outputs reactive state and updates it in the background.
// * But it itself does not react to changes to consumer events.
const init = (
  invoice: Invoice,
  consumer: AppKonduitConsumer,
  // Fx is used to estimate if the channels have enough capacity to process the invoice.
  fx: Fx | null,
  exprInfoRef?: Ref<InvoiceExpirationInfo>,
  progressRef?: Ref<ProcessingProgress>
): ProcessorState => {
  const expirationInfoRef: Ref<InvoiceExpirationInfo> = createOrReuseRef(
    exprInfoRef,
    getInvoiceExpirationInfo(invoice)
  );
  return validateInvoice(invoice, expirationInfoRef.value, consumer, fx).match(
    (_validatedInvoice) => {
      const abortController = new AbortController();
      const processingProgressRef: Ref<ProcessingProgress> = createOrReuseRef(progressRef, {
          abortController,
          bestSoFar: null,
          allQuoteResults: [],
          type: 'quotes-loading',
      });
      consumer.queryQuotes(invoice.raw, (results, bestSoFar) => {
        if(processingProgressRef.value?.type !== 'quotes-loading') return;
        processingProgressRef.value = {
          abortController,
          allQuoteResults: results,
          bestSoFar,
          type: 'quotes-loading',
        };
      }, abortController.signal).then(([results, theBest]) => {
        if(processingProgressRef.value?.type !== 'quotes-loading') return;
        const failedDueToNetworking = results.every(r =>
          r.quoteResult.isErr() && r.quoteResult.error.type === 'NetworkError');
        if(failedDueToNetworking)
          processingProgressRef.value = {
            allQuoteResults: results,
            reason: { type: 'quoting-networking-failed' },
            type: 'quoting-failed',
          };
        else if (theBest === null)
          processingProgressRef.value = {
            allQuoteResults: results,
            reason: { type: 'quotes-failed' },
            type: 'quoting-failed',
          };
        else {
          // The stack of errors is rather big here :-)
          // export type ImmediatePaymentError =
          //   | AbortedError
          //   | NetworkError
          //   | AdaptorRejection
          //   | CriticalError
          // 
          // export type PendingPayment = {
          //   cheque: LockedCheque;
          //   info: {
          //     error: ImmediatePaymentError | null;
          //     invoice: Invoice;
          //   } | null;
          // };
          // 
          // export type ChequeIssuingError =
          //   | { type: "ChannelNotOperational", message: "The channel is not operational" }
          //   | { type: "OverspendsChannel", message: "Total sum of the cheques will exceed the channel capacity" }
          //   | { type: "TimeoutInThePast"; message: "Cheque timeout has to be in the future" }
          // 
          // export type PayError =
          //   | { type: "TimeoutCalculation"; error: string }
          //   | ChequeIssuingError
          // 
          //   public pay = async (channel: Channel, quote: Quote, invoice: Invoice): Promise<Result<ConfirmedPayment | PendingPayment, PayError>> => {
          //     const timeout = ValidDate.addMilliseconds(ValidDate.now(), quote.relativeTimeout);
          //     return timeout.match(
          //       async (timeout) => {
          //         const payResult = await channel.doPay(quote.amount, timeout, invoice, this.sKey);
          //         return payResult;
          //       },
          //       async (error) => err({ type: "TimeoutCalculation" as const, error } as PayError)
          //     );
          //   }
          const pay = async (quote: ChannelQuoteInfo, consumer: AppKonduitConsumer, invoice: Invoice): Promise<void> => {
            if(paymentInProgress.value) return;
            paymentInProgress.value = true;

            // public pay = async (channel: Channel, quote: Quote, invoice: Invoice): Promise<Result<ConfirmedPayment | PendingPayment, PayError>> => {
            const result = await consumer.pay(quote.channel, quote.quote, invoice);
            paymentInProgress.value = false;
            result.match(
              (_payment) => {
                processingProgressRef.value = {
                  allQuoteResults: results,
                  usedQuote: quote,
                  type: 'payment-successful',
                };
              }),
              (error) => {
                processingProgressRef.value = {
                  allQuoteResults: results,
                  reason: `Payment failed: ${error}`,
                  retryable: false,
                  theBest: quote,
                  type: 'payment-failed',
                  retryCount: 0,
                };
               }
              )
            );
          }

          processingProgressRef.value = {
            allQuoteResults: results,
            pay: () => pay(theBest, consumer, invoice),
            theBest: theBest,
            type: 'quotes-loaded',
          };
        };
      });
      return {
        expirationInfo: createOrReuseRef(
          expirationInfoRef,
          validatedInvoice.expirationInfo
        ),
        processingProgress: processingProgressRef,
      } as ProcessorState;
    },
    (blockedReason) => {
      return {
        expirationInfo: expirationInfoRef,
        processingProgress: createOrReuseRef(progressRef, {
          type: 'quoting-blocked',
          reason: blockedReason,
        })
      } as ProcessorState;
    }
  );
};

//  total: T;
//  invoice: T;
//  fee: T;
export type BreakdownOrEstimate = {
  estimate: boolean,
  invoice: AnyAmount;
  fee: AnyAmount;
  total: AnyAmount;
}

const mkPaymentBreakdown = (
  invoice: Invoice,
  processingProgress: Ref<ProcessingProgress>,
  fxPollingInfo: Ref<PollingInfo<Fx | null>>,
  currentCurrency: Ref<AnyAmountSymbol>,
): ComputedRef<Result<BreakdownOrEstimate, string>> => {
  return computed(() => {
    const currentFx = fxPollingInfo.value?.lastSuccessfulFetch?.value ?? null;
    if(currentFx === null) return err('Fx service is not ready yet.');
    const mkPureEstimate = (): Result<BreakdownOrEstimate, string> =>
      AnyPayment.estimateBreakdownInBtc(invoice.amount)
        .andThen((estimated) =>
          Fx.msat2Lovelace(currentFx, estimated.total.value)
            .andThen((estimatedTotalInLovelace) => AnyPayment.breakItDown(
                invoice.amount,
                estimatedTotalInLovelace,
                currentFx,
                currentCurrency.value
              )
            ).map(details => ({ estimate: true, ...details }))
        );
    const mkBreakdown = (bestSoFar: ChannelQuoteInfo): Result<BreakdownOrEstimate, string> =>
        AnyPayment.breakItDown(
          invoice.amount,
          bestSoFar.quote.amount,
          currentFx,
          currentCurrency.value
        ).map(details => ({ estimate: false, ...details }));
    switch(processingProgress.value.type) {
      case 'quoting-failed':
      case 'quoting-blocked': return mkPureEstimate();
      case 'quotes-loading':
        if(processingProgress.value.bestSoFar === null) return mkPureEstimate();
        return mkBreakdown(processingProgress.value.bestSoFar);
      case 'quotes-loaded':
      case 'payment-failed':
        return mkBreakdown(processingProgress.value.theBest);
    }
  });
}

export type UseInvoiceProcessor = {
  expirationInfo: Ref<InvoiceExpirationInfo>;
  paymentBreakdown: ComputedRef<Result<BreakdownOrEstimate, string>>;
  processingProgress: Ref<ProcessingProgress>;
  retry: () => void;
};

export const useInvoiceProcessor = (consumer: AppKonduitConsumer, invoice: Invoice): UseInvoiceProcessor => {
  const { currentCurrency, fxPollingInfo } = useFx();
  const fx = fxPollingInfo.value?.lastSuccessfulFetch?.value ?? null;
  const { expirationInfo, processingProgress } = init(invoice, consumer, fx);
  return {
    expirationInfo,
    paymentBreakdown: mkPaymentBreakdown(invoice, processingProgress, fxPollingInfo, currentCurrency),
    processingProgress,
    retry: () => {
      const fx = fxPollingInfo.value?.lastSuccessfulFetch?.value ?? null;
      init(invoice, consumer, fx, expirationInfo, processingProgress);
    },
  };
}

// const notifications = useNotifications();
