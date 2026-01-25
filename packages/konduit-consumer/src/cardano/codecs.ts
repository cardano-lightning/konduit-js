// Helpers around codecs and codecs for some common types
import * as hexString from '@konduit/codec/hexString';
import { VKey, type Ed25519Pub } from '@konduit/cardano-keys';
import type { JsonCodec, JsonError } from '@konduit/codec/json/codecs';
import * as uint8ArrayCodec from '@konduit/codec/uint8Array';
import type { Codec } from '@konduit/codec';
import * as codec from '@konduit/codec';
import type { HexString } from '@konduit/codec/hexString';

export const mkHexString2HashCodec = <T>(name: string, length: number) => uint8ArrayCodec.mkTaggedHexStringCodec<T>((arr) => arr.length == length, name);

export const hexString2Ed25519PubCodec: Codec<HexString, Ed25519Pub, JsonError> = uint8ArrayCodec.mkTaggedHexStringCodec<Ed25519Pub>(
  (arr) => arr.length === 32,
  "Ed25519Pub",
);
export const json2Ed25519PubCodec: JsonCodec<Ed25519Pub> = codec.pipe(
  hexString.jsonCodec,
  hexString2Ed25519PubCodec,
);

export const json2VKeyCodec = codec.rmap(json2Ed25519PubCodec, (key) => new VKey(key), (vkey) => vkey.getKey());
