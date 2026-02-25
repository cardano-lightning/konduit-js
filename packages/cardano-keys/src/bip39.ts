import type { Tagged } from "type-fest";
import * as english from "@scure/bip39/wordlists/english.js";
import * as bip39 from "@scure/bip39"; // Assuming you"re using bip39 for mnemonicToEntropy
import { err, ok, type Result } from "neverthrow";

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
type _Mnemonic = { mnemonicWords: string, wordlist: string[] };
export type Mnemonic = Tagged<_Mnemonic, "Mnemonic">;
export namespace Mnemonic {
  export function fromString(mnemonic: string, wordlist: string[] = english.wordlist): Result<Mnemonic, string> {
    return bip39.validateMnemonic(mnemonic, wordlist)
      ? ok({ mnemonicWords: mnemonic, wordlist } as Mnemonic)
      : err("Invalid mnemonic");
  }
}

export function generateMnemonic(strength: MnemonicStrength = "24-words", wordlist: string[] = english.wordlist): Mnemonic {
  const strengthInBits = strengthWordsToBits(strength);
  return { mnemonicWords: bip39.generateMnemonic(wordlist, strengthInBits), wordlist } as Mnemonic;
}

export type Uint8Array32 = Tagged<Uint8Array, "Uint8Array32">;

export const mnemonicToEntropy = (mnemonic: Mnemonic): Uint8Array32 => {
  const { mnemonicWords, wordlist } = mnemonic;
  const entropy = bip39.mnemonicToEntropy(mnemonicWords, wordlist);
  return Uint8Array.from(entropy) as any as Uint8Array32;
}

export type Uint8Array64 = Tagged<Uint8Array, "Uint8Array64">;

export const mnemonicToSeed = (mnemonic: Mnemonic, passphrase: string = ""): Uint8Array64 => {
  const { mnemonicWords } = mnemonic;
  const seed = bip39.mnemonicToSeedSync(mnemonicWords, passphrase);
  return Uint8Array.from(seed) as any as Uint8Array64;
}
