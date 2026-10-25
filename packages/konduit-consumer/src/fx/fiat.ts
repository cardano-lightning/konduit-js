import { Decimal } from "decimal.js";
import type { Tagged } from "type-fest";
import { Result, err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import { json2BigIntCodec } from "@konduit/codec/json/codecs";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import type { Json } from "@konduit/codec/json";
import type { NonNegativeBigInt } from "@konduit/codec/integers/big";
import { mkOrdForScalar } from "@konduit/codec/tagged";

export type FiatUnit<UTag extends string> = Tagged<NonNegativeBigInt, UTag>;

export type FiatUnitSymbol =
  | "EuroCent"
  | "EuroMillicent"
  | "Euro"
  | "UsCent"
  | "UsMillicent"
  | "UsDollar"
  | "BritishPenny"
  | "BritishMillipenny"
  | "BritishPound"
  | "CHFCent";

export type FiatCurrencyUnit = { [K in FiatUnitSymbol]: FiatUnit<K> }[FiatUnitSymbol];

const mkFiatBigIntCodec = <UTag extends string>(
  label: UTag,
): codec.Codec<bigint, FiatUnit<UTag>, string> => ({
  deserialise: (value: bigint): Result<FiatUnit<UTag>, string> => {
    if (value < 0n) {
      return err(`${label} must be non-negative, got ${value}`);
    }
    return ok(value as FiatUnit<UTag>);
  },
  serialise: (value: FiatUnit<UTag>): bigint => value as bigint,
});

const mkFiatNamespace = <UTag extends string>(label: UTag) => {
  const bigIntCodec = mkFiatBigIntCodec(label);
  const jsonCodec: JsonCodec<FiatUnit<UTag>> = codec.pipe(
    json2BigIntCodec,
    bigIntCodec,
  );

  const fromNonNegativeBigInt = (v: NonNegativeBigInt): FiatUnit<UTag> => v as FiatUnit<UTag>;
  const fromBigInt = (v: bigint): Result<FiatUnit<UTag>, string> =>
    bigIntCodec.deserialise(v);
  const fromJson = (v: Json) => jsonCodec.deserialise(v);
  const zero = 0n as FiatUnit<UTag>;
  const add = (
    a: FiatUnit<UTag>,
    b: FiatUnit<UTag>,
  ): Result<FiatUnit<UTag>, string> => fromBigInt(a + b);
  const subtract = (
    a: FiatUnit<UTag>,
    b: FiatUnit<UTag>,
  ): Result<FiatUnit<UTag>, string> => fromBigInt(a - b);
  const subtractAbs = (a: FiatUnit<UTag>, b: FiatUnit<UTag>): FiatUnit<UTag> => (a >= b ? a - b : b - a) as FiatUnit<UTag>;
  const ord = mkOrdForScalar<FiatUnit<UTag>>();

  return {
    add,
    bigIntCodec,
    fromBigInt,
    fromJson,
    fromNonNegativeBigInt,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  };
};

export type EuroCent = FiatUnit<"EuroCent">;
export namespace EuroCent {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("EuroCent");
}

export type EuroMillicent = FiatUnit<"EuroMillicent">;
export namespace EuroMillicent {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("EuroMillicent");
}

export type Euro = FiatUnit<"Euro">;
export namespace Euro {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("Euro");
}

// TODO: Explore if we need this extra representation
// or maybe we should switch to Decimal all together
// and drop this zoo of different currency units.
export type UsDecimal = Tagged<Decimal, "UsDecimal">;
export type UsCent = FiatUnit<"UsCent">;
export namespace UsCent {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("UsCent");

  export const toDollarsDecimal = (cent: UsCent): UsDecimal => {
    const dollars = (cent as bigint) / 100n;
    const remaindercent = (cent as bigint) % 100n;
    const decimalPart = remaindercent.toString().padStart(2, "0");
    return new Decimal(`${dollars}.${decimalPart}`) as UsDecimal;
  }

  export const fromUsMillicentFloor = (millicent: UsMillicent): UsCent => (millicent as bigint / 1000n) as UsCent;
}

// One millicent is one thousandth of a cent, or 1/100,000 of a dollar
export type UsMillicent = FiatUnit<"UsMillicent">;
export namespace UsMillicent {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    zero,
  } = mkFiatNamespace("UsMillicent");
  export const fromUsCent = (cent: UsCent): UsMillicent => (cent as bigint * 1000n) as UsMillicent;
  export const toDollarsDecimal = (millicent: UsMillicent): UsDecimal => {
    const dollars = (millicent as bigint) / 100000n;
    const remainderMillicent = (millicent as bigint) % 100000n;
    const decimalPart = remainderMillicent.toString().padStart(5, "0");
    return new Decimal(`${dollars}.${decimalPart}`) as UsDecimal;
  }
  export const subtractAbs = (a: UsMillicent, b: UsMillicent): UsMillicent => (a >= b ? a - b : b - a) as UsMillicent;
}

export type UsDollar = FiatUnit<"UsDollar">;
export namespace UsDollar {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("UsDollar");
}

export type BritishPenny = FiatUnit<"BritishPenny">;
export namespace BritishPenny {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("BritishPenny");
}

export type BritishMillipenny = FiatUnit<"BritishMillipenny">;
export namespace BritishMillipenny {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("BritishMillipenny");
}

export type BritishPound = FiatUnit<"BritishPound">;
export namespace BritishPound {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("BritishPound");
}

export type CHFCent = FiatUnit<"CHFCent">;
export namespace CHFCent {
  export const {
    add,
    bigIntCodec,
    fromBigInt,
    fromNonNegativeBigInt,
    fromJson,
    jsonCodec,
    ord,
    subtract,
    subtractAbs,
    zero,
  } = mkFiatNamespace("CHFCent");
}

export type FiatSymbol =
  // | "CHF"
  | "EUR"
  | "GBP"
  | "USD";

