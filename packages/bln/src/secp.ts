import * as secp from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";

secp.hashes.sha256 = sha256;

export function recoverPubkey(
  message: Uint8Array,
  signature: Uint8Array,
): Uint8Array {
  const key = secp.recoverPublicKey(signature, message);
  if (!key) throw new Error("Public key recovery failed.");
  return key as Uint8Array<ArrayBuffer>;
}
