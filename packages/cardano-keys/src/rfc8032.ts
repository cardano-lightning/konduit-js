import sodium from 'libsodium-wrappers-sumo';
import * as uint8Array from './uint8Array';
import type { Tagged } from "type-fest";
import type { Mnemonic } from "./bip39";
import * as bip39 from "./bip39";
import { err, ok, Result } from 'neverthrow';

// RFC 8032 calls a private key the 32 bytes used to derive
// the secret scalar (kl) and the 32 bytes used as "nonce prefix" (kr).
export type Ed25519Secret = Tagged<Uint8Array, "Ed25519Secret">;

export namespace Ed25519Secret {
  export const LENGTH = 32;
  export const fromBytes = (bytes: Uint8Array): Result<Ed25519Secret, string> => {
    if (bytes.length !== LENGTH) {
      return err("Invalid secret length, expected ${LENGTH} bytes");
    }
    return ok(bytes as Ed25519Secret);
  }

  export const fromRandomBytes = (): Ed25519Secret => {
    const randomBytes = sodium.randombytes_buf(32) as Uint8Array;
    return randomBytes as Ed25519Secret;
  }
}

// 64 bytes - two 32 bytes parts:
// kl - key material used for signing (RFC's secret scalar)
// kr - "nonce prefix" used as extra input to HMAC during hardened derivation (RFC's "prefix")
//
// This is derived from private key through secret expanding procedure or through
// BIP32-Ed25519 derivation.
export type Ed25519ExpandedSecret = Tagged<Uint8Array, "Ed25519ExpandedSecret">;
export namespace Ed25519ExpandedSecret {
  export const LENGTH = 64;
  export function fromBytes(raw: Uint8Array): Result<Ed25519ExpandedSecret, string> {
    if (raw.length !== LENGTH) return err(`Invalid expanded secret length, expected ${LENGTH} bytes`);
    const kl = raw.subarray(0, 32);
    const isValidScalar =
      (kl[0] & 0b0000_0111) === 0 && // Lowest 3 bits cleared
      (kl[31] & 0b1100_0000) === 0b0100_0000 // highest 2 bits cleared BUT bit 254 == 1
    ;
    if (!isValidScalar) return err("Invalid scalar: bits do not match required clamping pattern");
    return ok(raw as Ed25519ExpandedSecret);
  }
  // RFC 8032 example:
  // ```python
  // def secret_expand(secret):
  //     if len(secret) != 32:
  //         raise Exception("Bad size of private key")
  //     h = sha512(secret)
  //     a = int.from_bytes(h[:32], "little")
  //     a &= (1 << 254) - 8 # This clears two upper bits and three lower bits
  //     a |= (1 << 254)
  //     return (a, h[32:])
  //  ```
  export const fromSecret = (secret: Ed25519Secret): Ed25519ExpandedSecret => {
    const material = sodium.crypto_hash_sha512(secret, "uint8array") as Uint8Array;

    material[0] &= 0b1111_1000;  // Clear lowest 3 bits
    material[31] &= 0b0011_1111; // Clear 2 highest bits
    material[31] |= 0b0100_0000; // Set bit 254

    return material as Ed25519ExpandedSecret;
  }
}
// Handy shortcut
const expandSecret = Ed25519ExpandedSecret.fromSecret;

// kl part described above
export type Ed25519SecretScalar = Tagged<Uint8Array, "Ed25519SecretScalar">;
export namespace Ed25519SecretScalar {
  export const LENGTH = 32;
  export const fromExpandedSecret = (expanded: Ed25519ExpandedSecret): Ed25519SecretScalar => expanded.subarray(0, LENGTH) as Ed25519SecretScalar;
  export const fromSecret = (secret: Ed25519Secret): Ed25519SecretScalar => fromExpandedSecret(expandSecret(secret));
}

// kr part described above
export type Ed25519NoncePrefix = Tagged<Uint8Array, "Ed25519NoncePrefix">;
export namespace Ed25519NoncePrefix {
  export const LENGTH = 32;
  export const fromExpandedSecret = (expanded: Ed25519ExpandedSecret): Ed25519NoncePrefix => expanded.subarray(32, 64) as Ed25519NoncePrefix;
  export const fromSecret = (secret: Ed25519Secret): Ed25519NoncePrefix => fromExpandedSecret(expandSecret(secret));
}

export type Ed25519Signature = Tagged<Uint8Array, "Ed25519Signature">;

