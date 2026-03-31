import { computed, ref, unref, type ComputedRef, type Ref } from "vue";
import { AdaAmount, AmountFx, AnyAmount, type AnyAmountSymbol, type CryptoAmount } from "@konduit/konduit-consumer/amounts";
import type { Fx } from "@konduit/konduit-consumer/fx";
import * as l10n from "./l10n";
import { MISSING_PLACEHOLDER } from "../utils/formatters";
import { PollingInfo } from "@konduit/konduit-consumer/polling";
import { Seconds } from "@konduit/konduit-consumer/time/duration";
import { useKrakenTickers } from "./kraken";
import { mkKrakenFxFromTickers } from "@konduit/konduit-consumer/kraken";
import { err, type Result } from "neverthrow";
import { Lovelace } from "@konduit/konduit-consumer/cardano";

export type ConversionError =
  | { type: "FxNotReady" }
  | { type: "ConversionError"; message: string };

export type UseFx = {
  currentCurrency: Ref<AnyAmountSymbol>;
  fxPollingInfo: Ref<PollingInfo<Fx | null>>;
  toCurrentCurrency: (amount: CryptoAmount) => Result<AnyAmount, ConversionError>;
  formatCryptoInCurrent: (amountRef: CryptoAmount | null | Ref<CryptoAmount | null> | ComputedRef<CryptoAmount | null>) => ComputedRef<string>;
  formatAdaInCurrent: (amountRef: Lovelace | null | Ref<Lovelace | null> | ComputedRef<Lovelace | null>) => ComputedRef<string>;
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
    amountRef: Ref<CryptoAmount | null> | ComputedRef<CryptoAmount | null> | CryptoAmount | null
  ): ComputedRef<string> => computed(() => {
    const amount: CryptoAmount | null = amountRef && "symbol" in amountRef ? amountRef : (amountRef as Ref<CryptoAmount | null>).value;
    if (amount === null) return MISSING_PLACEHOLDER;
    const amountInCurrent = toCurrentCurrency(amount);
    return amountInCurrent.match(
      amt => formatters.formatAnyAmount(amt),
      _err => MISSING_PLACEHOLDER
    );
  });

  const formatAdaInCurrent = (amountRef: Ref<Lovelace | null> | ComputedRef<Lovelace | null> | Lovelace | null): ComputedRef<string> => {
    const amountRaw: Lovelace | null = unref(amountRef);
    const amount = AdaAmount.fromLovelace(amountRaw || Lovelace.zero);
    return formatCryptoInCurrent(amount);
  }

  return {
    currentCurrency: currentCurrencyRef,
    fxPollingInfo: fxPollingInfoRef,
    formatAdaInCurrent,
    formatCryptoInCurrent,
    toCurrentCurrency,
  };
};

