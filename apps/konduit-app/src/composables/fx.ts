import { computed, ref, type ComputedRef, type Ref } from "vue";
import { AmountFx, AnyAmount, type AnyAmountSymbol, type CryptoAmount } from "@konduit/konduit-consumer/amounts";
import type { Fx } from "@konduit/konduit-consumer/fx";
import * as l10n from "./l10n";
import { MISSING_PLACEHOLDER } from "../utils/formatters";
import { PollingInfo } from "@konduit/konduit-consumer/polling";
import { Seconds } from "@konduit/konduit-consumer/time/duration";
import { useKrakenTickers } from "./kraken";
import { mkKrakenFxFromTickers } from "@konduit/konduit-consumer/kraken";
import { err, type Result } from "neverthrow";

export type ConversionError =
  | { type: "FxNotReady" }
  | { type: "ConversionError"; message: string };

export type UseFx = {
  currentCurrency: Ref<AnyAmountSymbol>;
  fxPollingInfo: Ref<PollingInfo<Fx | null>>;
  toCurrentCurrency: (amount: CryptoAmount) => Result<AnyAmount, ConversionError>;
  formatCryptoInCurrent: (amountRef: Ref<CryptoAmount | null> | ComputedRef<CryptoAmount | null>) => ComputedRef<string>;
};

const currentCurrencyRef = ref<AnyAmountSymbol>("USD");
const formatters = l10n.useDefaultFormatters();

export const useFx = (intervalSeconds?: Seconds): UseFx => {
  const syncInterval = intervalSeconds ?? Seconds.fromDigits(6, 0);
  const { tickersInfo } = useKrakenTickers(syncInterval);
  const fxPollingInfoRef = computed(() => {
    return tickersInfo.value.mapValue(tickers => {
      return mkKrakenFxFromTickers(tickers);
    });
  });

  const toCurrentCurrency = (amount: CryptoAmount): Result<AnyAmount, ConversionError> => {
    const fx = fxPollingInfoRef.value?.lastSuccessfulFetch?.value ?? null;
    if(fx === null) return err({ type: "FxNotReady" });
    return AmountFx.crypto2Any(fx, amount, currentCurrencyRef.value).mapErr(e => ({ type: "ConversionError", message: e }));
  }

  const formatCryptoInCurrent = (
    amountRef: Ref<CryptoAmount | null> | ComputedRef<CryptoAmount | null>
  ): ComputedRef<string> => computed(() => {
    const amount = amountRef.value;
    if (amount === null) return MISSING_PLACEHOLDER;
    const amountInCurrent = toCurrentCurrency(amount);
    return amountInCurrent.match(
      amt => formatters.formatAnyAmount(amt),
      _err => MISSING_PLACEHOLDER
    );
  });

//   const formatAmount = computed(() => (
//     amount: Amount,
//     formattersOverride?: {
//       formatAda: (v: Lovelace) => string;
//       formatUsd: (v: unknown) => string;
//       formatBtc: (v: Satoshi) => string;
//       formatBtcMsat: (v: Millisatoshi) => string;
//     },
//     missingPlaceholderOverride?: string,
//   ): Result<string, string> => {
//     const missingPlaceholder = missingPlaceholderOverride ?? MISSING_PLACEHOLDER;
//     const formatters = formattersOverride ?? defaultFormatters;
//     if (amount.value === "uknown-yet") return ok(missingPlaceholder);
//     const amountInCurrent = toCurrentCurrency(amount);
//     if (amountInCurrent.isErr()) return err(amountInCurrent.error);
//     switch (currentCurrency.value) {
//       case "ADA": return formatters.formatAda(amountInCurrent.value as Lovelace);
//       case "USD": return formatters.formatUsd(fromMsatToCurrent as unknown as Amount);
//       case "BTC": {
//         const v: BtcAmount = amount.value;
//         if ("satoshi" in v) return formatters.formatBtc(v.satoshi as Satoshi);
//         return formatters.formatBtcMsat(v.millisatoshi as Millisatoshi);
//       }
//     }
//   });
// 
  return {
    currentCurrency: currentCurrencyRef,
    fxPollingInfo: fxPollingInfoRef,
    formatCryptoInCurrent,
    toCurrentCurrency,
//     fromLovelaceToCurrent,
//     fromMsatToCurrent,
//   formatAmount,
  };
};

