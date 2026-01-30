import { computed } from 'vue';
import { useLocale } from './locale';
import { CurrencyFormat, type CurrencyFormatOptions, type Notation } from '@konduit/currency-format';
import Decimal from 'decimal.js-i18n';
import type { Lovelace } from '../../../../paluh/key-management/packages/konduit-consumer/dist/cardano';

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

export function useDurationFormatter(options: Intl.RelativeTimeFormatOptions = {}) {
  const locale = useLocale();

  return computed(() => {
    return new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto', ...options });
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

  const durationFormatter = useDurationFormatter();

  // return (value: number, unit: Intl.RelativeTimeFormatUnit) => formatter.format(value, unit);
  return {
    adaFormatter: adaFormatter.value,
    formatAda: mkSafeFn1Formatter((value: Lovelace) => adaFormatter.value.format(value)),
    btcFormatter: btcFormatter.value,
    formatBtc: mkSafeFn1Formatter((value: number | bigint) => btcFormatter.value.format(value)),
    duration: mkSafeFn2Formatter((value: number, unit: Intl.RelativeTimeFormatUnit) => durationFormatter.value.format(value, unit)),
    shortDate: mkSafeFn1Formatter((value: Date | number) => shortDateFormatter.value.format(value)),
  };
}
