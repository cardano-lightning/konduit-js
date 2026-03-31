import type { Tagged } from "type-fest";
import * as noble from "@noble/hashes/sha2.js";

export type Sha256Hash = Tagged<Uint8Array, "Sha256Hash">;

// We prefer noble for now as it is synchronous :-P
export const sha256 = (bytes: Uint8Array): Sha256Hash => {
  return noble.sha256(bytes) as Sha256Hash;
}
