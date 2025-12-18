// Naive implementation of key management

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

ed.hashes.sha512 = sha512;

export function genSkey() {
  const { secretKey } = ed.keygen();
  return secretKey;
}

export function toVerificationKey(skey: Uint8Array) {
  return ed.getPublicKey(skey);
}

export function verify(vkey: Uint8Array, message: Uint8Array, signature: Uint8Array) {
  return ed.verify(signature, message, vkey);
}

export function sign(skey: Uint8Array, message: Uint8Array) {
  return ed.sign(message, skey);
}
