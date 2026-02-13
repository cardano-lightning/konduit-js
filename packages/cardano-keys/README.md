# cardano-keys

An implementation or at least typing of (as we heavily rely on other giants):

* rfc8032 - ed25519 signature scheme plus simple key pair (and "nonce prefix") derivation based on a single secret.
* bip32-ed25519 - ed25519 derivation compatible with bip32 which builds on top of rfc8032.
* cip1852 - hierarchical structure for HD wallets in Cardano.
* cip3 - root key generation from entropy (mnemonic) and password (25th word). Icarus style - compatible with cardan-js-sdk and modern Cardano wallets.

## Design Choices

This implementation is intentionally **not** extremely minimalistic:

* It avoids exceptions and uses `neverthrow`'s `Result` to encode success and failure.
* It aggressively brands types using `Tagged` from `type-fest`.
* It relies on `libsodium-sumo` and uses `@noble/hashes` and `@noble/ciphers` whenever Web Crypto API is not available.

## Usage

All the examples below contain and repeat some imports so they are stand alone. We can extract them and test as a part of our test suite.

### Single secret based key pair

RFC8032 defines the Ed25519 signature scheme and a simple key derivation method based on a single 32 bytes secret. This secret could be generated from random bytes or from a BIP32 mnemonic and password.

```ts
import { Ed25519PrivateKey } from '../src/index'
import assert from 'assert';

export const readmeExample = () => {

  // You can also call `Ed25519PrivateKey.fromMnemonic`
  const privateKey = Ed25519PrivateKey.fromRandomBytes();
  const sKey = privateKey.toSigningKey();
  const vKey = sKey.toVerificationKey();

  const message = new Uint8Array([0,1,2,3,4,5,6,7,8,9]);
  const signature = sKey.sign(message);
  const isValid = vKey.verify(message, signature);

  assert(isValid);

}
```

### Hierarchical deterministic keys

You can also use full blown hierarchical deterministic keys compatible with CIP1852. This allows you to derive multiple keys from a single root key which can be generated from a mnemonic and passphrase.

```ts
import { generateMnemonic, Ed25519RootPrivateKey, KeyRole, WalletIndex, KeyIndex } from '../src/index'
import assert from 'assert';

// This example is executed as part of our test suite so we wrap it in a function ;-)
export const readmeExample = async () => {
  const mnemonic = generateMnemonic("24-words");
  const password = new TextEncoder().encode("optional password");
  const rootKey = await Ed25519RootPrivateKey.fromMnemonic(mnemonic, password);

  // Keys are derive using wallet index, role and key index.
  const walletIdx = WalletIndex.fromSmallInt(0);
  const keyIdx = KeyIndex.fromSmallInt(0);
  // "External" role is used for receiving addresses by convention.
  // "Internal" role is used for change addresses.
  const paymentIdx = KeyRole.External;

  const sKey = rootKey.deriveSigningKey(walletIdx, paymentIdx, keyIdx);
  const vKey = sKey.toVerificationKey();

  const message = new Uint8Array([0,1,2,3,4,5,6,7,8,9]);
  const signature = sKey.sign(message);
  const isValid = vKey.verify(message, signature);

  assert(isValid);
}
```

## Credits

Large portions of the key derivation code was copied and adapted from [cardan-js-sdk](https://github.com/input-output-hk/cardano-js-sdk).
