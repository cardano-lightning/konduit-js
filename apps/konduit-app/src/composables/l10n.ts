import { computed } from 'vue';
import { useLocale } from './locale';
import { CurrencyFormat, type CurrencyFormatOptions, type Notation } from '@konduit/currency-format';
import Decimal from 'decimal.js-i18n';

export type FormatterOptions = Intl.NumberFormatOptions & Intl.DateTimeFormatOptions;

export function useNumberFormatter(options: Intl.NumberFormatOptions = {}) {
  const locale = useLocale();

  // FIXME: provide a fallback for devices/browsers which
  // do not support Intl API.
  return computed(() => {
    const formatter = new Intl.NumberFormat(locale.value, { ...options });
    return (value: number | bigint) => formatter.format(value);
  });
}

export function useDateFormatter(options: Intl.DateTimeFormatOptions = {}) {
  const locale = useLocale();

  // FIXME: Provide a fallback for devices/browsers which
  // do not support Intl API.
  return computed(() => {
    const formatter = new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short', ...options });
    return (value: Date | number) => {
      const date = value instanceof Date ? value : new Date(Number(value));
      return formatter.format(date);
    }
  });
}

export function useCurrencyFormatter(options: CurrencyFormatOptions<Notation>) {
  const locale = useLocale();

  return computed(() => {
    const formatter = new CurrencyFormat(locale.value, options);
    return (value: number | bigint) => formatter.format(value);
  });
}

export function useDurationFormatter(options: Intl.RelativeTimeFormatOptions = {}) {
  const locale = useLocale();

  return computed(() => {
    const formatter = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto', ...options });
    return (value: number, unit: Intl.RelativeTimeFormatUnit) => formatter.format(value, unit);
  });
}

function mkSafeFormatter<Args extends any[], R = string>(
  formatter: ((...args: Args) => R) | null | undefined
): (...args: Args) => R | string {
  return (...args: Args) => {
    if (args[0] == null || formatter == null) {
      return "N/A";
    }
    return formatter(...args);
  };
}

// You can use the returned value directly passing it a `value | null | undefined`.
export function useDefaultFormatters() {
  // This expects values in lovelace (could be Decimal or bigint)
  const adaFormatter = useCurrencyFormatter({
    currency: { code: 'ADA', unit: 'lovelace', lovelaceDisplayThreshold: new Decimal('0.001') }
  });

  // This expects values in satoshis (could be Decimal or bigint)
  const btcFormatter = useCurrencyFormatter({
    currency: { code: 'BTC', unit: 'sat', satDisplayThreshold: new Decimal('0.01') }
  });

  const shortDateFormatter = useDateFormatter({ dateStyle: 'short' });

  const durationFormatter = useDurationFormatter();

  return {
    ada: mkSafeFormatter(adaFormatter.value),
    btc: mkSafeFormatter(btcFormatter.value),
    duration: mkSafeFormatter(durationFormatter.value),
    shortDate: mkSafeFormatter(shortDateFormatter.value),
  };
}
