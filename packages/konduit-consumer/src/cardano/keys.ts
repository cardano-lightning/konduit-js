// Helpers around codecs and codecs for some common types
import * as hexString from '@konduit/codec/hexString';
import { RootPrivateKey, SKey, VKey, Signature, type Ed25519Prv, type Ed25519Pub, type Ed25519XPrv } from '@konduit/cardano-keys';
import type { JsonCodec, JsonError } from '@konduit/codec/json/codecs';
import * as uint8ArrayCodec from '@konduit/codec/uint8Array';
import type { Codec } from '@konduit/codec';
import * as codec from '@konduit/codec';
import type { HexString } from '@konduit/codec/hexString';

export const mkHexString2HashCodec = <T>(name: string, length: number) => uint8ArrayCodec.mkTaggedHexStringCodec<T>(name, (arr) => arr.length == length);

export const hexString2Ed25519PubCodec: Codec<HexString, Ed25519Pub, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519Pub>(
  "Ed25519Pub",
  (arr) => arr.length === 32,
);
export const json2Ed25519PubCodec: JsonCodec<Ed25519Pub> = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519PubCodec,
);
export const json2VKeyCodec = codec.rmap(json2Ed25519PubCodec, (key) => new VKey(key), (vkey) => vkey.getKey());
export const cbor2VKeyCodec = uint8ArrayCodec.mkTaggedCborCodec<VKey>("VKey", (arr) => arr.length === 32);

export const hexString2Ed25519PrvCodec: Codec<HexString, Ed25519Prv, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519Prv>(
  "Ed25519Prv",
  (arr) => arr.length === 64,
);
export const json2Ed25519PrvCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519PrvCodec,
);
export const json2SKeyCodec = codec.rmap(json2Ed25519PrvCodec, (key) => new SKey(key), (skey) => skey.getKey());

export const hexString2Ed25519XPrvCodec: Codec<HexString, Ed25519XPrv, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519XPrv>(
  "Ed25519XPrv",
  (arr) => arr.length === 96,
);
export const json2Ed25519XPrvCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519XPrvCodec,
);
export const json2RootPrivateKeyCodec = codec.rmap(json2Ed25519XPrvCodec, (key) => new RootPrivateKey(key), (root) => root.getKey());

export const hexString2SignatureCodec: Codec<HexString, Signature, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Signature>(
  "Signature",
  (arr) => arr.length === 64,
);
export const json2SignatureCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2SignatureCodec,
);
export const cbor2SignatureCodec = uint8ArrayCodec.mkTaggedCborCodec<Signature>("Signature", (arr) => arr.length === 64);