// Original RFC 8032 example:
//
// ```python
// def sign(secret, msg):
//     a, prefix = secret_expand(secret)
//     A = point_compress(point_mul(a, G))
//     r = sha512_modq(prefix + msg)
//     R = point_mul(r, G)
//     Rs = point_compress(R)
//     h = sha512_modq(Rs + A + msg)
//     s = (r + h * a) % q
//     return Rs + int.to_bytes(s, 32, "little")
// ```
//
// We split the procedure into two functions so the core signing part
// can be used by different key derivation schemes (e.g. CIP-1852).
export const signWithExpanded = (expanded: Ed25519ExpandedSecret, message: Uint8Array): Ed25519Signature => {
  const scalar = Ed25519SecretScalar.fromExpandedSecret(expanded);
  const noncePrefix = Ed25519NoncePrefix.fromExpandedSecret(expanded);
  const publicKey = sodium.crypto_scalarmult_ed25519_base_noclamp(scalar, "uint8array") as Uint8Array;
  // Deteriministic randomness:
  // * Never sign two different messages with the same `r` value.
  // * The `r` value should be also unpredictable hence `noncePrefix` (aka `iv`) part of the private key.
  const r = sodium.crypto_core_ed25519_scalar_reduce(
    sodium.crypto_hash_sha512(uint8Array.concat([noncePrefix, message]), "uint8array") as Uint8Array,
    "uint8array"
  ) as Uint8Array;

  // R = r * G
  const R = sodium.crypto_scalarmult_ed25519_base_noclamp(r, "uint8array") as Uint8Array;
  // hram = H(R || A || M)
  let hram = sodium.crypto_core_ed25519_scalar_reduce(
    sodium.crypto_hash_sha512(uint8Array.concat([R, publicKey, message]), "uint8array") as Uint8Array,
    "uint8array"
  ) as Uint8Array;
  // sig = (R, s)
  return uint8Array.concat([
    R,
    // s = (r + hram * a) mod L
    sodium.crypto_core_ed25519_scalar_add(
      sodium.crypto_core_ed25519_scalar_mul(hram, scalar, "uint8array") as Uint8Array,
      r,
      "uint8array"
    ) as Uint8Array
  ]) as Ed25519Signature;
};

export const sign = (message: Uint8Array, secret: Ed25519Secret): Ed25519Signature => {
  const expanded = expandSecret(secret);
  return signWithExpanded(expanded, message);
}

// 32 bytes public key (a * G)
export type Ed25519PublicKey = Tagged<Uint8Array, "Ed25519PublicKey">;
export namespace Ed25519PublicKey {
  export const LENGTH = 32;
  export const fromExpandedSecret = (expanded: Ed25519ExpandedSecret): Ed25519PublicKey => {
    const scalar = Ed25519SecretScalar.fromExpandedSecret(expanded);
    return sodium.crypto_scalarmult_ed25519_base_noclamp(scalar, "uint8array") as Ed25519PublicKey;
  }
  export const fromSecret = (secret: Ed25519Secret): Ed25519PublicKey => fromExpandedSecret(expandSecret(secret));
}

export const verify = (message: Uint8Array, signature: Ed25519Signature, publicKey: Ed25519PublicKey): boolean => {
  // sig = (R, s)
  // hram = Hash(R || A || M)
  // Given
  // s * G = (hram * a + r) * G = r * G + hram * (a * G) = R + hram A
  // Check:
  // s * G ?== R + hram * A
  //
  // Note: detached here means that signature is not concatenated with the
  // message, so we need to pass it separately.
  return sodium.crypto_sign_verify_detached(signature, message, publicKey);
}

export const unsafeUnwrap = <T, E>(res: Result<T, E>): T => {
  return res.match(
    (val) => val,
    (err) => { throw new Error(`Unexpected error: ${err}`); }
  );
}

export class Ed25519PrivateKey {
  static readonly LENGTH = 32;
  public readonly secret: Ed25519Secret;

  constructor(secret: Ed25519Secret) {
    this.secret = secret;
  }

  static fromRandomBytes(): Ed25519PrivateKey {
    const randomKey = Ed25519Secret.fromRandomBytes();
    return new Ed25519PrivateKey(randomKey);
  }

  static fromMnemonic(mnemonic: Mnemonic): Ed25519PrivateKey {
    const seed = bip39.mnemonicToEntropy(mnemonic);
    const secret = unsafeUnwrap(Ed25519Secret.fromBytes(seed));
    return new Ed25519PrivateKey(secret);
  }

  toSigningKey = (): Ed25519SigningKey => {
    const expanded = Ed25519ExpandedSecret.fromSecret(this.secret);
    return new Ed25519SigningKey(expanded);
  }
}

export class Ed25519SigningKey {
  static readonly LENGTH = 64;
  public readonly key: Ed25519ExpandedSecret;

  constructor(key: Ed25519ExpandedSecret) {
    this.key = key;
  }

  sign(message: Uint8Array): Ed25519Signature {
    return signWithExpanded(this.key, message);
  }

  toVerificationKey = (): Ed25519VerificationKey => {
    const pubKey = Ed25519PublicKey.fromExpandedSecret(this.key);
    return new Ed25519VerificationKey(pubKey);
  }
}

export class Ed25519VerificationKey {
  static readonly LENGTH = 32;
  public readonly key: Ed25519PublicKey;

  constructor(key: Ed25519PublicKey) {
    this.key = key;
  }

  verify(message: Uint8Array, signature: Ed25519Signature): boolean {
    return sodium.crypto_sign_verify_detached(signature, message, this.key);
  }
}

