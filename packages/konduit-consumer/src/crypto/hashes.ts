import type { Tagged } from "type-fest";
import * as noble from "@noble/hashes/sha2.js";

export type Sha256Hash = Tagged<Uint8Array, "Sha256Hash">;

export const sha256 = async (bytes: Uint8Array): Promise<Sha256Hash> => {
  const arrayBuffer = new Uint8Array(bytes).buffer;
  if (globalThis.crypto?.subtle?.digest) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer);
    return new Uint8Array(hash) as Sha256Hash;
  }
  return noble.sha256(bytes) as Sha256Hash;
}
