import Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import type { Tagged } from 'type-fest';

import type { Codec } from './codec';
import * as codec from './codec';
import type { Json } from './json';
import {
  json2StringCodec,
  type JsonCodec,
  type JsonError,
} from './json/codecs';
import { type Ord } from './tagged';
import type { OneToNine, ZeroToNine } from './integers/smallish';

type ZeroToNineOrSeparator = ZeroToNine | '.';

export const json2DecimalCodec: JsonCodec<Decimal> = codec.pipe(
  json2StringCodec, {
    deserialise: (s) => {
      try {
        return ok(new Decimal(s));
      } catch (e) {
        return err(`Invalid decimal string: ${s}`) as Result<Decimal, JsonError>;
      }
    },
    serialise: (d) => d.toString(),
  }
);

type Compare<T> = (a: T, b: T) => -1 | 0 | 1;

const decimalOrd: Ord<Decimal> = (() => {
  const compare: Compare<Decimal> = (a, b) => {
    const cmp = a.comparedTo(b); // -1, 0, 1
    if (cmp < 0) return -1;
    if (cmp > 0) return 1;
    return 0;
  };

  const areEqual = (a: Decimal, b: Decimal) => a.equals(b);
  const isLessThan = (a: Decimal, b: Decimal) => a.lt(b);
  const isLessThanOrEqual = (a: Decimal, b: Decimal) => a.lte(b);
  const isGreaterThan = (a: Decimal, b: Decimal) => a.gt(b);
  const isGreaterThanOrEqual = (a: Decimal, b: Decimal) => a.gte(b);
  const max = (a: Decimal, b: Decimal) => (a.gte(b) ? a : b);
  const min = (a: Decimal, b: Decimal) => (a.lte(b) ? a : b);

  return {
    compare,
    areEqual,
    isLessThan,
    isLessThanOrEqual,
    isGreaterThan,
    isGreaterThanOrEqual,
    max,
    min,
  };
})();

const buildDecimalStringFromDigits = (
  first: ZeroToNine,
  ...rest: ZeroToNineOrSeparator[]
): string => {
  let result = first.toString();
  let seenSeparator = false;
  for (const d of rest) {
    if (d === '.') {
      if (!seenSeparator) {
        result += '.';
        seenSeparator = true;
      }
      // ignore subsequent separators
    } else {
      result += d.toString();
    }
  }

  return result;
};


export type PositiveDecimal = Tagged<Decimal, 'PositiveDecimal'>;

export namespace PositiveDecimal {
  export const fromDecimal = (value: Decimal) => {
    if (value.lte(0)) return err(`Expected positive decimal, got ${value.toString()}`);
    return ok(value as PositiveDecimal);
  };
  export const fromNumber = (n: number) => fromDecimal(new Decimal(n));
  export const fromDigits = (
    n1: OneToNine,
    n2?: ZeroToNineOrSeparator,
    n3?: ZeroToNineOrSeparator,
    n4?: ZeroToNineOrSeparator,
    n5?: ZeroToNineOrSeparator,
    n6?: ZeroToNineOrSeparator,
    n7?: ZeroToNineOrSeparator,
    n8?: ZeroToNineOrSeparator,
    n9?: ZeroToNineOrSeparator,
    n10?: ZeroToNineOrSeparator,
  ): PositiveDecimal => {
    const digits = [n2, n3, n4, n5, n6, n7, n8, n9, n10].filter(
      (d): d is ZeroToNineOrSeparator => d !== undefined,
    );
    const s = buildDecimalStringFromDigits(n1, ...digits);
    return new Decimal(s) as PositiveDecimal;
  };
  export const fromString = (s: string) => jsonCodec.deserialise(s);
  export const fromJson = (j: Json) => jsonCodec.deserialise(j);
  export const decimalCodec: Codec<Decimal, PositiveDecimal, string> = {
    deserialise: (value: Decimal): Result<PositiveDecimal, string> => fromDecimal(value),
    serialise: (tagged: PositiveDecimal): Decimal => tagged as Decimal,
  };
  export const jsonCodec: JsonCodec<PositiveDecimal> = codec.pipe(
    json2DecimalCodec,
    decimalCodec,
  );
  export const ord: Ord<PositiveDecimal> = decimalOrd as unknown as Ord<PositiveDecimal>;
  export const one = Decimal(1) as PositiveDecimal;
  export const add = (a: PositiveDecimal, b: PositiveDecimal): PositiveDecimal =>
    a.plus(b) as PositiveDecimal;
  export const multiply = (a: PositiveDecimal, b: PositiveDecimal): PositiveDecimal =>
    a.times(b) as PositiveDecimal;
  export const divide = (a: PositiveDecimal, b: PositiveDecimal): Result<PositiveDecimal, string> => {
    if(b.isZero()) return err('Cannot divide by zero');
    const c = a.dividedBy(b);
    if(c.isZero()) return err('Result is zero, expected positive decimal');
    return ok(c as PositiveDecimal);
  }
}

