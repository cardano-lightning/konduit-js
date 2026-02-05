import type * as typeFest from "type-fest";
import { sha256 } from "@noble/hashes/sha2.js";
export * from "./addressses";
import { err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import { mkHexString2HashCodec } from "./keys";
import type { HexString } from "@konduit/codec/hexString";
import * as hexString from "@konduit/codec/hexString";
import type { Json } from "@konduit/codec/json";

export const TX_HASH_LEN = 32;
export type TxHash = typeFest.Tagged<Uint8Array, "TxHash">;
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
export type TxCbor = typeFest.Tagged<Uint8Array, "TxCbor">;
export const unsafeTxCbor = (cbor: Uint8Array): TxCbor => cbor as TxCbor;

export type TxBodyCbor = typeFest.Tagged<Uint8Array, "TxBodyCbor">;
export const unsafeTxBodyCbor = (cbor: Uint8Array): TxBodyCbor => cbor as TxBodyCbor;

