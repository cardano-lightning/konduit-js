import { computed } from 'vue';
import { useLocale } from './locale';
import { CurrencyFormat, type CurrencyFormatOptions, type Notation } from '@konduit/currency-format';
import Decimal from 'decimal.js-i18n';
import { Lovelace, type Ada } from '@konduit/konduit-consumer/cardano';
import { Millisatoshi, Satoshi } from '@konduit/konduit-consumer/bitcoin';
import { Milliseconds, NormalisedDuration, type AnyPreciseDuration } from '@konduit/konduit-consumer/time/duration';
import type { POSIXMilliseconds, ValidDate } from '@konduit/konduit-consumer/time/absolute';
import type { PositiveInt } from '@konduit/codec/integers/smallish';
import type { AnyAmount, AnyAmountSymbol } from '@konduit/konduit-consumer/amounts';
import { britishPenny2BritishMillipenny, britishPound2BritishPenny, euro2EuroCent, euroCent2EuroMillicent, ExchangeRate, usCent2UsMillicent, usDollar2UsCent } from '@konduit/konduit-consumer/fx';
import type { NonNegativeDecimal } from '@konduit/codec/decimals';
import { MISSING_PLACEHOLDER } from '../utils/formatters';
import type { UsMillicent } from '@konduit/konduit-consumer/fx';
import type { Sign } from '@konduit/konduit-consumer/amounts';

export type FormatterOptions = Intl.NumberFormatOptions & Intl.DateTimeFormatOptions;

// How close to the upper bound we consider "near enough" to round up
const DURATION_ROUND_UP_THRESHOLD = 0.51;

export function useNumberFormatter(options: Intl.NumberFormatOptions = {}) {
  const locale = useLocale();

  // FIXME: provide a fallback for devices/browsers which
  // do not support Intl API.
  return computed(() => {
    return new Intl.NumberFormat(locale.value, { ...options });
  });
}

export function useFormatNumber(options: Intl.NumberFormatOptions = {}) {
  const formatter = useNumberFormatter(options);
  return (value: number | bigint) => {
    return formatter.value.format(value);
  }
};

export function useDateFormatter(options: Intl.DateTimeFormatOptions = {}) {
  const locale = useLocale();

  // FIXME: Provide a fallback for devices/browsers which
  // do not support Intl API.
  // Because we use short forms we can be sure that now matter the locale
  // the output will not contain any weird translations like "Expires: 17 września 2024".
  return computed(() => {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short', ...options });
  });
}

export function useFormatDate(options: Intl.DateTimeFormatOptions = {}) {
  const formatter = useDateFormatter(options);
  return (value: Date | number) => {
    const date = value instanceof Date ? value : new Date(Number(value));
    return formatter.value.format(date);
  }
};
// Some people say that constructing a formatter is expensive operation
export function useCurrencyFormatter(options: CurrencyFormatOptions<Notation>) {
  const locale = useLocale();
  return computed(() => {
    const formatter = new CurrencyFormat(locale.value, options);
    return formatter;
  });
}

export type TimeDirection = "future" | "past";

// Currently the whole UI is in English, so in the case of non-english locales
// we fallback to `en-US` for long forms to avoid weird translations like "1 dzień ago"
const textualFormLocale = computed(() => {
  const locale = useLocale();
  if(!locale.value.startsWith('en')) {
    return 'en-US' as typeof locale.value;
  }
  return locale.value;
});


export function useRelativeTimeFormatter(options: Intl.RelativeTimeFormatOptions = {}) {
  return computed(() => {
    const formatter = new Intl.RelativeTimeFormat(textualFormLocale.value, { style: 'short', ...options });
    return {
      format: (duration: AnyPreciseDuration, timeDirection?: TimeDirection) => {
        const value = timeDirection === "past" ? -duration.value : duration.value;
        return formatter.format(value, duration.type as Intl.RelativeTimeFormatUnit);
      },
      formatToParts: (duration: AnyPreciseDuration, timeDirection?: TimeDirection) => {
        const value = timeDirection === "past" ? -duration.value : duration.value;
        return formatter.formatToParts(value, duration.type as Intl.RelativeTimeFormatUnit);
      }
    }
  });
}

export function useDurationFormatter(options: Intl.RelativeTimeFormatOptions = {}) {
  return computed(() => {
    // FIXME: Duration Format is not yet in the standard Intl types
    const formatter = new (Intl as any).DurationFormat(textualFormLocale.value, options);
    return {
      format: (duration: NormalisedDuration) => formatter.format(duration),
      formatToParts: (duration: NormalisedDuration) => formatter.formatToParts(duration),
    }
  });
}

