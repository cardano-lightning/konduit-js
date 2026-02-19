import type { Tagged } from "type-fest";
import { Result, err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import { json2BigIntCodec } from "@konduit/codec/json/codecs";
import type { JsonError, JsonCodec } from "@konduit/codec/json/codecs";
import type { Json } from "@konduit/codec/json";
import { json2IntCodec, type Int, type NonNegativeInt, type OneToNine, type Small, type ZeroToNine } from "@konduit/codec/integers/smallish";
import type { NonNegativeBigInt } from "@konduit/codec/integers/big";

// Lovelace upper limit is above the safe integer range
export const ADA_TOTAL_SUPPLY = 45_000_000_000n; // 11 digits
export const LOVELACE_TOTAL_SUPPLY = 45_000_000_000_000_000n; // 17 digits

// This represents positive Lovelace value. We can introduce `LovelaceAmount` if we want to enforce non-negativity.
export type Lovelace = Tagged<NonNegativeBigInt, "Lovelace">;
export namespace Lovelace {
  export const fromBigInt = (v: bigint): Result<Lovelace, JsonError> => bigInt2LovelaceCodec.deserialise(v);
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine, n10?: ZeroToNine, n11?: ZeroToNine, n12?: ZeroToNine, n13?: ZeroToNine, n14?: ZeroToNine, n15?: ZeroToNine, n16?: ZeroToNine): Lovelace => {
    let digits = [n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13, n14, n15, n16].filter((d): d is ZeroToNine => d !== undefined);
    let value = BigInt(n1);
    for (let digit of digits) {
      value = value * 10n + BigInt(digit);
    }
    return value as Lovelace;
  }
  export const fromSmallNumber = (v: Small): Lovelace => BigInt(v) as Lovelace;
  export const fromJson = (v: Json) => json2LovelaceCodec.deserialise(v);
  export const zero = 0n as Lovelace;
  export const add = (a: Lovelace, b: Lovelace): Result<Lovelace, JsonError> => fromBigInt(a + b);
  export const subtract = (a: Lovelace, b: Lovelace): Result<Lovelace, JsonError> => fromBigInt(a - b);
  export const subtractAbs = (a: Lovelace, b: Lovelace): Result<Lovelace, JsonError> => a >= b ? fromBigInt(a - b) : fromBigInt(b - a);
  export const scale = (a: Lovelace, multiplier: bigint): Result<Lovelace, JsonError> => fromBigInt(a * multiplier);
}
export const bigInt2LovelaceCodec: codec.Codec<bigint, Lovelace, JsonError> = {
  deserialise: (value: bigint): Result<Lovelace, JsonError> => {
    if (value > LOVELACE_TOTAL_SUPPLY) {
      return err(`Lovelace must be less than or equal to total supply (${LOVELACE_TOTAL_SUPPLY}), got ${value}`);
    }
    if (value < 0) {
      return err(`Lovelace must be non-negative, got ${value}`);
    }
    return ok(value as Lovelace);
  },
  serialise: (value: Lovelace): bigint => value as bigint
}
export const json2LovelaceCodec: JsonCodec<Lovelace> = codec.pipe(json2BigIntCodec, bigInt2LovelaceCodec);

export type Ada = Tagged<NonNegativeInt, "Ada">;
export namespace Ada {
  export const fromSmallNumber = (v: Small): Ada => v as Ada;
  // This is safe constructor which you can use to create amount up to: 9_999_999_999 (10 digits) which is below total supply.
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine, n10?: ZeroToNine): Ada => {
    let digits = [n2, n3, n4, n5, n6, n7, n8, n9, n10].filter((d): d is ZeroToNine => d !== undefined);
    let value = n1;
    for (let digit of digits) {
      value = value * 10 + digit;
    }
    return value as Ada;
  }
  export const fromLovelaceFloor = (lovelace: Lovelace): Ada => {
    const adaValue = Math.floor(Number((lovelace as bigint) / 1_000_000n));
    return adaValue as Ada;
  }
}

export const int2AdaCodec: codec.Codec<Int, Ada, JsonError> = {
  deserialise: (value: Int): Result<Ada, JsonError> => {
    if (value < 0) {
      return err(`Ada must be non-negative, got ${value}`);
    }
    return ok(value as Ada);
  },
  serialise: (value: Ada): Int => value as Int
}
export const json2AdaCodec: JsonCodec<Ada> = codec.pipe(json2IntCodec, int2AdaCodec);

export namespace Lovelace {
  export const fromAda = (ada: Ada): Lovelace => {
    const lovelaceValue = BigInt(ada) * 1_000_000n;
    return lovelaceValue as Lovelace;
  }
}
