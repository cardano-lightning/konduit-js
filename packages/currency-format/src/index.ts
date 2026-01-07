import { Decimal } from 'decimal.js-i18n';

// FIXME: This is workaround to a buggy release of the decimal.js-i18n package.
Decimal.DecimalFormat = (Decimal as any).Format;

type Currency = Decimal.DecimalFormat.Currency;

export type CryptoCurrency = "BTC" | "ETH" | "ADA";


export type CurrencyCode = Currency | CryptoCurrency;

// Extra currency symbols not included in the Intl API
const currencySymbols: Partial<Record<CurrencyCode, string>> = {
  ADA: "₳",
  BTC: "₿",
  ETH: "Ξ",
};

// Currency extensions which introduce sub-units based formatting

export type BitcoinSpec = {
  code: 'BTC';
  unit: 'sat' | 'btc';
  // Threshold from which to display in satoshis instead of bitcoins
  satDisplayThreshold?: Decimal;
};

export type AdaSpec = {
  code: 'ADA';
  unit: 'lovelace' | 'ada';
  lovelaceDisplayThreshold?: Decimal;
};

export type CurrencySpec =
  | Currency
  | CryptoCurrency
  | BitcoinSpec
  | AdaSpec;


export type SubunitCode = "SAT" | "LOV";

const subunitNames: Record<SubunitCode, string> = {
  LOV: "lovelace",
  SAT: "sat",
};

const unitExponents: Record<SubunitCode, bigint> = {
  LOV: BigInt(6), // 1 ADA = 1,000,000 Lovelace
  SAT: BigInt(8), // 1 BTC = 100,000,000 Satoshi
};

export type Notation = Decimal.DecimalFormat.Notation;
export type Locale = Decimal.DecimalFormat.Locale;

export type CurrencyFormatOptions<N extends Notation> = Omit<Decimal.DecimalFormat.FormatOptions<N, "currency">, 'currency'> & {
  currency: CurrencySpec;
};

export type ResolvedCurrencyFormatOptions<N extends Notation> = Omit<Decimal.DecimalFormat.ResolvedFormatOptions<N, 'currency'>, 'currency' | 'style' > & {
  currency: CurrencySpec;
};

type Value = Decimal.Value | bigint;

function toDecimal(value: Value): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value.toString());
}

// FIXME: `s/FormatPart/PartValue/` when the `PartValue` is exposed
const concatenate = <T extends Decimal.DecimalFormat.FormatPart>(filter: T[] | ((p: T) => boolean), parts: T[] = []) => {
    if (typeof filter === "function") {
        parts = parts.filter(filter);
    } else {
        parts = filter;
    }
    return parts.map(p => p.value).join("");
};

const pow10 = (exponent: Decimal.Value) => Decimal.pow(10, exponent);

// We will try to follow the API of the Decimal.DecimalFormat class
// but do not inherit from it directly as we actually internally
// use two different DecimalFormat instances depending on the value
// being formatted (main currency a unit or sub-unit).
export class CurrencyFormat<N extends Notation> {
  // Format is a property not a method
  declare readonly format: (value: Decimal.Value | bigint) => string;
  declare readonly formatToParts: (value: Decimal.Value | bigint) => Decimal.DecimalFormat.FormatPart[];

  private readonly code: CurrencyCode;
  private readonly symbol?: string;
  private readonly valueInUnit: 'currency' | 'subunit' = 'currency';
  private readonly formatter: Decimal.DecimalFormat<N, "currency">;

  // This should be probably groupped and then all the sub-fields made required
  private readonly subunitCode?: SubunitCode;
  private readonly subunitName?: string;
  private readonly subunitFormatter?: Decimal.DecimalFormat<N, "currency">;
  private readonly absoluteSubunitThreshold?: Decimal;
  private readonly subunitExponent?: bigint;

