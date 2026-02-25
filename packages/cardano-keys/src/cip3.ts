import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { Ed25519XPrv } from "./bip32Ed25519";
import { Mnemonic, mnemonicToEntropy } from "./bip39";

const subtle = globalThis.crypto?.subtle;

// Uint8Array is easier to wipe out after use that is why we use it as password/25th word type.
export const deriveEd25519XPrv = async (
  mnemonic: Mnemonic,
  password: Uint8Array = new Uint8Array(),
  // Used for testing purposes only
  _enforceWebcrypto: boolean = false,
): Promise<Ed25519XPrv> => {
  // Get entropy from mnemonic (16-32 bytes depending on mnemonic length)
  const entropy = mnemonicToEntropy(mnemonic);
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

  // We use the same strategy as cardano-js-sdk and also used by the CIP-3
  // reference implementation path (they are two paths - strict and this relaxed one):
  //
  // ```rust
  // pub fn normalize_bytes_force3rd(mut bytes: [u8; XPRV_SIZE]) -> Self {
  // ```
  material[0] &= 0b1111_1000;  // Clear lowest 3 bits
  material[31] &= 0b0001_1111; // Clear 3 highest bits
  material[31] |= 0b0100_0000; // Set bit 254

  return Ed25519XPrv.fromBytes(material).match(
    (xprv) => xprv,
    (err) => {
      // Should never happen
      throw new Error(`Fatal derivation error in cip3 implemenation: ${err}`);
    }
  );
};
