// BIP32-Ed25519 scalar manipulation.
// Derivation code ported from @cardano-sdk/crypto (MPL-2.0 license)
// These perform 256-bit additions with constant-time properties (fixed loops, no branches).
import sodium from 'libsodium-wrappers-sumo';
import * as uint8Array from './uint8Array';
import type { Tagged } from 'type-fest';
import { err, ok, type Result } from 'neverthrow';

// 32 bytes
export type ChainCode = Tagged<Uint8Array, "ChainCode">;

// 64 bytes - two 32 bytes parts:
// kl - key material used for signing etc.
// kr - "nonce prefix" used as extra input to HMAC during hardened derivation
export type Ed25519Prv = Tagged<Uint8Array, "Ed25519Prv">;

// 32 bytes
export type Ed25519Pub = Tagged<Uint8Array, "Ed25519Pub">;

// 96 bytes - three 32 bytes parts:
// kl - secret scalar used for signing etc.
// kr - "nonce prefix" used as extra input to HMAC during hardened derivation
// cc - chain code used for derivation
export type Ed25519XPrv = Tagged<Uint8Array, "Ed25519XPrv">;

export function extractPrv(
  xprv: Ed25519XPrv
): Ed25519Prv {
  return xprv.subarray(0, 64) as Ed25519Prv;
}

// 64 bytes - two 32 bytes parts:
// pk - public key
// cc - chain code used for derivation
export type Ed25519XPub = Tagged<Uint8Array, "Ed25519XPub">;

export function extractPub(
  xpub: Ed25519XPub
): Ed25519Pub {
  return xpub.subarray(0, 32) as Ed25519Pub;
}

export function extractChainCode(
  key: Ed25519XPrv | Ed25519XPub
): ChainCode {
  return key.subarray(-32) as ChainCode;
}

export const HARDENING_OFFSET = 0x80000000;

export type SmallInt = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50;

export type HardenedIdx = Tagged<number, "HardenedIdx">;

export namespace HardenedIdx {
  export const fromSmallInt = (n: SmallInt): HardenedIdx => {
    return (n + HARDENING_OFFSET) as HardenedIdx;
  };
  export const fromNumber = (n: number): Result<HardenedIdx, string> => {
    if (!Number.isInteger(n) || n < 0) {
      return err("Index must be integer ≥ 0");
    }
    if (n > 2**31 - 1) {
      return err("Index too large to harden");
    }
    return ok((n + HARDENING_OFFSET) as HardenedIdx);
  };
};

/* number in [0, 2^31 - 1] */
export type NonHardenedIdx = Tagged<number, "NonHardenedIdx">;

export namespace NonHardenedIdx {
  export const fromSmallInt = (n: SmallInt): NonHardenedIdx => {
    return n as NonHardenedIdx;
  }
  export const fromNumber = (n: number): Result<NonHardenedIdx, string> => {
    if (!Number.isInteger(n) || n < 0) {
      return err("Index must be integer 0 ≤ n < 2³¹");
    }
    if (n >= HARDENING_OFFSET) {
      return err("Index too large to be non-hardened");
    }
    return ok(n as NonHardenedIdx);
  }
}

export type DerivationIdx = NonHardenedIdx | HardenedIdx;

export function mkEd25519XPrv(raw: Uint8Array): Result<Ed25519XPrv, string> {
  if (raw.length !== 96) return err(`Expected 96 bytes, got ${raw.length}`);

  const kl = raw.subarray(0, 32);

  const isValidScalar =
    (kl[0] & 0b0000_0111) === 0 && // Lowest 3 bits cleared
    (kl[31] & 0b1110_0000) === 0b0100_0000 // highest 3 bits cleared BUT bit 254 == 1
  ;

  if (!isValidScalar) return err("Invalid Ed25519-BIP32 scalar: bits do not match required clamping pattern");
  return ok(raw as Ed25519XPrv);
}

/**
 * Adds two 256-bit numbers represented as byte arrays. For the first 28 bytes,
 * it multiplies the second number by 8 before adding.
 *
 * @param x The first 256-bit number as a byte array (little-endian).
 * @param y The second 256-bit number as a byte array (little-endian).
 * @returns The result of the addition as a byte array (little-endian).
 */
const add28Mul8 = (x: Uint8Array, y: Uint8Array): Uint8Array => {
  let carry = 0;
  const out = new Uint8Array(32).fill(0);

  for (let i = 0; i < 28; i++) {
    const r = x[i] + (y[i] << 3) + carry;
    out[i] = r & 0xff;
    carry = (r >> 8) & 0xff; // Explicit mask for safety
  }
  for (let i = 28; i < 32; i++) {
    const r = x[i] + carry;
    out[i] = r & 0xff;
    carry = (r >> 8) & 0xff;
  }
  // Note: Any final carry is discarded (as per Ed25519 scalar reduction needs elsewhere)
  return out;
};

/**
 * Adds two 256-bit numbers represented as byte arrays.
 *
 * @param x The first 256-bit number as a byte array (little-endian).
 * @param y The second 256-bit number as a byte array (little-endian).
 * @returns The result of the addition as a byte array (little-endian).
 */
const add256bits = (x: Uint8Array, y: Uint8Array): Uint8Array => {
  let carry = 0;
  const out = new Uint8Array(32).fill(0);

  for (let i = 0; i < 32; i++) {
    const r = x[i] + y[i] + carry;
    out[i] = r & 0xff;
    carry = (r >> 8) & 0xff;
  }
  // Note: Any final carry is discarded (as per Ed25519 scalar reduction needs elsewhere)
  return out;
};

