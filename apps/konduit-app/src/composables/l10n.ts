import { computed } from 'vue';
import { useLocale } from './locale';
import { CurrencyFormat, type CurrencyFormatOptions, type Notation } from '@konduit/currency-format';
import Decimal from 'decimal.js-i18n';
import type { Lovelace } from '@konduit/konduit-consumer/cardano';
import type { AnyPreciseDuration, NormalisedDuration } from '@konduit/konduit-consumer/time/duration';
import type { ValidDate } from '@konduit/konduit-consumer/time/absolute';

export type FormatterOptions = Intl.NumberFormatOptions & Intl.DateTimeFormatOptions;

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

export function useRelativeTimeFormatter(options: Intl.RelativeTimeFormatOptions = {}) {
  const locale = useLocale();

  return computed(() => {
    const formatter = new Intl.RelativeTimeFormat(locale.value, { style: 'short', ...options });
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
  const locale = useLocale();

  return computed(() => {
    // FIXME: Duration Format is not yet in the standard Intl types
    const formatter = new (Intl as any).DurationFormat(locale.value, options);
    return {
      format: (duration: NormalisedDuration) => formatter.format(duration),
      formatToParts: (duration: NormalisedDuration) => formatter.formatToParts(duration),
    }
  });
}

function mkSafeFn1Formatter<T>(formatter: (((a: T) => string))): (value: T | null | undefined) => string {
  return (value: T | null | undefined) => {
    if (value == null || value === undefined) {
      return "N/A";
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

// You can use the returned value directly passing it a `value | null | undefined`.
export function useDefaultFormatters() {
  // This expects values in lovelace (could be Decimal or bigint)
  const adaFormatter = useCurrencyFormatter({
    currency: { code: 'ADA', unit: 'lovelace', lovelaceDisplayThreshold: new Decimal('0.0001') }
  });

  // This expects values in satoshis (could be Decimal or bigint)
  const btcFormatter = useCurrencyFormatter({
    currency: { code: 'BTC', unit: 'sat', satDisplayThreshold: new Decimal('0.01') }
  });

  const shortDateFormatter = useDateFormatter({ dateStyle: 'short' });

  const durationShortFormatter = useDurationFormatter({ style: 'short' });
  const durationLongFormatter = useDurationFormatter({ style: 'long' });
  const relativeTimeFormatter = useRelativeTimeFormatter();

  return {
    adaFormatter: adaFormatter.value,
    btcFormatter: btcFormatter.value,
    durationShortFormatter: durationShortFormatter.value,
    durationLongFormatter: durationLongFormatter.value,
    relativeTimeFormatter: relativeTimeFormatter.value,
    formatAda: mkSafeFn1Formatter((value: Lovelace) => adaFormatter.value.format(value)),
    formatBtc: mkSafeFn1Formatter((value: number | bigint) => btcFormatter.value.format(value)),
    formatDurationShort: mkSafeFn1Formatter((value: NormalisedDuration) => durationShortFormatter.value.format(value)),
    formatDurationLong: mkSafeFn1Formatter((value: NormalisedDuration) => durationLongFormatter.value.format(value)),
    formatRelativeTime: mkSafeFn2Formatter((value: AnyPreciseDuration, timeDirection: TimeDirection) => relativeTimeFormatter.value.format(value, timeDirection)),
    formatShortDate: mkSafeFn1Formatter((value: ValidDate | number) => shortDateFormatter.value.format(value)),
  };
}
