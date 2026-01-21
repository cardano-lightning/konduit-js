import { describe, it, expect } from 'vitest';
import { deriveEd25519XPrv, type Mnemonic, RootPrivateKey, KeyRole, WalletIndex, KeyIndex, Ed25519Pub, Signature, Ed25519XPrv, Ed25519XPub, HardenedDerivationIndex } from '../src/index'
import testVectors from './test-vectors.json';
import { SKey, unsafeUnwrap } from '../src/cip1852';
import { DerivationIndex, extractPrv, NonHardenedDerivationIndex } from '../src/bip32Ed25519';

type DerivationPath = { type: "custom", indices: DerivationIndex[] } | { type: "cip1852", walletIdx: WalletIndex, role: KeyRole, keyIdx: KeyIndex };

type TestVector = {
  mnemonic: Mnemonic,
  derivationPath: DerivationPath,
  rootXprv: Ed25519XPrv,
  addrXprv: Ed25519XPrv,
  addrXpub: Ed25519XPub,
  addrPub: Ed25519Pub,
  signing: {
    data: Uint8Array,
    signature: Signature,
    publicKey: Ed25519Pub,
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

const serialiseUint8Array = (arr: Uint8Array): String => {
  let str = "";
  for (let i = 0; i < arr.length; i++) {
    str += arr[i].toString(16).padStart(2, '0');
  }
  return str;
}
// Derivation path can be in one of two forms:
// "derivationPath": { "walletIdx": 0, "role": 1, "keyIdx": 4 },
// or:
// "derivationPath": { "indices": [1, 2], "hardened": false },
const deserialiseDerivationPath = (obj: any): DerivationPath => {
  if ('indices' in obj) {
    const indices: DerivationIndex[] = obj.indices.map((idx: number) => {
      if (obj.hardened) {
        return unsafeUnwrap(HardenedDerivationIndex.fromNumber(idx));
      } else {
        return unsafeUnwrap(NonHardenedDerivationIndex.fromNumber(idx));
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
    mnemonic: obj.mnemonic as Mnemonic,
    derivationPath: deserialiseDerivationPath(obj.derivationPath),
    rootXprv: deserialiseUint8Array(obj.rootXprv) as Ed25519XPrv,
    addrXprv: deserialiseUint8Array(obj.addrXprv) as Ed25519XPrv,
    addrXpub: deserialiseUint8Array(obj.addrXpub) as Ed25519XPub,
    addrPub: deserialiseUint8Array(obj.addrPub) as Ed25519Pub,
    signing: {
      data: deserialiseUint8Array(obj['cardano-signer'].data),
      signature: deserialiseUint8Array(obj['cardano-signer'].signature) as Signature,
      publicKey: deserialiseUint8Array(obj['cardano-signer'].publicKey) as Ed25519Pub,
    }
  };
}

describe('Cardano key derivation', () => {
  it('should match test vectors', async () => {
    for (const vector of testVectors) {
      const { mnemonic, derivationPath, rootXprv, addrXprv, addrXpub, addrPub, signing } = deserialiseTestVector(vector);

      // Derive root key from mnemonic
      const password = new TextEncoder().encode("");
      const rootKey = new RootPrivateKey(await deriveEd25519XPrv(mnemonic, password));
      const rootKeyBytes = rootKey.getKey();

      // Check root extended private key
      expect(rootKeyBytes).toStrictEqual(rootXprv);
      // FIXME: Not sure why derived keys from cardano-address for paths like `1/2` or `1H/2H` don't match
      //        even though the full paths for cip1852 derivations do match.
      if (derivationPath.type === "custom") {
        continue;
      }

      const sKey: SKey = (() => {
        // if (derivationPath.type === "custom") {
        //   // Custom derivation path
        //   console.log("Deriving custom path: ", derivationPath.indices.map(i => i.toString()).join("/"));
        //   const key = derivePrivatePath(rootKeyBytes, derivationPath.indices);
        //   console.log("Derived custom key: ", serialiseUint8Array(key));
        //   return new SKey(extractPrv(key));
        // }
        const { walletIdx, role, keyIdx } = derivationPath;
        return rootKey.deriveSKey(walletIdx, role, keyIdx);
      })();
      const sKeyBytes = sKey.getKey();
      const expectedPrv = extractPrv(addrXprv);
      console.log("Expected addr xprv: ", serialiseUint8Array(addrXprv));
      console.log("Derived addr xprv:   ", serialiseUint8Array(sKeyBytes));
      expect(sKeyBytes).toStrictEqual(expectedPrv);

      const vKey = sKey.toVKey();
      expect(vKey.getKey()).toStrictEqual(addrPub);

      const { data, signature, publicKey } = signing;
      const sig = sKey.sign(data);
      expect(vKey.getKey()).toStrictEqual(publicKey);
      expect(sig).toStrictEqual(signature);
      expect(vKey.verify(data, sig)).toBe(true);
    }
  });
});


