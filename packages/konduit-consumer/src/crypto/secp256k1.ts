import { mkTaggedUint8ArrayCodec } from "@konduit/codec/uint8Array";
import type { Tagged } from "type-fest";
import * as codec from "@konduit/codec";
import * as uint8Array from "@konduit/codec/uint8Array";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import type { Codec } from "@konduit/codec";

export type Secp256k1Signature = Tagged<Uint8Array, "Secp256k1Signature">;

export const uint8Array2Secp256k1SignatureCodec: Codec<Uint8Array, Secp256k1Signature, JsonError> = mkTaggedUint8ArrayCodec<Secp256k1Signature>("Secp256k1Signature", (arr: Uint8Array) => arr.length === 65);
export const json2Secp256k1SignatureCodec: JsonCodec<Secp256k1Signature> = codec.pipe(
  uint8Array.jsonCodec,
  uint8Array2Secp256k1SignatureCodec,
);

export type Secp256k1UncompressedPublicKey = Tagged<Uint8Array, "Secp256k1UncompressedPublicKey">;
export const uint8Array2Secp256k1UncompressedPublicKeyCodec: Codec<Uint8Array, Secp256k1UncompressedPublicKey, JsonError> = mkTaggedUint8ArrayCodec<Secp256k1UncompressedPublicKey>("Secp256k1UncompressedPublicKey", (arr: Uint8Array) => arr.length === 65 && arr[0] === 0x04);
export const json2Secp256k1UncompressedPublicKeyCodec: JsonCodec<Secp256k1UncompressedPublicKey> = codec.pipe(
  uint8Array.jsonCodec,
  uint8Array2Secp256k1UncompressedPublicKeyCodec,
);

export type Secp256k1CompressedPublicKey = Tagged<Uint8Array, "Secp256k1CompressedPublicKey">;
export const uint8Array2Secp256k1CompressedPublicKeyCodec = mkTaggedUint8ArrayCodec<Secp256k1CompressedPublicKey>("Secp256k1CompressedPublicKey", (arr: Uint8Array) => arr.length === 33 && (arr[0] === 0x02 || arr[0] === 0x03));
export const json2Secp256k1CompressedPublicKeyCodec: JsonCodec<Secp256k1CompressedPublicKey> = codec.pipe(
  uint8Array.jsonCodec,
  uint8Array2Secp256k1CompressedPublicKeyCodec,
);

export type AnySecp256k1PublicKey = Secp256k1UncompressedPublicKey | Secp256k1CompressedPublicKey;

export const isCompressedSecp256k1PublicKey = (key: AnySecp256k1PublicKey): key is Secp256k1CompressedPublicKey => {
  return key[0] === 0x02 || key[0] === 0x03;
}

export const isUncompressedSecp256k1PublicKey = (key: AnySecp256k1PublicKey): key is Secp256k1UncompressedPublicKey => {
  return key[0] === 0x04;
}

export const uint8Array2AnySecp256k1PublicKeyCodec: Codec<Uint8Array, AnySecp256k1PublicKey, JsonError> = codec.altCodecs(
  [uint8Array2Secp256k1UncompressedPublicKeyCodec, uint8Array2Secp256k1CompressedPublicKeyCodec],
  (serUncompressed, serCompressed) => (arr: AnySecp256k1PublicKey) => {
    if (isUncompressedSecp256k1PublicKey(arr)) return serUncompressed(arr);
    return serCompressed(arr);
  },
  (...errors: JsonError[]): JsonError => {
    return errors as JsonError;
  }
);
