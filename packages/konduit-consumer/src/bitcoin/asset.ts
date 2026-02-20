import type { Tagged } from "type-fest";
import { Result, err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import { json2BigIntCodec, json2StringCodec } from "@konduit/codec/json/codecs";
import type { JsonError, JsonCodec } from "@konduit/codec/json/codecs";
import type { Json } from "@konduit/codec/json";
import { json2IntCodec, type Int, type NonNegativeInt, type OneToNine, type Small, type ZeroToNine } from "@konduit/codec/integers/smallish";
import type { NonNegativeBigInt } from "@konduit/codec/integers/big";
import { string2BigIntCodec } from "@konduit/codec/urlquery/codecs/sync";

// Bitcoin total supply is 21 million BTC = 2_100_000_000_000_000 satoshis (fits in 53-bit integer)
export const BITCOIN_TOTAL_SUPPLY = 21_000_000 as Bitcoin;
// but millisatoshis = 2_100_000_000_000_000_000 which exceeds safe integer range, so we use bigint.
export const MILLISATOSHI_TOTAL_SUPPLY = 2_100_000_000_000_000_000n;
export const SATOSHI_TOTAL_SUPPLY = 2_100_000_000_000_000n;

export type Millisatoshi = Tagged<NonNegativeBigInt, "Millisatoshi">;
export namespace Millisatoshi {
  export const fromBigInt = (v: bigint): Result<Millisatoshi, JsonError> => bigInt2MillisatoshiCodec.deserialise(v);
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine, n10?: ZeroToNine, n11?: ZeroToNine, n12?: ZeroToNine, n13?: ZeroToNine, n14?: ZeroToNine, n15?: ZeroToNine, n16?: ZeroToNine, n17?: ZeroToNine, n18?: ZeroToNine, n19?: ZeroToNine): Millisatoshi => {
    let digits = [n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13, n14, n15, n16, n17, n18, n19].filter((d): d is ZeroToNine => d !== undefined);
    let value = BigInt(n1);
    for (let digit of digits) {
      value = value * 10n + BigInt(digit);
    }
    return value as Millisatoshi;
  }
  export const fromSmallNumber = (v: Small): Millisatoshi => BigInt(v) as Millisatoshi;
  export const fromJson = (v: Json) => json2MillisatoshiCodec.deserialise(v);
  export const zero = 0n as Millisatoshi;
  export const add = (a: Millisatoshi, b: Millisatoshi): Result<Millisatoshi, JsonError> => fromBigInt(a + b);
  export const subtract = (a: Millisatoshi, b: Millisatoshi): Result<Millisatoshi, JsonError> => fromBigInt(a - b);
  export const subtractAbs = (a: Millisatoshi, b: Millisatoshi): Result<Millisatoshi, JsonError> => a >= b ? fromBigInt(a - b) : fromBigInt(b - a);
  export const scale = (a: Millisatoshi, multiplier: bigint): Result<Millisatoshi, JsonError> => fromBigInt(a * multiplier);
}
export const bigInt2MillisatoshiCodec: codec.Codec<bigint, Millisatoshi, JsonError> = {
  deserialise: (value: bigint): Result<Millisatoshi, JsonError> => {
    if (value > MILLISATOSHI_TOTAL_SUPPLY) {
      return err(`Millisatoshi must be less than or equal to total supply (${MILLISATOSHI_TOTAL_SUPPLY}), got ${value}`);
    }
    if (value < 0) {
      return err(`Millisatoshi must be non-negative, got ${value}`);
    }
    return ok(value as Millisatoshi);
  },
  serialise: (value: Millisatoshi): bigint => value as bigint
}
export const json2MillisatoshiCodec: JsonCodec<Millisatoshi> = codec.pipe(
  // A version which uses string encoding
  // json2StringCodec,
  // codec.pipe(string2BigIntCodec, bigInt2MillisatoshiCodec),
  json2BigIntCodec,
  bigInt2MillisatoshiCodec
);

// --- Satoshi (bigint-based, consistent with Millisatoshi for clean conversions) ---

