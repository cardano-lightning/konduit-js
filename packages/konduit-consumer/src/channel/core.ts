import type { Tagged } from "type-fest";
import { VKey } from "@konduit/cardano-keys";
import { randomBytes } from "@noble/hashes/utils.js";

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

export type KeyTag = Tagged<Uint8Array, "KeyTag">;
export namespace KeyTag {
  export const fromKeyAndTag = (key: VKey, tag: ChannelTag): KeyTag => {
    return new Uint8Array([...key.getKey(), ...tag]) as KeyTag;
  }
}
