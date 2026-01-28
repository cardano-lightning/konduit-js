import type { Tagged } from "type-fest";
import { sha256 } from "@noble/hashes/sha2.js";
export * from "./cardano/addressses";
import { Result, err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import { json2BigIntCodec } from "@konduit/codec/json/codecs";
import type { JsonError, JsonCodec } from "@konduit/codec/json/codecs";
import { mkHexString2HashCodec } from "./cardano/codecs";
import type { HexString } from "@konduit/codec/hexString";
import * as hexString from "@konduit/codec/hexString";
import type { Json } from "@konduit/codec/json";
import type { Small } from "@konduit/codec/integers/smallish";

// Lovelace upper limit is above the safe integer range
export const LOVELACE_TOTAL_SUPPLY = 45_000_000_000_000_000n;

export type Lovelace = Tagged<bigint, "Lovelace">;
export namespace Lovelace {
  export const fromBigInt = (v: bigint): Result<Lovelace, JsonError> => bigInt2LovelaceCodec.deserialise(v);
  export const fromSmallNumber = (v: Small): Lovelace => BigInt(v) as Lovelace;
  export const fromJson = (v: Json) => json2LovelaceCodec.deserialise(v);
}
export const bigInt2LovelaceCodec: codec.Codec<bigint, Lovelace, JsonError> = {
  deserialise: (value: bigint): Result<Lovelace, JsonError> => {
    if (value > LOVELACE_TOTAL_SUPPLY) {
      return err(`Lovelace must be less than or equal to total supply (${LOVELACE_TOTAL_SUPPLY}), got ${value}`);
    }
    return ok(value as Lovelace);
  },
  serialise: (value: Lovelace): bigint => value as bigint
}
export const json2LovelaceCodec: JsonCodec<Lovelace> = codec.pipe(json2BigIntCodec, bigInt2LovelaceCodec);

export const TX_HASH_LEN = 32;
export type TxHash = Tagged<Uint8Array, "TxHash">;
export type TxId = TxHash;
export namespace TxHash {
  export const fromHexString = (hexString: HexString) => hexString2TxHashCodec.deserialise(hexString);
  export const fromBytes = (bytes: Uint8Array) => {
    if (bytes.length !== TX_HASH_LEN) {
      return err(`TxHash must be ${TX_HASH_LEN} bytes, got ${bytes.length} bytes`);
    }
    return ok(bytes as TxHash);
  }
  export const fromTxBodyCbor = (txBodyCbor: TxBodyCbor) => sha256(txBodyCbor) as TxHash;
  export const fromJson = (json: Json) => json2TxHashCodec.deserialise(json);
}
export const hexString2TxHashCodec = mkHexString2HashCodec<TxHash>("TxHash", TX_HASH_LEN);
export const json2TxHashCodec = codec.pipe(hexString.jsonCodec, hexString2TxHashCodec);

// We do not provide validation for TxCbor and TxBodyCbor here. Please use it when you can trust the source of the CBOR.
export type TxCbor = Tagged<Uint8Array, "TxCbor">;
export const unsafeTxCbor = (cbor: Uint8Array): TxCbor => cbor as TxCbor;

export type TxBodyCbor = Tagged<Uint8Array, "TxBodyCbor">;
export const unsafeTxBodyCbor = (cbor: Uint8Array): TxBodyCbor => cbor as TxBodyCbor;

