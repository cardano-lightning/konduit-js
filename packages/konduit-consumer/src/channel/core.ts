import type { Tagged } from "type-fest";
import { Ed25519PublicKey, Ed25519VerificationKey } from "@konduit/cardano-keys";
import { randomBytes } from "@noble/hashes/utils.js";
import { mkTaggedHexStringCodec, mkTaggedJsonCodec } from "@konduit/codec/uint8Array";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import type { ConsumerEd25519VerificationKey } from "./l1Channel";

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
  export const fromKeyAndTag = (key: ConsumerEd25519VerificationKey, tag: ChannelTag): KeyTag => {
    return new Uint8Array([...key.key, ...tag]) as KeyTag;
  }

  export const split = (keyTag: KeyTag): { key: ConsumerEd25519VerificationKey; tag: ChannelTag } => {
    const key = keyTag.slice(0, Ed25519PublicKey.LENGTH) as Ed25519PublicKey;
    const tag = keyTag.slice(Ed25519PublicKey.LENGTH) as ChannelTag;
    return { key: new Ed25519VerificationKey(key) as ConsumerEd25519VerificationKey, tag };
  }
}
export const hexString2KeyTagCodec = mkTaggedHexStringCodec("KeyTag", (arr) => arr.length >= 28);