function mkSafeFn1Formatter<T>(formatter: (((a: T) => string))): (value: T | null | undefined) => string {
  return (value: T | null | undefined) => {
    if (value == null || value === undefined) {
      return MISSING_PLACEHOLDER;
    }
    return formatter(value);
  }
}

function mkSafeFn2Formatter<T1, T2>(formatter: ((a: T1, b: T2) => string)): (value1: T1 | null | undefined, value2: T2) => string {
  return (value1: T1 | null | undefined, value2: T2) => {
    if (value1 == null || value1 === undefined) {
      return "N/A";
    }
    return formatter(value1, value2);
  }
}

function mkSafeFn2OptFormatter<T1, T2>(formatter: ((a: T1, b?: T2) => string)): (value1: T1 | null | undefined, value2?: T2) => string {
  return (value1: T1 | null | undefined, value2?: T2) => {
    if (value1 == null || value1 === undefined) {
      return "N/A";
    }
    return formatter(value1, value2);
  }
}

// You can use the returned value directly passing it a `value | null | undefined`.
export function useDefaultFormatters() {
  // This expects values in lovelace (could be Decimal or bigint)
  const adaFormatter = useCurrencyFormatter({
    currency: { code: 'ADA', unit: 'lovelace', lovelaceDisplayThreshold: new Decimal('0.0001') },
  });

  const adaFormatterRounded = useCurrencyFormatter( {
    currency: { code: 'ADA', unit: 'lovelace', lovelaceDisplayThreshold: new Decimal('0.0001') },
    maximumFractionDigits: 2
  });

  // This expects values in satoshis (could be Decimal or bigint)
  const btcFormatter = useCurrencyFormatter({
    currency: { code: 'BTC', unit: 'sat', satDisplayThreshold: new Decimal('0.001') }
  });

  const btcMsatFormatter = useCurrencyFormatter({
    currency: { code: 'BTC', unit: 'msat', msatDisplayThreshold: new Decimal('0.001') }
  });

  const usDollarFormatter = useCurrencyFormatter({ currency: 'USD' });
  const usDollarFormatterRounded = useCurrencyFormatter({ currency: 'USD', maximumFractionDigits: 2 });
  const euroFormatter = useCurrencyFormatter({ currency: 'EUR' });
  const britishPoundFormatter = useCurrencyFormatter({ currency: 'GBP' });

  const shortDateFormatter = useDateFormatter({ dateStyle: 'short' });

  const durationShortFormatter = useDurationFormatter({ style: 'short' });
  const durationLongFormatter = useDurationFormatter({ style: 'long' });
  const relativeTimeFormatter = useRelativeTimeFormatter();
  const formatUsDolar = (value: UsMillicent, sign: Sign = "positive", rounded: boolean = true) => {
    const usMiillicent2UsDollar = ExchangeRate.reverse(
      ExchangeRate.pipe(usDollar2UsCent, usCent2UsMillicent)
    );
    const usDollarDecimal: NonNegativeDecimal = ExchangeRate.convert2Any(
      usMiillicent2UsDollar,
      value,
      (dec) => dec
    );
    const signMultiplier = sign == "positive" ? Decimal(1) : Decimal(-1);
    if(rounded) return usDollarFormatterRounded.value.format(usDollarDecimal.mul(signMultiplier));
    return usDollarFormatter.value.format(usDollarDecimal.mul(signMultiplier));
  };
  const formatBtcMsat = (orig: Millisatoshi, sign: Sign = "positive") => {
    let oneSatoshiMs = Millisatoshi.fromSatoshi(Satoshi.fromDigits(1))
    let signMultiplier = sign == "positive" ? 1n : -1n;
    if(Millisatoshi.ord.isGreaterThan(orig, oneSatoshiMs)) {
      const satoshiDecimal = Decimal(orig).div(1000).mul(signMultiplier);
      return btcFormatter.value.format(satoshiDecimal);
    }
    return btcMsatFormatter.value.format(orig * signMultiplier);
  }
  const formatAda = (value: Lovelace | { ada: Ada }, sign: Sign = "positive", rounded: boolean = true) => {
    let lovelace = (typeof value == 'object' && 'ada' in value)? Lovelace.fromAda(value.ada) : value;
    const signMultiplier = sign == "positive" ? 1n : -1n;
    if(rounded) return adaFormatterRounded.value.format(lovelace * signMultiplier);
    return adaFormatter.value.format(lovelace * signMultiplier);
  };
  return {
    adaFormatter: adaFormatter.value,
    adaFormatterRounded: adaFormatterRounded.value,
    btcFormatter: btcFormatter.value,
    durationShortFormatter: durationShortFormatter.value,
    durationLongFormatter: durationLongFormatter.value,
    relativeTimeFormatter: relativeTimeFormatter.value,
    formatAda: mkSafeFn2OptFormatter(formatAda),
    formatBtc: mkSafeFn1Formatter((value: Satoshi) => btcFormatter.value.format(value)),
    formatBtcMsat: mkSafeFn2OptFormatter(formatBtcMsat),
    formatUsDollar: mkSafeFn1Formatter(formatUsDolar),
    formatDurationShort: mkSafeFn1Formatter((value: NormalisedDuration) => durationShortFormatter.value.format(value)),
    formatDurationLong: mkSafeFn1Formatter((value: Milliseconds | NormalisedDuration, cutPrecision: boolean = true) => {
      const finalMilliseconds = (() => {
        const milliseconds = (() => {
          if (typeof value === 'object') {
            return Milliseconds.fromNormalisedDuration(value);
          }
          return value;
        })();

        if (cutPrecision) {
          const secondsMs = 1000 as PositiveInt;
          const minuteMs = 60 * secondsMs as PositiveInt;
          const hourMs = 60 * minuteMs as PositiveInt;
          const dayMs = 24 * hourMs as PositiveInt;
          const weeksMs = 7 * dayMs as PositiveInt;

          const roundWithThreshold = (unitMs: PositiveInt) => {
            const reminderMs = milliseconds % unitMs;
            const quotientMs = milliseconds - reminderMs;
            const thresholdInMs = DURATION_ROUND_UP_THRESHOLD * unitMs;
            const chosen = reminderMs >= thresholdInMs ? quotientMs + unitMs : quotientMs;
            return chosen;
          };

          if (milliseconds >= weeksMs) return roundWithThreshold(weeksMs);
          if (milliseconds >= dayMs) return roundWithThreshold(dayMs);
          if (milliseconds >= hourMs) return roundWithThreshold(hourMs);
          if (milliseconds >= minuteMs) return roundWithThreshold(minuteMs);
          if (milliseconds >= secondsMs) return roundWithThreshold(secondsMs);
        }

        return milliseconds;
      })();
      const finalDuration = NormalisedDuration.fromComponentsNormalization({ milliseconds: finalMilliseconds as Milliseconds });
      return durationLongFormatter.value.format(finalDuration);
    }),
    formatRelativeTime: mkSafeFn2Formatter((value: AnyPreciseDuration, timeDirection: TimeDirection) => relativeTimeFormatter.value.format(value, timeDirection)),
    formatShortDate: mkSafeFn1Formatter((value: ValidDate | POSIXMilliseconds) => shortDateFormatter.value.format(value)),
    formatAnyAmount: mkSafeFn1Formatter((amount: AnyAmount) => {
      const symbol: AnyAmountSymbol = amount.symbol;
      switch (symbol) {
        case "ADA":
          return formatAda(amount.value as Lovelace, amount.sign);
        case "BTC":
          return formatBtcMsat(amount.value as Millisatoshi, amount.sign);
        case "EUR":
          const euroMillicent2Euro = ExchangeRate.reverse(
            ExchangeRate.pipe(euro2EuroCent, euroCent2EuroMillicent)
          );
          const euroDecimal: NonNegativeDecimal = ExchangeRate.convert2Any(
            euroMillicent2Euro,
            amount.value,
            (dec: NonNegativeDecimal) => dec
          );
          return euroFormatter.value.format(euroDecimal);
        case "USD":
          return formatUsDolar(amount.value as UsMillicent);
        case "GBP":
          const britishMillipenny2BritishPound = ExchangeRate.reverse(
            ExchangeRate.pipe(britishPound2BritishPenny, britishPenny2BritishMillipenny)
          );
          const britishPoundDecimal: NonNegativeDecimal = ExchangeRate.convert2Any(
            britishMillipenny2BritishPound,
            amount.value,
            (dec) => dec
          );
          return britishPoundFormatter.value.format(britishPoundDecimal);
      }
    }),
  };
}