  constructor(locales: Locale | Locale[], options: CurrencyFormatOptions<N>) {
    // In formatting we use all the time the baseline currency code
    const currencySpec: CurrencySpec = options.currency;
    const code = (() => {
      if (typeof currencySpec === 'string') {
        return currencySpec;
      }
      return currencySpec.code;
    })();

    this.code = code;
    if (this.code in currencySymbols) {
      this.symbol = currencySymbols[this.code];
    }
    // Our main strategy is:
    // * If we have a custom symbol:
    //    * If will use EUR for the reference formatting
    //    * USD/$ is not chosen because in some locales the symbol is not used due to ambiguity.
    //    * Then we will relace the `€` or `EUR` with our own symbol or code as needed
    // * If we do not have a custom symbol:
    //   * We will use the actual currency code for formatting and no replacement will be needed
    const internalOptions: Decimal.DecimalFormat.FormatOptions<N, "currency"> = {
      ...options,
      style: 'currency',
      currency: this.symbol?'EUR':this.code,
    };
    this.formatter = new Decimal.DecimalFormat<N, "currency">(locales, internalOptions);

    // Our subunit strategy is:
    //
    this.subunitCode = (() => {
      if (typeof currencySpec === 'object' && currencySpec.code === 'BTC') {
        return 'SAT';
      } else if (typeof currencySpec === 'object' && currencySpec.code === 'ADA') {
        return 'LOV';
      }
    })();
    this.subunitFormatter = (() => {
      if (this.subunitCode) {
        // subunits are formatted differently the `sat` or `lovelace` is name not symbol really
        return new Decimal.DecimalFormat<N, "currency">(locales, {
          ...internalOptions,
          currencyDisplay: 'name',
          currency: this.subunitCode as Currency,
          minimumFractionDigits: 0,
        });
      }
    })();
    this.subunitExponent = (() => {
      if (this.subunitCode) {
        return unitExponents[this.subunitCode];
      }
    })();

    this.absoluteSubunitThreshold = (() => {
      if (typeof currencySpec === 'object' && currencySpec.code === 'BTC' && currencySpec.satDisplayThreshold) {
        const multiplier = pow10(this.subunitExponent!.toString());
        return currencySpec.satDisplayThreshold.mul(multiplier).truncated();
      } else if (typeof currencySpec === 'object' && currencySpec.code === 'ADA' && currencySpec.lovelaceDisplayThreshold) {
        const multiplier = pow10(this.subunitExponent!.toString());
        return currencySpec.lovelaceDisplayThreshold.mul(multiplier).truncated();
      }
    })();

    this.valueInUnit = (() => {
      if (typeof currencySpec === 'object'
          && ((currencySpec.code === 'BTC' && currencySpec.unit === 'sat')
              || (currencySpec.code === 'ADA' && currencySpec.unit === 'lovelace'))) {
        return 'subunit';
      }
      return 'currency';
    })();

    if (this.subunitCode && this.subunitCode in subunitNames) {
      this.subunitName = subunitNames[this.subunitCode];
    }

    this.formatToParts = (value: bigint | Decimal.Value): Decimal.DecimalFormat.FormatPart[] => {
      const currecyFormatToParts = (amount: Decimal.Value) => {
        const parts = this.formatter.formatToParts(amount);
        if(this.symbol) {
          return parts.map(part => {
            if (part.type === 'currency') {
              return {
                ...part,
                value: part.value.replace("EUR", this.code).replace("€", this.symbol!),
              };
            }
            return part;
          });
        }
        return parts;
      };
      const inputAmount = toDecimal(value);
      if(!this.subunitCode) {
        return currecyFormatToParts(inputAmount);
      }
      const multiplier = pow10(this.subunitExponent!.toString());
      const subunitAmount =
        this.valueInUnit === 'subunit'?inputAmount:inputAmount.mul(multiplier);
      // // Please note that this all the time uses the main currency as a placeholder
      // let formatted = currencyFormat(amount);
      if(this.absoluteSubunitThreshold && subunitAmount.lte(this.absoluteSubunitThreshold)) {
        const parts = this.subunitFormatter!.formatToParts(subunitAmount);
        return parts.map(part => {
          if (part.type === 'currency') {
            return {
              ...part,
              value: part.value.replace(this.subunitCode!, this.subunitName || this.subunitCode!),
            };
          }
          return part;
        });
      }
      const currencyAmount =
        this.valueInUnit === 'subunit'?inputAmount.div(multiplier):inputAmount;
      return currecyFormatToParts(currencyAmount);
    };

    this.format = (value: bigint | Decimal.Value): string => {
      const parts = this.formatToParts(value);
      return concatenate(parts);
    }
  }
}
