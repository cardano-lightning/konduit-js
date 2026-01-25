import { err, ok, type Result } from 'neverthrow';
import type { JsonCodec, JsonError } from '../json/codecs';
import { json2BigIntCodec } from '../json/codecs';
import type { Tagged } from 'type-fest';
import type { Codec } from '../codec';
import * as codec from '../codec';
import type { Small, SmallPositive, ZeroToNine, OneToNine } from './smallish';
import type { Json } from '../json';

// Positive BigInt (> 0n)
export type PositiveBigInt = Tagged<bigint, "PositiveBigInt">;
export namespace PositiveBigInt {
  export const fromSmallNumber = (n: SmallPositive) => BigInt(n) as PositiveBigInt;
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine, n10?: ZeroToNine, n11?: ZeroToNine, n12?: ZeroToNine, n13?: ZeroToNine, n14?: ZeroToNine, n15?: ZeroToNine, n16?: ZeroToNine, n17?: ZeroToNine, n18?: ZeroToNine, n19?: ZeroToNine): PositiveBigInt => {
    let digits = [n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13, n14, n15, n16, n17, n18, n19].filter((d): d is ZeroToNine => d !== undefined);
    let value = BigInt(n1);
    for (let digit of digits) {
      value = value * 10n + BigInt(digit);
    }
    return value as PositiveBigInt;
  }
  export const fromBigInt = (n: bigint) => bigInt2PositiveBigIntCodec.deserialise(n);
  export const fromJson = (n: Json) => json2PositiveBigIntCodec.deserialise(n);
}

export const bigInt2PositiveBigIntCodec: Codec<bigint, PositiveBigInt, JsonError> = {
  deserialise: (value: bigint): Result<PositiveBigInt, JsonError> => {
    if (value <= 0n) {
      return err(`Expected positive bigint, got ${value}`);
    }
    return ok(value as PositiveBigInt);
  },
  serialise: (tagged: PositiveBigInt): bigint => tagged as bigint
}

export const json2PositiveBigIntCodec: JsonCodec<PositiveBigInt> = codec.pipe(json2BigIntCodec, bigInt2PositiveBigIntCodec);

// Non-negative BigInt (>= 0n)
export type NonNegativeBigInt = Tagged<bigint, "NonNegativeBigInt">;
export namespace NonNegativeBigInt {
  export const fromSmallNumber = (n: Small) => BigInt(n) as NonNegativeBigInt;
  export const fromDigits = (n0: ZeroToNine, n1?: ZeroToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine, n10?: ZeroToNine, n11?: ZeroToNine, n12?: ZeroToNine, n13?: ZeroToNine, n14?: ZeroToNine, n15?: ZeroToNine, n16?: ZeroToNine, n17?: ZeroToNine, n18?: ZeroToNine, n19?: ZeroToNine): NonNegativeBigInt => {
    let digits = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13, n14, n15, n16, n17, n18, n19].filter((d): d is ZeroToNine => d !== undefined);
    let value = BigInt(n0);
    for (let digit of digits) {
      value = value * 10n + BigInt(digit);
    }
    return value as NonNegativeBigInt;
  }
  export const fromBigInt = (n: bigint) => bigInt2NonNegativeBigIntCodec.deserialise(n);
  export const fromAbs = (n: bigint) => (n < 0n ? -n : n) as PositiveBigInt;
  export const fromJson = (n: Json) => json2NonNegativeBigIntCodec.deserialise(n);
}

export const bigInt2NonNegativeBigIntCodec: Codec<bigint, NonNegativeBigInt, JsonError> = {
  deserialise: (value: bigint): Result<NonNegativeBigInt, JsonError> => {
    if (value < 0n) {
      return err(`Expected non-negative bigint, got ${value}`);
    }
    return ok(value as NonNegativeBigInt);
  },
  serialise: (tagged: NonNegativeBigInt): bigint => tagged as bigint
}

export const json2NonNegativeBigIntCodec: JsonCodec<NonNegativeBigInt> = codec.pipe(json2BigIntCodec, bigInt2NonNegativeBigIntCodec);