export type Satoshi = Tagged<NonNegativeBigInt, "Satoshi">;
export namespace Satoshi {
  export const fromBigInt = (v: bigint): Result<Satoshi, JsonError> => bigInt2SatoshiCodec.deserialise(v);
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine, n10?: ZeroToNine, n11?: ZeroToNine, n12?: ZeroToNine, n13?: ZeroToNine, n14?: ZeroToNine, n15?: ZeroToNine, n16?: ZeroToNine): Satoshi => {
    let digits = [n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13, n14, n15, n16].filter((d): d is ZeroToNine => d !== undefined);
    let value = BigInt(n1);
    for (let digit of digits) {
      value = value * 10n + BigInt(digit);
    }
    return value as Satoshi;
  }
  export const fromSmallNumber = (v: Small): Satoshi => BigInt(v) as Satoshi;
  export const fromJson = (v: Json) => json2SatoshiCodec.deserialise(v);
  export const zero = 0n as Satoshi;
  export const add = (a: Satoshi, b: Satoshi): Result<Satoshi, JsonError> => fromBigInt(a + b);
  export const subtract = (a: Satoshi, b: Satoshi): Result<Satoshi, JsonError> => fromBigInt(a - b);
  export const subtractAbs = (a: Satoshi, b: Satoshi): Result<Satoshi, JsonError> => a >= b ? fromBigInt(a - b) : fromBigInt(b - a);
  export const scale = (a: Satoshi, multiplier: bigint): Result<Satoshi, JsonError> => fromBigInt(a * multiplier);
}
export const bigInt2SatoshiCodec: codec.Codec<bigint, Satoshi, JsonError> = {
  deserialise: (value: bigint): Result<Satoshi, JsonError> => {
    if (value > SATOSHI_TOTAL_SUPPLY) {
      return err(`Satoshi must be less than or equal to total supply (${SATOSHI_TOTAL_SUPPLY}), got ${value}`);
    }
    if (value < 0) {
      return err(`Satoshi must be non-negative, got ${value}`);
    }
    return ok(value as Satoshi);
  },
  serialise: (value: Satoshi): bigint => value as bigint
}
export const json2SatoshiCodec: JsonCodec<Satoshi> = codec.pipe(json2BigIntCodec, bigInt2SatoshiCodec);

export namespace Millisatoshi {
  export const fromSatoshi = (satoshi: Satoshi): Millisatoshi => {
    const msatValue = (satoshi as bigint) * 1_000n;
    return msatValue as Millisatoshi;
  }
}

// --- Bitcoin (smallish int-based, max ~21 million fits easily in 53 bits) ---

export type Bitcoin = Tagged<NonNegativeInt, "Bitcoin">;
export namespace Bitcoin {
  export const fromSmallNumber = (v: Small): Bitcoin => v as Bitcoin;

  // You can create amounts up to 9,999,999 with this safe constructor
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine): Bitcoin => {
    let digits = [n2, n3, n4, n5, n6, n7].filter((d): d is ZeroToNine => d !== undefined);
    let value = n1;
    for (let digit of digits) {
      value = value * 10 + digit;
    }
    return value as Bitcoin;
  }
  export const fromSatoshiFloor = (satoshi: Satoshi): Bitcoin => {
    const btcValue = Math.floor(Number((satoshi as bigint) / 100_000_000n));
    return btcValue as Bitcoin;
  }
}

export const int2BitcoinCodec: codec.Codec<Int, Bitcoin, JsonError> = {
  deserialise: (value: Int): Result<Bitcoin, JsonError> => {
    if (value < 0) {
      return err(`Bitcoin must be non-negative, got ${value}`);
    }
    return ok(value as Bitcoin);
  },
  serialise: (value: Bitcoin): Int => value as Int
}
export const json2BitcoinCodec: JsonCodec<Bitcoin> = codec.pipe(json2IntCodec, int2BitcoinCodec);

export namespace Satoshi {
  export const fromBitcoin = (btc: Bitcoin): Satoshi => {
    const satoshiValue = BigInt(btc) * 100_000_000n;
    return satoshiValue as Satoshi;
  }
  export const fromMillisatoshiFloor = (msat: Millisatoshi): Satoshi => {
    const satValue = (msat as bigint) / 1_000n;
    return satValue as Satoshi;
  }
}
