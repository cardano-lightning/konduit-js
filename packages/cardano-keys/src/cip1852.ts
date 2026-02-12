import type { Tagged } from "type-fest";
import { err, ok, type Result } from "neverthrow";
import { derivePrivate, derivePublic, Ed25519XPrv, extractExpandedSecret, HardenedIdx, NonHardenedIdx, type DerivationIdx, type Ed25519XPub, type SmallInt } from "./bip32Ed25519";
import { deriveEd25519XPrv, type Mnemonic } from "./cip3";
import { Ed25519SigningKey } from "./rfc8032";

export function derivePrivatePath(
  parent: Ed25519XPrv,
  path: DerivationIdx[]
): Ed25519XPrv {
  let currKey = parent;
  for(let idx of path) {
    currKey = derivePrivate(currKey, idx);
  }
  return currKey;
}

export function derivePublicPath(
  parent: Ed25519XPub,
  path: NonHardenedIdx[]
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
    return HardenedIdx.fromSmallInt(n) as any as WalletIndex;
  };
  export const fromNumber = (n: number): Result<WalletIndex, string> =>
    HardenedIdx.fromNumber(n).match(
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
    return NonHardenedIdx.fromSmallInt(n) as any as KeyIndex;
  };
  export const fromNumber = (n: number): Result<KeyIndex, string> =>
    NonHardenedIdx.fromNumber(n).match(
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

const unsafeHarden = (n: number): HardenedIdx => {
  return unsafeUnwrap(HardenedIdx.fromNumber(n));
}

export class Ed25519RootPrivateKey {
  public readonly root: Ed25519XPrv;
  private _1852 = unsafeHarden(1852);
  private _1815 = unsafeHarden(1815);

  constructor(root: Ed25519XPrv) {
    this.root = root;
  }

  static fromBytes(bytes: Uint8Array): Result<Ed25519RootPrivateKey, string> {
    return Ed25519XPrv.fromBytes(bytes).map((root) => new Ed25519RootPrivateKey(root));
  }

  static async fromMnemonic(mnemonic: Mnemonic, password: Uint8Array = new Uint8Array()): Promise<Ed25519RootPrivateKey> {
    const root = await deriveEd25519XPrv(mnemonic, password)
    return new Ed25519RootPrivateKey(root);
  }

  // m / 1852' / 1815' / x' / 0, 1, or 2 / n
  //
  // 1852 is the coin (ADA) ID#
  // 1815 is an extra, unused path
  // x is the wallet/wallet index #
  // 0/1 are wallet x's payment/change keys-paths, and 2 is it's staking key-path
  // n is the key #
  deriveSigningKey(walletIndex: WalletIndex, role: KeyRole, keyIndex: KeyIndex): Ed25519SigningKey {
    const extendedPrvKey = derivePrivatePath(this.root, [
      this._1852,
      this._1815,
      // We can safely unwrap here as we validated when creating WalletIndex
      walletIndex as any as HardenedIdx,
      role as NonHardenedIdx,
      keyIndex as any as NonHardenedIdx,
    ]);
    const expandedSecret = extractExpandedSecret(extendedPrvKey);
    // const rawSigningKey = extractPrv(extendedPrvKey);
    return new Ed25519SigningKey(expandedSecret);
  }
}


export { Ed25519SigningKey };