/**
 * Check if the index is hardened.
 *
 * @param index The index to verify.
 * @returns true if hardened; otherwise; false.
 */
export const isHardened = (index: number) => index >= 0x80_00_00_00;

/**
 * Derives the private key with a hardened index.
 *
 * @param index The derivation index.
 * @param scalar Ed25519 curve scalar.
 * @param iv Ed25519 binary blob used as IV for signing.
 * @param chainCode The chain code.
 */
const deriveHardened = (
  index: number,
  scalar: Uint8Array,
  iv: Uint8Array,
  chainCode: Uint8Array
): { zMac: Uint8Array; ccMac: Uint8Array } => {
  const data = new Uint8Array(1 + 64 + 4).fill(0);
  uint8Array.writeUInt32LE(data, index, 1 + 64);
  data.set(scalar, 1);
  data.set(iv, 1 + 32);

  data[0] = 0x00;
  const zMac = sodium.crypto_auth_hmacsha512(data, chainCode, "uint8array") as Uint8Array;
  data[0] = 0x01;
  const ccMac = sodium.crypto_auth_hmacsha512(data, chainCode, "uint8array") as Uint8Array;

  return { ccMac, zMac };
};

/**
 * Derives the private key with a 'soft' index.
 *
 * @param index The derivation index.
 * @param scalar Ed25519 curve scalar.
 * @param chainCode The chain code.
 */
const deriveSoft = (index: number, scalar: Uint8Array, chainCode: Uint8Array): { zMac: Uint8Array; ccMac: Uint8Array } => {
  const data = new Uint8Array(1 + 32 + 4).fill(0);
  uint8Array.writeUInt32LE(data, index, 1 + 32);

  const vk = sodium.crypto_scalarmult_ed25519_base_noclamp(scalar, "uint8array") as Uint8Array;
  data.set(vk, 1);
  data[0] = 0x02;

  const zMac = sodium.crypto_auth_hmacsha512(data, chainCode, "uint8array") as Uint8Array;
  data[0] = 0x03;
  const ccMac = sodium.crypto_auth_hmacsha512(data, chainCode, "uint8array") as Uint8Array;

  return { ccMac, zMac };
};

/**
 * Computes `(8 * sk[:28])*G` where `sk` is a little-endian encoded int and `G` is the curve's base point.
 *
 * @param sk The secret key.
 */
const pointOfTrunc28Mul8 = (sk: Uint8Array) => {
  const scalar = add28Mul8(new Uint8Array(32).fill(0), sk);
  return sodium.crypto_scalarmult_ed25519_base_noclamp(scalar, "uint8array") as Uint8Array;
};

/**
 * Derive the given private key with the given index.
 *
 * # Security considerations
 *
 * hard derivation index cannot be soft derived with the public key.
 *
 * # Hard derivation vs Soft derivation
 *
 * If you pass an index below 0x80000000 then it is a soft derivation.
 * The advantage of soft derivation is that it is possible to derive the
 * public key too. I.e. derivation the private key with a soft derivation
 * index and then retrieving the associated public key is equivalent to
 * deriving the public key associated to the parent private key.
 *
 * Hard derivation index does not allow public key derivation.
 *
 * This is why deriving the private key should not fail while deriving
 * the public key may fail (if the derivation index is invalid).
 *
 * @param key The parent key to be derived.
 * @param index The derivation index.
 * @returns The child BIP32 key.
 */
export const derivePrivate = (key: Ed25519XPrv, index: number): Ed25519XPrv => {
  const kl = key.subarray(0, 32);
  const kr = key.subarray(32, 64);
  const cc = key.subarray(64, 96);

  const { ccMac, zMac } = isHardened(index) ? deriveHardened(index, kl, kr, cc) : deriveSoft(index, kl, cc);

  const chainCode = ccMac.slice(32, 64);
  const zl = zMac.slice(0, 32);
  const zr = zMac.slice(32, 64);

  const left = add28Mul8(kl, zl);
  const right = add256bits(kr, zr);

  return uint8Array.concat([left, right, chainCode]) as Ed25519XPrv;
};

/**
 * Derive the given public key with the given index.
 *
 * Public key derivation is only possible with non-hardened indices.
 *
 * @param key The parent key to be derived.
 * @param index The derivation index.
 * @returns The child BIP32 key.
 */
export const derivePublic = (key: Ed25519XPub, index: NonHardenedIdx): Ed25519XPub => {
  const pk = key.subarray(0, 32);
  const cc = key.subarray(32, 64);

  const data = new Uint8Array(1 + 32 + 4).fill(0);
  uint8Array.writeUInt32LE(data, index, 1 + 32);

  data.set(pk, 1);
  data[0] = 0x02;
  const z = sodium.crypto_auth_hmacsha512(data, cc, "uint8array") as Uint8Array;
  data[0] = 0x03;
  const c = sodium.crypto_auth_hmacsha512(data, cc, "uint8array") as Uint8Array;

  const chainCode = c.slice(32, 64);

  const zl = z.slice(0, 32);

  const p = pointOfTrunc28Mul8(zl);

  return uint8Array.concat([
    sodium.crypto_core_ed25519_add(p, pk, "uint8array") as Uint8Array,
    chainCode
  ]) as Ed25519XPub;
};

