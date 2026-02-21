import { err, ok } from 'neverthrow';
import { json2BigIntCodec, json2NumberThroughStringCodec, type JsonCodec, type JsonError } from '../json/codecs';
import * as codec from '../codec';
import type { Tagged } from 'type-fest';
import type { Codec } from '../codec';
import type { Json } from '../json';
import { mkOrdForScalar } from '../tagged';

// Up to 100
export type SmallPositive = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79 | 80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 | 92 | 93 | 94 | 95 | 96 | 97 | 98 | 99 | 100;
export type Small = 0 | SmallPositive;

export type Zero = 0;
export type MinusNineToMinusOne = -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1;
export type OneToNine = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ZeroToNine = Zero | OneToNine;
export type MinusNineToNine = MinusNineToMinusOne | ZeroToNine;

// 53 bit int represented as JS number.
// Number in the [-2^53 + 1, 2^53 - 1] range are contiguous.
export type Int = Tagged<number, "Int">;

export namespace Int {
  export const fromSmallNumber = (n: Small): Int => n as Int;
  export const fromDigits = (n0: MinusNineToNine, n1?: ZeroToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine): Int => {
    let digits = [n1, n2, n3, n4, n5, n6, n7, n8, n9].filter((d): d is ZeroToNine => d !== undefined);
    let sign = n0 < 0 ? -1 : 1;
    let value = (sign < 0)? -n0 : n0;
    for (let digit of digits) {
      value = value * 10 + digit;
    }
    return sign * value as Int;
  }
  export const fromNumber = (n: number) => number2IntCodec.deserialise(n);
  export const fromJson = (n: Json) => json2IntCodec.deserialise(n);
}

// BigInt versions of safe integer bounds
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);

export const number2IntCodec: Codec<number, Int, JsonError> = {
  deserialise: (value: number) => {
    if (!Number.isSafeInteger(value)) {
      return err(`Number ${value} is not a safe integer`);
    }
    return ok(value as Int);
  },
  serialise: (tagged: Int): number => tagged as number
};

export const bigInt2IntCodec: Codec<bigint, Int, JsonError> = {
  deserialise: (value: bigint) => {
    if (value > MAX_SAFE_INTEGER || value < MIN_SAFE_INTEGER) {
      return err(`BigInt value ${value} is outside safe integer range [${MIN_SAFE_INTEGER}, ${MAX_SAFE_INTEGER}]`);
    }
    return ok(Number(value) as Int);
  },
  serialise: (value: Int): bigint => BigInt(value)
};

export const json2IntCodec: JsonCodec<Int> = codec.pipe(json2BigIntCodec, bigInt2IntCodec);
export const json2IntThroughStringCodec: JsonCodec<Int> = codec.pipe(json2NumberThroughStringCodec, number2IntCodec);

// Positive integer (> 0) within safe integer range
export type PositiveInt = Tagged<Int, "PositiveInt">;
export namespace PositiveInt {
  export const fromSmallNumber = (n: SmallPositive) => n as PositiveInt;
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine): PositiveInt => {
    let digits = [n2, n3, n4, n5, n6, n7, n8, n9].filter((d): d is ZeroToNine => d !== undefined);
    let value = n1;
    for (let digit of digits) {
      value = value * 10 + digit;
    }
    return value as PositiveInt;
  }
  export const fromNumber = (n: number) => int2PositiveIntCodec.deserialise(n as Int);
  export const fromJson = (n: Json) => json2PositiveIntCodec.deserialise(n);
  export const ord = mkOrdForScalar<PositiveInt>();
}

export const int2PositiveIntCodec: Codec<Int, PositiveInt, JsonError> = {
  deserialise: (value: Int) => {
    if (value <= 0) {
      return err(`Expected positive integer, got ${value}`);
    }
    return ok(value as PositiveInt);
  },
  serialise: (tagged: PositiveInt) => tagged as Int
};

export const json2PositiveIntCodec: JsonCodec<PositiveInt> = codec.pipe(json2IntCodec, int2PositiveIntCodec);
export const json2PositiveIntThroughStringCodec: JsonCodec<PositiveInt> = codec.pipe(json2IntThroughStringCodec, int2PositiveIntCodec);

// Non-negative integer (>= 0) within safe integer range
export type NonNegativeInt = Tagged<Int, "NonNegativeInt">;
export namespace NonNegativeInt {
  export const fromSmallNumber = (n: Small) => n as NonNegativeInt;
  export const fromDigits = (n0: ZeroToNine, n1?: ZeroToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine): NonNegativeInt => {
    let digits = [n1, n2, n3, n4, n5, n6, n7, n8, n9].filter((d): d is ZeroToNine => d !== undefined);
    let value = n0;
    for (let digit of digits) {
      value = value * 10 + digit;
    }
    return value as NonNegativeInt;
  }
  export const fromNumber = (n: number) => int2NonNegativeIntCodec.deserialise(n as Int);
  export const fromAbs = (n: Int) => (n < 0 ? -n : n) as NonNegativeInt;
  export const fromJson = (n: Json) => json2NonNegativeIntCodec.deserialise(n);
  export const ord = mkOrdForScalar<NonNegativeInt>();
}

export const int2NonNegativeIntCodec: Codec<Int, NonNegativeInt, JsonError> = {
  deserialise: (value: Int) => {
    if (value < 0) {
      return err(`Expected non-negative integer, got ${value}`);
    }
    return ok(value as NonNegativeInt);
  },
  serialise: (tagged: NonNegativeInt) => tagged as Int
};

export const json2NonNegativeIntCodec: JsonCodec<NonNegativeInt> = codec.pipe(json2IntCodec, int2NonNegativeIntCodec);
export const bigInt2NonNegativeIntCodec: Codec<bigint, NonNegativeInt, JsonError> = codec.pipe(
  bigInt2IntCodec,
  int2NonNegativeIntCodec,
);
export const json2NonNegativeIntThroughStringCodec: JsonCodec<NonNegativeInt> = codec.pipe(json2IntThroughStringCodec, int2NonNegativeIntCodec);
