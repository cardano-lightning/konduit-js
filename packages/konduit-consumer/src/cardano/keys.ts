// Helpers around codecs and codecs for some common types
import * as hexString from '@konduit/codec/hexString';
import { Ed25519RootPrivateKey, Ed25519SigningKey, Ed25519VerificationKey } from '@konduit/cardano-keys';
import type { Ed25519Signature, Ed25519PublicKey } from '@konduit/cardano-keys';
import type { Ed25519XPrv } from '@konduit/cardano-keys/bip32Ed25519';
import type { JsonCodec, JsonError } from '@konduit/codec/json/codecs';
import * as uint8ArrayCodec from '@konduit/codec/uint8Array';
import type { Codec } from '@konduit/codec';
import * as codec from '@konduit/codec';
import type { HexString } from '@konduit/codec/hexString';
import { Ed25519ExpandedSecret, Ed25519PrivateKey, Ed25519Secret } from '@konduit/cardano-keys/rfc8032';
import { mkTaggedCborCodec } from '@konduit/codec/cbor/codecs/sync';

export const mkHexString2HashCodec = <T>(name: string, length: number) => uint8ArrayCodec.mkTaggedHexStringCodec<T>(name, (arr) => arr.length == length);

export const hexString2Ed25519PublicKeyCodec: Codec<HexString, Ed25519PublicKey, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519PublicKey>(
  "Ed25519PublicKey",
  (arr) => arr.length === Ed25519VerificationKey.LENGTH,
);
export const json2Ed25519PublicKeyCodec: JsonCodec<Ed25519PublicKey> = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519PublicKeyCodec,
);
export const json2Ed25519VerificationKeyCodec = codec.rmap(json2Ed25519PublicKeyCodec, (key) => new Ed25519VerificationKey(key), (vkey) => vkey.key);
export const cbor2Ed25519VerificationKeyCodec = mkTaggedCborCodec<Ed25519VerificationKey>("Ed25519VerificationKey", (arr) => arr.length === 32);

export const hexString2Ed25519SignatureCodec: Codec<HexString, Ed25519Signature, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519Signature>(
  "Ed25519Signature",
  (arr) => arr.length === 64,
);
export const json2Ed25519SignatureCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519SignatureCodec,
);
export const cbor2Ed25519SignatureCodec = mkTaggedCborCodec<Ed25519Signature>("Ed25519Signature", (arr) => arr.length === 64);

// Hierarchical keys

export const hexString2Ed25519ExpandedSecretCodec: Codec<HexString, Ed25519ExpandedSecret, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519ExpandedSecret>(
  "Ed25519ExpandedSecret",
  (arr) => arr.length === Ed25519SigningKey.LENGTH,
);
export const json2Ed25519ExpandedSecretCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519ExpandedSecretCodec,
);
export const json2Ed25519SigningKeyCodec = codec.rmap(json2Ed25519ExpandedSecretCodec, (key) => new Ed25519SigningKey(key), (skey) => skey.key);

export const hexString2Ed25519XPrvCodec: Codec<HexString, Ed25519XPrv, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519XPrv>(
  "Ed25519XPrv",
  (arr) => arr.length === 96,
);
export const json2Ed25519XPrvCodec = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519XPrvCodec,
);
export const json2Ed25519RootPrivateKeyCodec = codec.rmap(json2Ed25519XPrvCodec, (key) => new Ed25519RootPrivateKey(key), (root) => root.root);

// Non-hierarchical keys

export const json2Ed25519SecretCodec = uint8ArrayCodec.mkTaggedJsonCodec<Ed25519Secret>(
  "Ed25519Secret",
  (arr) => arr.length === 32,
);

export const json2Ed25519PrivateKeyCodec: JsonCodec<Ed25519PrivateKey> = codec.rmap(json2Ed25519SecretCodec, (key) => new Ed25519PrivateKey(key), (skey) => skey.secret);


