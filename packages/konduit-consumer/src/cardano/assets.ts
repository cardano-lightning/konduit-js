import type { Tagged } from "type-fest";
import { Result, err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import * as hexString from "@konduit/codec/hexString";
import * as uint8Array from "@konduit/codec/uint8Array";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as cborCodecs from "@konduit/codec/cbor/codecs/sync";
import { json2BigIntCodec } from "@konduit/codec/json/codecs";
import type { JsonError, JsonCodec } from "@konduit/codec/json/codecs";
import type { Json } from "@konduit/codec/json";
import { json2IntCodec, NonNegativeInt, type Int, type OneToNine, type Small, type ZeroToNine } from "@konduit/codec/integers/smallish";
import { cbor2PositiveBigIntCodec, json2PositiveBigIntCodec, type NonNegativeBigInt, type PositiveBigInt } from "@konduit/codec/integers/big";
import { mkOrdForScalar, mkOrdForTuple, mkOrdForUint8Array, type Ord } from "@konduit/codec/tagged";
import { altCborCodecs, cbor2IntCodec, mkTaggedBytesCborCodec, type CborCodec } from "@konduit/codec/cbor/codecs/sync";
import { ScriptHash } from "./addressses";
import type { HexString } from "@konduit/codec/hexString";
import type { Codec } from "@konduit/codec";
import type { Cbor } from "@konduit/codec/cbor/core";
import { Decimal } from "decimal.js";
import type { NonNegativeDecimal } from "@konduit/codec/decimals";

// Lovelace upper limit is above the safe integer range
export const ADA_TOTAL_SUPPLY = 45_000_000_000n; // 11 digits
export const LOVELACE_TOTAL_SUPPLY = 45_000_000_000_000_000n; // 17 digits

// This represents positive Lovelace value. We can introduce `LovelaceAmount` if we want to enforce non-negativity.
export type Lovelace = Tagged<NonNegativeBigInt, "Lovelace">;
export namespace Lovelace {
  export const fromBigInt = (v: bigint): Result<Lovelace, string> => bigIntCodec.deserialise(v);
  export const fromDigits = (n1: OneToNine, n2?: ZeroToNine, n3?: ZeroToNine, n4?: ZeroToNine, n5?: ZeroToNine, n6?: ZeroToNine, n7?: ZeroToNine, n8?: ZeroToNine, n9?: ZeroToNine, n10?: ZeroToNine, n11?: ZeroToNine, n12?: ZeroToNine, n13?: ZeroToNine, n14?: ZeroToNine, n15?: ZeroToNine, n16?: ZeroToNine): Lovelace => {
    let digits = [n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13, n14, n15, n16].filter((d): d is ZeroToNine => d !== undefined);
    let value = BigInt(n1);
    for (let digit of digits) {
      value = value * 10n + BigInt(digit);
    }
    return value as Lovelace;
  }
  export const fromSmallNumber = (v: Small): Lovelace => BigInt(v) as Lovelace;
  export const fromJson = (v: Json) => jsonCodec.deserialise(v);
  export const zero = 0n as Lovelace;

  export const add = (...values: [Lovelace, ...Lovelace[]]): Result<Lovelace, JsonError> => {
    let sum = 0n as bigint;
    for (const v of values) {
      sum += v as bigint;
    }
    return fromBigInt(sum);
  };
  export const unsafeAdd = (...values: [Lovelace, ...Lovelace[]]): Lovelace => {
    let sum = 0n as bigint;
    for (const v of values) {
      sum += v as bigint;
    }
    return sum as Lovelace;
  }
  export const subtract = (a: Lovelace, b: Lovelace): Result<Lovelace, JsonError> => fromBigInt(a - b);
  export const subtractAbs = (a: Lovelace, b: Lovelace): Lovelace => (a >= b ? (a - b) : (b - a)) as Lovelace;
  export const scale = (a: Lovelace, multiplier: bigint): Result<Lovelace, JsonError> => fromBigInt(a * multiplier);
  export const ord = mkOrdForScalar<Lovelace>();

  export const bigIntCodec: codec.Codec<bigint, Lovelace, string> = {
    deserialise: (value: bigint): Result<Lovelace, string> => {
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
  export const jsonCodec: JsonCodec<Lovelace> = codec.pipe(json2BigIntCodec, bigIntCodec);
  export const cborCodec: CborCodec<Lovelace> = codec.pipe(cbor2IntCodec, bigIntCodec);
}

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
  export const subtractAbs = (a: Ada, b: Ada): Ada => (a >= b ? (a - b) : (b - a)) as Ada;
  export const fromLovelaceFloor = (lovelace: Lovelace): Ada => {
    const adaValue = Math.floor(Number((lovelace as bigint) / 1_000_000n));
    return adaValue as Ada;
  }

  export const intCodec: codec.Codec<Int, Ada, JsonError> = {
    deserialise: (value: Int): Result<Ada, JsonError> => {
      if (value < 0) {
        return err(`Ada must be non-negative, got ${value}`);
      }
      return ok(value as Ada);
    },
    serialise: (value: Ada): Int => value as Int
  }
  export const jsonCodec: JsonCodec<Ada> = codec.pipe(json2IntCodec, intCodec);
  export const ord = mkOrdForScalar<Ada>();
}

export namespace Lovelace {
  export const fromAda = (ada: Ada): Lovelace => {
    const lovelaceValue = BigInt(ada) * 1_000_000n;
    return lovelaceValue as Lovelace;
  }
}

// We use ledger spec naming convention so aliasing script hash
export type PolicyId = ScriptHash;
export type AssetName = Tagged<Uint8Array, "AssetName">;

export namespace AssetName {
  export const LENGTH_RANGE = [0, 32] as const;
  export const fromBytes = (bytes: Uint8Array): Result<AssetName, JsonError> => {
    if (bytes.length < AssetName.LENGTH_RANGE[0] || bytes.length > AssetName.LENGTH_RANGE[1]) {
      return err(`Invalid AssetName length: expected between ${AssetName.LENGTH_RANGE[0]} and ${AssetName.LENGTH_RANGE[1]}, got ${bytes.length}`);
    }
    return ok(bytes as AssetName);
  }
  export const fromJson = (json: Json): Result<AssetName, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<AssetName, JsonError> => cborCodec.deserialise(data);
  export const ord: Ord<AssetName> = mkOrdForUint8Array<AssetName>("length-first");

  export const hexStringCodec: codec.Codec<HexString, AssetName, JsonError> = uint8Array.mkTaggedHexStringCodec<AssetName>(
    "AssetName",
    (arr) => arr.length >= AssetName.LENGTH_RANGE[0] && arr.length <= AssetName.LENGTH_RANGE[1],
  );
  export const jsonCodec: JsonCodec<AssetName> = codec.pipe(
    hexString.jsonCodec,
    codec.rmap(hexStringCodec, (assetName) => assetName as AssetName, (assetName) => assetName)
  );
  export const cborCodec: CborCodec<AssetName> = mkTaggedBytesCborCodec<AssetName>(
    "AssetName",
    (arr) => arr.length >= AssetName.LENGTH_RANGE[0] && arr.length <= AssetName.LENGTH_RANGE[1],
  );
}


// Capped to 64 bits
export type PositiveCoin = Tagged<PositiveBigInt, "PositiveCoin">;

export namespace PositiveCoin {
  export const fromPositiveBigInt = (value: PositiveBigInt): Result<PositiveCoin, JsonError> => {
    if (value > 0xffffffffffffffffn) {
      return err(`PositiveCoin must be less than or equal to 2^64-1, got ${value}`);
    }
    return ok(value as PositiveCoin);
  }
  export const fromJson = (json: Json): Result<PositiveCoin, JsonError> => jsonCodec.deserialise(json);
  export const fromCbor = (data: Cbor): Result<PositiveCoin, JsonError> => cborCodec.deserialise(data);

  export const ord = mkOrdForScalar<PositiveCoin>();

  export const positiveBigIntCodec: Codec<PositiveBigInt, PositiveCoin, JsonError> = {
    deserialise: (value: PositiveBigInt): Result<PositiveCoin, JsonError> => PositiveCoin.fromPositiveBigInt(value),
    serialise: (value: PositiveCoin): PositiveBigInt => value as PositiveBigInt,
  };

  export const jsonCodec: JsonCodec<PositiveCoin> = codec.pipe(
    json2PositiveBigIntCodec,
    positiveBigIntCodec
  );

  export const cborCodec: CborCodec<PositiveCoin> = codec.pipe(
    cbor2PositiveBigIntCodec,
    positiveBigIntCodec
  );
}

export type AssetId = [ScriptHash, AssetName];
export namespace AssetId {
  export const fromJson = (json: Json): Result<AssetId, JsonError> => jsonCodec.deserialise(json);
  export const ord: Ord<AssetId> = (() => {
    return mkOrdForTuple(ScriptHash.ord, AssetName.ord) as Ord<AssetId>;
  })();
  export const jsonCodec: JsonCodec<AssetId> = jsonCodecs.tupleOf(ScriptHash.jsonCodec, AssetName.jsonCodec);
}

export type ValueEntry = [AssetId, PositiveCoin];
export namespace ValueEntry {
  export const ord: Ord<ValueEntry> = mkOrdForTuple(AssetId.ord, PositiveCoin.ord) as Ord<ValueEntry>;
}

export class Value {
  public readonly lovelace: Lovelace;
  // Sorted list with unique asset IDs.
  public readonly assets: [AssetId, PositiveCoin][]

  private constructor(
    lovelace: Lovelace,
    assets: ValueEntry[]
  ) {
    this.lovelace = lovelace;
    this.assets = assets;
  }

  public static load(
    lovelace: Lovelace,
    assets: [AssetId, PositiveCoin][]
  ): Result<Value, string> {
    const sortedAssets = assets.sort(ValueEntry.ord.compare);
    const assetsIds = sortedAssets.map(([assetId, _]) => assetId);
    const hasDuplicates = assetsIds.some((assetId, index) => index > 0 && AssetId.ord.areEqual(assetId, assetsIds[index - 1]!));
    if (hasDuplicates) {
      return err("Duplicate asset IDs are not allowed in Value");
    }
    return ok(new Value(lovelace, sortedAssets));
  }

  public static jsonCodec: JsonCodec<Value> = codec.pipe(
    jsonCodecs.objectOf({
      lovelace: Lovelace.jsonCodec,
      assets: jsonCodecs.arrayOf(
        jsonCodecs.tupleOf(
          AssetId.jsonCodec,
          PositiveCoin.jsonCodec
        )
      )
    }), {
      deserialise: (obj) => Value.load(obj.lovelace, obj.assets),
      serialise: (value: Value) => ({
        lovelace: value.lovelace,
        assets: value.assets
      })
    }
  );

  // We use ledger CBOR encoding format:
  //
  // ```cddl
  // value = coin/ [coin, multiasset<positive_coin>]
  // coin = uint
  // multiasset<a0> = {* policy_id => {+ asset_name => a0}}
  // script_hash = hash28
  // hash28 = bytes .size 28
  // positive_coin = 1 .. max_word64
  // max_word64 = 18446744073709551615
  // policy_id = script_hash
  // asset_name = bytes .size (0 .. 32)/
  // ```
  public static cborCodec: CborCodec<Value> = (() => {
    const cbor2AssetCodec: CborCodec<Map<AssetName, PositiveCoin>> = cborCodecs.homogeneousMapOf(
      cborCodecs.definiteLength,
      AssetName.cborCodec,
      PositiveCoin.cborCodec
    );
    const cbor2MultiAssetCodec: CborCodec<Map<PolicyId, Map<AssetName, PositiveCoin>>> = cborCodecs.homogeneousMapOf(
      cborCodecs.definiteLength,
      ScriptHash.cborCodec,
      cbor2AssetCodec
    );
    return codec.pipe(
      altCborCodecs(
        [ Lovelace.cborCodec, cborCodecs.tupleOf(cborCodecs.definiteLength, Lovelace.cborCodec, cbor2MultiAssetCodec) ],
        (serLovelace, serMultiAsset) => (val: Lovelace | [Lovelace, Map<PolicyId, Map<AssetName, PositiveCoin>>]) => {
          if (typeof val === "bigint") {
            return serLovelace(val);
          }
          return serMultiAsset(val);
        }
      ), {
        deserialise: (val) => {
          if (typeof val === "bigint") {
            return Value.load(val, []);
          }
          const [lovelace, multiAsset] = val;
          const assets: [AssetId, PositiveCoin][] = [];
          for (const [policyId, assetMap] of multiAsset.entries()) {
            for (const [assetName, amount] of assetMap.entries()) {
              assets.push([[policyId, assetName], amount]);
            }
          }
          return Value.load(lovelace, assets);
        },
        serialise: (value: Value) => {
          if (value.assets.length === 0) {
            return value.lovelace;
          }
          const multiAsset = new Map<PolicyId, Map<AssetName, PositiveCoin>>();
          for (const [[policyId, assetName], amount] of value.assets) {
            let assetMap = multiAsset.get(policyId);
            if (!assetMap) {
              assetMap = new Map<AssetName, PositiveCoin>();
              multiAsset.set(policyId, assetMap);
            }
            assetMap.set(assetName, amount);
          }
          return [value.lovelace, multiAsset] as [Lovelace, Map<PolicyId, Map<AssetName, PositiveCoin>>];
        }
      }
    );
  })();

  public static cborThroughHexCodec = codec.pipe(cborCodecs.string2CborCodec, Value.cborCodec);

}
// Should not be used for bookkeeping but for intermediary calculation.
export type AdaDecimal = Tagged<NonNegativeDecimal, "AdaDecimal">;
export namespace AdaDecimal {
  export const fromNonNegativeDecimal = (v: NonNegativeDecimal): AdaDecimal => v as AdaDecimal;
  export const fromAda = (ada: Ada): AdaDecimal => new Decimal(ada) as AdaDecimal;
  export const fromLovelace = (lovelace: Lovelace): AdaDecimal => new Decimal(lovelace).div(1_000_000) as AdaDecimal;

  // Scale a decimal Ada value, enforcing total supply (45B ADA) as an upper bound.
  export const scale = (adaDecimal: AdaDecimal, multiplier: NonNegativeDecimal): Result<AdaDecimal, string> => {
    const scaled = (adaDecimal as Decimal).mul(multiplier);
    if (scaled.gt(ADA_TOTAL_SUPPLY)) {
      return err(`Ada amount must be less than or equal to total supply (${ADA_TOTAL_SUPPLY}), got ${scaled.toString()}`);
    }
    return ok(scaled as AdaDecimal);
  };
}

export namespace Lovelace {
  export const fromAdaDecimalFloor = (adaDecimal: AdaDecimal): Lovelace => {
    const lovelaceValueStr = (adaDecimal as Decimal).mul(1_000_000).floor().toString();
    return BigInt(lovelaceValueStr) as Lovelace;
  };
}

export namespace Ada {
  export const fromAdaDecimalFloor = (adaDecimal: AdaDecimal): Ada => {
    const adaValue = (adaDecimal as Decimal).floor().toNumber();
    return adaValue as Ada;
  };
}
