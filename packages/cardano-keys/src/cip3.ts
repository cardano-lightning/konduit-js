import type { Tagged } from "type-fest";
import sodium from 'libsodium-wrappers-sumo';
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha512 } from "@noble/hashes/sha2.js";
import * as english from "@scure/bip39/wordlists/english.js";
import * as bip39 from "@scure/bip39"; // Assuming you"re using bip39 for mnemonicToEntropy
import * as uint8Array from "./uint8Array";
import { mkEd25519XPrv, type Ed25519XPrv } from "./bip32Ed25519";

export type MnemonicStrength = "12-words" | "15-words" | "18-words" | "21-words" | "24-words";
type MnemomicStrengthInBits = 128 | 160 | 192 | 224 | 256;
function strengthWordsToBits(strength: MnemonicStrength = "24-words"): MnemomicStrengthInBits {
  switch (strength) {
    case "12-words":
      return 128;
    case "15-words":
      return 160;
    case "18-words":
      return 192;
    case "21-words":
      return 224;
    case "24-words":
      return 256;
  }
}

// We can not really avoid using string here (which is impossible to wipe out from memory on demand)
// because the bip39 library works with strings only.
export type Mnemonic = Tagged<string, "Mnemonic">;

export function generateMnemonic(strength: MnemonicStrength = "24-words", wordlist: string[] = english.wordlist): Mnemonic {
  const strengthInBits = strengthWordsToBits(strength);
  return bip39.generateMnemonic(wordlist, strengthInBits) as Mnemonic;
}

// The "25th word" - password used in BIP39 PBKDF2
// Use TextEncoder to convert string to Uint8Array if needed. Wipe out after use.
type Password = Uint8Array;

const subtle = globalThis.crypto?.subtle;

export const deriveEd25519XPrv = async (
  mnemonic: Mnemonic,
  password: Password = new Uint8Array(), // Default to empty passphrase
  wordlist: string[] = english.wordlist,
  // Used for testing purposes only
  _enforceWebcrypto: boolean = false,
): Promise<Ed25519XPrv> => {
  // Get entropy from mnemonic (16-32 bytes depending on mnemonic length)
  const entropy = bip39.mnemonicToEntropy(mnemonic, wordlist); // Returns Buffer, convert if needed
  const salt = Uint8Array.from(entropy); // Entropy as salt
  const iterations = 4096;
  const dkLen = 96;

  // Should never happen in production, only for testing
  if(_enforceWebcrypto && !subtle) {
    throw new Error("Web Crypto not available");
  }

  let material: Uint8Array = await (async () => {
    // Use Web Crypto for PBKDF2 with SHA-512
    if (subtle || _enforceWebcrypto) {
      const keyMaterial = await subtle.importKey(
        'raw',
        password.buffer as ArrayBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations,
          hash: 'SHA-512',
        },
        keyMaterial,
        dkLen * 8
      );
      return new Uint8Array(derivedBits);
    }
    // Fallback to noble
    return pbkdf2(sha512, password, salt, { c: iterations, dkLen });
  })();

  material[0] &= 0b1111_1000;  // Clear lowest 3 bits
  material[31] &= 0b0001_1111; // Clear 3 highest bits
  material[31] |= 0b0100_0000; // Set bit 254

  return mkEd25519XPrv(material).match(
    (xprv) => xprv,
    (err) => {
      // Should never happen
      throw new Error(`Fatal derivation error in cip3 implemenation: ${err}`);
    }
  );
};
