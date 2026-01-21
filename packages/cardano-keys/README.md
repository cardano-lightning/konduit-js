# cardano-keys

An implementation of:

* bip32-ed25519 - ed25519 derivation compatible with bip32.
* cip1852 - hierarchical structure for HD wallets in Cardano.
* cip3 - root key generation from entropy (mnemonic) and password (25th word). Icarus style - compatible with cardan-js-sdk and modern Cardano wallets.

## Design Choices

This implementation is intentionally **not** extremely minimalistic:

* It avoids exceptions and uses `neverthrow`'s `Result` to encode success and failure.
* It aggressively brands types using `Tagged` from `type-fest`.
* It relies on `libsodium-sumo` and uses `@noble/hashes` and `@noble/ciphers` whenever Web Crypto API is not available.

## Usage

```ts
import assert from 'assert';
import { generateMnemonic, deriveEd25519XPrv, RootPrivateKey, VKey, SKey, KeyRole, WalletIndex, KeyIndex } from '../src/index'

const mnemonic = generateMnemonic("24-words");
const password = new TextEncoder().encode("optional password");
const rootKey = new RootPrivateKey(await deriveEd25519XPrv(mnemonic, password));

// Keys are derive using wallet index, role and key index.
const walletIdx = WalletIndex.fromSmallInt(0);
const keyIdx = KeyIndex.fromSmallInt(0);
// "External" role is used for receiving addresses by convention.
// "Internal" role is used for change addresses.
const paymentIdx = KeyRole.External;

const sKey = rootKey.deriveSKey(walletIdx, paymentIdx, keyIdx);
const vKey = sKey.toVKey();

const message = new Uint8Array([0,1,2,3,4,5,6,7,8,9]);
const signature = sKey.sign(message);
const isValid = vKey.verify(message, signature);

assert(isValid);
```

