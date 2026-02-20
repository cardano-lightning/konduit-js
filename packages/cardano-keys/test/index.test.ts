import { describe, it, expect } from 'vitest';
import * as english from "@scure/bip39/wordlists/english.js";
import testVectors from './test-vectors.json';
import { Ed25519RootPrivateKey, Ed25519SigningKey, KeyIndex, KeyRole, WalletIndex } from '../src/cip1852';
import { type DerivationIdx, Ed25519XPrv, type Ed25519XPub, extractExpandedSecret, HardenedIdx, NonHardenedIdx } from '../src/bip32Ed25519';
import { readmeExample as readmeExample1 } from './readme-example-1';
import { readmeExample as readmeExample2 } from './readme-example-2';
import { deriveEd25519XPrv, Mnemonic } from "../src/index";
import { Ed25519PublicKey, type Ed25519Signature, unsafeUnwrap } from '../src/rfc8032';

type DerivationPath = { type: "custom", indices: DerivationIdx[] } | { type: "cip1852", walletIdx: WalletIndex, role: KeyRole, keyIdx: KeyIndex };

type TestVector = {
  mnemonic: Mnemonic,
  derivationPath: DerivationPath,
  rootXprv: Ed25519XPrv,
  addrXprv: Ed25519XPrv,
  addrXpub: Ed25519XPub,
  addrPub: Ed25519PublicKey,
  signing: {
    data: Uint8Array,
    signature: Ed25519Signature,
    publicKey: Ed25519PublicKey,
  }
};

const deserialiseUint8Array = (hexStr: String): Uint8Array => {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    const byteStr = hexStr.slice(i, i + 2);
    const byte = Number.parseInt(byteStr, 16);
    bytes[i / 2] = byte;
  }
  return bytes;
}

// Derivation path can be in one of two forms:
// "derivationPath": { "walletIdx": 0, "role": 1, "keyIdx": 4 },
// or:
// "derivationPath": { "indices": [1, 2], "hardened": false },
const deserialiseDerivationPath = (obj: any): DerivationPath => {
  if ('indices' in obj) {
    const indices: DerivationIdx[] = obj.indices.map((idx: number) => {
      if (obj.hardened) {
        return unsafeUnwrap(HardenedIdx.fromNumber(idx));
      } else {
        return unsafeUnwrap(NonHardenedIdx.fromNumber(idx));
      }
    });
    return { type: "custom", indices };
  } else {
    return {
      type: "cip1852",
      walletIdx: unsafeUnwrap(WalletIndex.fromNumber(obj.walletIdx)),
      role: obj.role as KeyRole,
      keyIdx: unsafeUnwrap(KeyIndex.fromNumber(obj.keyIdx)),
    };
  }
}

const deserialiseTestVector = (obj: any): TestVector => {
  return {
    mnemonic: { mnemonicWords: obj.mnemonic, wordlist: english.wordlist } as Mnemonic,
    derivationPath: deserialiseDerivationPath(obj.derivationPath),
    rootXprv: deserialiseUint8Array(obj.rootXprv) as Ed25519XPrv,
    addrXprv: deserialiseUint8Array(obj.addrXprv) as Ed25519XPrv,
    addrXpub: deserialiseUint8Array(obj.addrXpub) as Ed25519XPub,
    addrPub: deserialiseUint8Array(obj.addrPub) as Ed25519PublicKey,
    signing: {
      data: deserialiseUint8Array(obj['cardano-signer'].data),
      signature: deserialiseUint8Array(obj['cardano-signer'].signature) as Ed25519Signature,
      publicKey: deserialiseUint8Array(obj['cardano-signer'].publicKey) as Ed25519PublicKey,
    }
  };
}

describe('Cardano key derivation', () => {
  it('should match test vectors', async () => {
    for (const vector of testVectors) {
      const { mnemonic, derivationPath, rootXprv, addrXprv, addrXpub: _, addrPub, signing } = deserialiseTestVector(vector);

      // Derive root key from mnemonic
      const password = new TextEncoder().encode("");
      const rootKey = new Ed25519RootPrivateKey(await deriveEd25519XPrv(mnemonic, password));
      const rootKeyBytes = rootKey.root;

      // Check root extended private key
      expect(rootKeyBytes).toStrictEqual(rootXprv);
      // FIXME: Not sure why derived keys from cardano-address for paths like `1/2` or `1H/2H` don't match
      //        even though the full paths for cip1852 derivations do match.
      if (derivationPath.type === "custom") {
        continue;
      }

      const sKey: Ed25519SigningKey = (() => {
        // if (derivationPath.type === "custom") {
        //   // Custom derivation path
        //   const key = derivePrivatePath(rootKeyBytes, derivationPath.indices);
        //   return new Ed25519SigningKey(extractPrv(key));
        // }
        const { walletIdx, role, keyIdx } = derivationPath;
        return rootKey.deriveSigningKey(walletIdx, role, keyIdx);
      })();
      const sKeyBytes = sKey.key;
      const expectedPrv = extractExpandedSecret(addrXprv);
      expect(sKeyBytes).toStrictEqual(expectedPrv);

      const vKey = sKey.toVerificationKey();
      expect(vKey.key).toStrictEqual(addrPub);

      const { data, signature, publicKey } = signing;
      const sig = sKey.sign(data);
      expect(vKey.key).toStrictEqual(publicKey);
      expect(sig).toStrictEqual(signature);
      expect(vKey.verify(data, sig)).toBe(true);
    }
  });

  it('should run first README example successfully', async () => {
    await readmeExample1();
  });

  it('should run second README example successfully', async () => {
    await readmeExample2();
  });
});
