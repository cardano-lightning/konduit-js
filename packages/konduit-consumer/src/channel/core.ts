import type { Tagged } from "type-fest";
import { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { randomBytes } from "@noble/hashes/utils.js";
import { mkTaggedHexStringCodec, mkTaggedJsonCodec } from "@konduit/codec/uint8Array";
import { JsonCodec } from "@konduit/codec/json/codecs";

export type ChannelTag = Tagged<Uint8Array, "ChannelTag">;
export namespace ChannelTag {
  export const fromRandomBytes = async () => {
    const bytes = randomBytes(16);
    return bytes as ChannelTag;
  }
  export const fromKeyTag = (keyTag: KeyTag): ChannelTag => {
    return keyTag.slice(28) as ChannelTag;
  }
}
export const json2ChannelTagCodec: JsonCodec<ChannelTag> = mkTaggedJsonCodec("ChannelTag", (_arr) => true);

export type KeyTag = Tagged<Uint8Array, "KeyTag">;
export namespace KeyTag {
  export const fromKeyAndTag = (key: Ed25519VerificationKey, tag: ChannelTag): KeyTag => {
    return new Uint8Array([...key.key, ...tag]) as KeyTag;
  }
}
export const hexString2KeyTagCodec = mkTaggedHexStringCodec("KeyTag", (arr) => arr.length >= 28);