export type NonNegativeDecimal = Tagged<Decimal, 'NonNegativeDecimal'>;

export namespace NonNegativeDecimal {
  export const fromDecimal = (value: Decimal) => {
    if (value.lt(0)) return err(`Expected non-negative decimal, got ${value.toString()}`);
    return ok(value as NonNegativeDecimal);
  };
  export const fromNumber = (n: number) => fromDecimal(new Decimal(n));
  export const fromDigits = (
    n0: ZeroToNine,
    n1?: ZeroToNineOrSeparator,
    n2?: ZeroToNineOrSeparator,
    n3?: ZeroToNineOrSeparator,
    n4?: ZeroToNineOrSeparator,
    n5?: ZeroToNineOrSeparator,
    n6?: ZeroToNineOrSeparator,
    n7?: ZeroToNineOrSeparator,
    n8?: ZeroToNineOrSeparator,
    n9?: ZeroToNineOrSeparator,
  ): NonNegativeDecimal => {
    const digits = [n1, n2, n3, n4, n5, n6, n7, n8, n9].filter(
      (d): d is ZeroToNineOrSeparator => d !== undefined,
    );
    const s = buildDecimalStringFromDigits(n0, ...digits);
    return new Decimal(s) as NonNegativeDecimal;
  };

  export const fromString = (s: string) => jsonCodec.deserialise(s);
  export const fromJson = (j: Json) => jsonCodec.deserialise(j);
  export const fromAbs = (value: Decimal) =>
    (value.isNeg() ? value.negated() : value) as NonNegativeDecimal;
  export const decimalCodec: Codec<Decimal, NonNegativeDecimal, string> = {
    deserialise: (value: Decimal): Result<NonNegativeDecimal, string> => fromDecimal(value),
    serialise: (tagged: NonNegativeDecimal): Decimal => tagged as Decimal,
  };
  export const jsonCodec: JsonCodec<NonNegativeDecimal> = codec.pipe(
    json2DecimalCodec,
    decimalCodec,
  );
  export const ord: Ord<NonNegativeDecimal> = decimalOrd as unknown as Ord<NonNegativeDecimal>;
  export const zero = Decimal(0) as NonNegativeDecimal;
  export const one = Decimal(1) as NonNegativeDecimal;
  export const add = (a: NonNegativeDecimal, b: NonNegativeDecimal): NonNegativeDecimal =>
    a.plus(b) as NonNegativeDecimal;
  export const multiply = (a: NonNegativeDecimal, b: NonNegativeDecimal): NonNegativeDecimal =>
    a.times(b) as NonNegativeDecimal;
  export const divide = (a: NonNegativeDecimal, b: NonNegativeDecimal): Result<NonNegativeDecimal, string> => {
    if(b.isZero()) return err('Cannot divide by zero');
    return ok(a.dividedBy(b) as NonNegativeDecimal);
  }
  export const distance = (a: NonNegativeDecimal, b: NonNegativeDecimal): NonNegativeDecimal =>
    a.minus(b).abs() as NonNegativeDecimal;
}
