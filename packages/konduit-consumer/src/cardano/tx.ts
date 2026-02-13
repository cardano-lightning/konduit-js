import type * as typeFest from "type-fest";
import { sha256 } from "@noble/hashes/sha2.js";
export * from "./addressses";
import { err, ok } from "neverthrow";
import * as codec from "@konduit/codec";
import { mkHexString2HashCodec } from "./keys";
import type { HexString } from "@konduit/codec/hexString";
import * as hexString from "@konduit/codec/hexString";
import type { Json } from "@konduit/codec/json";
import { TransactionReadyForSigning } from "../../wasm/konduit_wasm";

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
  export const fromTxBodyCborBytes = (txBodyCbor: TxBodyCborBytes) => sha256(txBodyCbor) as TxHash;
  export const fromJson = (json: Json) => json2TxHashCodec.deserialise(json);
}
export const hexString2TxHashCodec = mkHexString2HashCodec<TxHash>("TxHash", TX_HASH_LEN);
export const json2TxHashCodec = codec.pipe(hexString.jsonCodec, hexString2TxHashCodec);

// We do not provide validation for TxCborBytes and TxBodyCborBytes here. Please use it when you can trust the source of the CBOR.
export type TxCborBytes = typeFest.Tagged<Uint8Array, "TxCborBytes">;
export namespace TxCborBytes {
  export const fromTxReadyForSigning = (txReadyForSigning: TransactionReadyForSigning) => txReadyForSigning.toCbor() as TxCborBytes;
}
export const unsafeTxCborBytes = (cbor: Uint8Array): TxCborBytes => cbor as TxCborBytes;

export type TxBodyCborBytes = typeFest.Tagged<Uint8Array, "TxBodyCborBytes">;
export const unsafeTxBodyCborBytes = (cbor: Uint8Array): TxBodyCborBytes => cbor as TxBodyCborBytes;

