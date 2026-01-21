import type { Tagged } from "type-fest";
import sodium from "libsodium-wrappers-sumo";
import * as uint8Array from "./uint8Array";
import { err, ok, type Result } from "neverthrow";
import { derivePrivate, derivePublic, extractPrv, HardenedDerivationIndex, NonHardenedDerivationIndex, type DerivationIndex, type Ed25519Prv, type Ed25519Pub, type Ed25519XPrv, type Ed25519XPub, type SmallInt } from "./bip32Ed25519";

export function derivePrivatePath(
  parent: Ed25519XPrv,
  path: DerivationIndex[]
): Ed25519XPrv {
  let currKey = parent;
  for(let idx of path) {
    currKey = derivePrivate(currKey, idx);
  }
  return currKey;
}

export function derivePublicPath(
  parent: Ed25519XPub,
  path: NonHardenedDerivationIndex[]
): Ed25519XPub {
  let currKey: Ed25519XPub = parent;
  for(let idx of path) {
    currKey = derivePublic(currKey, idx);
  }
  return currKey;
}

export type WalletIndex = Tagged<number, "WalletIndex">;
export namespace WalletIndex {
  export const fromSmallInt = (n: SmallInt): WalletIndex => {
    return HardenedDerivationIndex.fromSmallInt(n) as any as WalletIndex;
  };
  export const fromNumber = (n: number): Result<WalletIndex, string> =>
    HardenedDerivationIndex.fromNumber(n).match(
      (h) => ok(h as any as WalletIndex),
      (e) => err(e)
    );
};

export enum KeyRole {
  External = 0, // or "Payment"
  Internal = 1, // or "Change"
  Stake = 2,
  DRep = 3,
}

export type KeyIndex = Tagged<number, "KeyIndex">;
export namespace KeyIndex {
  export const fromSmallInt = (n: SmallInt): KeyIndex => {
    return NonHardenedDerivationIndex.fromSmallInt(n) as any as KeyIndex;
  };
  export const fromNumber = (n: number): Result<KeyIndex, string> =>
    NonHardenedDerivationIndex.fromNumber(n).match(
      (_) => ok(n as KeyIndex),
      (e) => err(e)
    );
}

export const unsafeUnwrap = <T, E>(res: Result<T, E>): T => {
  return res.match(
    (val) => val,
    (err) => { throw new Error(`Unexpected error: ${err}`); }
  );
}

const unsafeHarden = (n: number): HardenedDerivationIndex => {
  return unsafeUnwrap(HardenedDerivationIndex.fromNumber(n));
}

export class RootPrivateKey {
  private root: Ed25519XPrv;
  private _1852 = unsafeHarden(1852);
  private _1815 = unsafeHarden(1815);

  constructor(root: Ed25519XPrv) {
    this.root = root;
  }

  // m / 1852' / 1815' / x' / 0, 1, or 2 / n
  //
  // 1852 is the coin (ADA) ID#
  // 1815 is an extra, unused path
  // x is the wallet/wallet index #
  // 0/1 are wallet x's payment/change keys-paths, and 2 is it's staking key-path
  // n is the key #
  deriveSKey(walletIndex: WalletIndex, role: KeyRole, keyIndex: KeyIndex): SKey {
    const extendedPrvKey = derivePrivatePath(this.root, [
      this._1852,
      this._1815,
      // We can safely unwrap here as we validated when creating WalletIndex
      walletIndex as any as HardenedDerivationIndex,
      role as NonHardenedDerivationIndex,
      keyIndex as any as NonHardenedDerivationIndex,
    ]);
    const rawSigningKey = extractPrv(extendedPrvKey);
    return new SKey(rawSigningKey);
  }

  getKey = (): Ed25519XPrv => this.root;
}

// Simplifies the derivation of the signing keys from the root keys by caching the wallet and role.
export const mkSKeyGenerator = (root: RootPrivateKey) => (walletIndex: WalletIndex, role: KeyRole): ((keyIndex: KeyIndex) => SKey) => {
  return (keyIndex: KeyIndex): SKey => {
    return root.deriveSKey(walletIndex, role, keyIndex);
  };
}

export type Signature = Tagged<Uint8Array, "Signature">;

export class VKey {
  private key: Ed25519Pub;

  constructor(key: Ed25519Pub) {
    this.key = key;
  }

  verify = (message: Uint8Array, signature: Signature): boolean => {
    // sig = (R, s)
    // hram = Hash(R || A || M)
    // Given
    // s * G = (hram * a + r) * G = r * G + hram * (a * G) = R + hram A
    // Check:
    // s * G ?== R + hram * A
    return sodium.crypto_sign_verify_detached(signature, message, this.key);
  }

  getKey = (): Ed25519Pub => this.key;
}

export class SKey {
  private scalar: Uint8Array;
  private noncePrefix: Uint8Array;

  constructor(key: Ed25519Prv) {
    this.scalar = key.subarray(0, 32);
    this.noncePrefix = key.subarray(32, 64);
  }

  // Ported from cardano-sdk
  sign = (message: Uint8Array): Signature => {
    const publicKey = sodium.crypto_scalarmult_ed25519_base_noclamp(this.scalar, "uint8array") as Uint8Array;
    // Deteriministic randomness:
    // * Never sign two different messages with the same `r` value.
    // * The `r` value should be also unpredictable hence `noncePrefix` (aka `iv`) part of the private key.
    const r = sodium.crypto_core_ed25519_scalar_reduce(
      sodium.crypto_hash_sha512(uint8Array.concat([this.noncePrefix, message]), "uint8array") as Uint8Array,
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
        sodium.crypto_core_ed25519_scalar_mul(hram, this.scalar, "uint8array") as Uint8Array,
        r,
        "uint8array"
      ) as Uint8Array
    ]) as Signature;
  };

  toVKey = () => {
    // A = a * G
    const publicKey = sodium.crypto_scalarmult_ed25519_base_noclamp(this.scalar, "uint8array") as Uint8Array;
    return new VKey(publicKey as Ed25519Pub);
  }

  getKey = (): Ed25519Prv => uint8Array.concat([this.scalar, this.noncePrefix]) as Ed25519Prv;
}

