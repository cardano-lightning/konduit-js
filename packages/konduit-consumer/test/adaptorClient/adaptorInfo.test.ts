import { describe, it, expect } from "vitest";
import { AdaptorInfo, type AdaptorEd25519VerificationKey } from "../../src/adaptorClient/adaptorInfo";
import { generateMnemonic, KeyIndex, KeyRole, Ed25519RootPrivateKey, WalletIndex } from "@konduit/cardano-keys";
import { Days, Milliseconds, NormalisedDuration, Seconds } from "../../src/time/duration";
import { Ada, Address, Lovelace, Network, PubKeyHash, ScriptHash } from "../../src/cardano";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";

const mkEd25519SigningKey = async () => {
  const mnemonic = generateMnemonic("24-words");
  const rootKey = await Ed25519RootPrivateKey.fromMnemonic(mnemonic);
  return rootKey.deriveSigningKey(WalletIndex.fromSmallInt(0), KeyRole.External, KeyIndex.fromSmallInt(0))
}


describe("AdaptorInfo serialization/deserialization", () => {
  const createValidAdaptorInfo = async () => {
    const adaptorEd25519VerificationKey = (await mkEd25519SigningKey()).toVerificationKey() as AdaptorEd25519VerificationKey;
    const closePeriodMs = Milliseconds.fromNormalisedDuration(NormalisedDuration.fromComponentsNormalization({ days: Days.fromSmallNumber(2) }));
    const closePeriod = Seconds.fromMillisecondsFloor(closePeriodMs);

    const fee = Lovelace.fromAda(Ada.fromSmallNumber(1));
    const maxTagLength = NonNegativeInt.fromSmallNumber(64);
    const deployerVkey = (await mkEd25519SigningKey()).toVerificationKey();
    const deployerAddress = {
      network: Network.TESTNET,
      paymentCredential: {
        type: "PubKeyHash",
        hash: PubKeyHash.fromPubKey(deployerVkey.key),
      },
    } as Address;
    const scriptHash = new Uint8Array(28).fill(3) as ScriptHash;
    return new AdaptorInfo(
      adaptorEd25519VerificationKey,
      closePeriod,
      fee,
      maxTagLength,
      deployerAddress,
      scriptHash,
    );
  };

  it("should successfully roundtrip serialize and deserialize", async () => {
    const original = await createValidAdaptorInfo();
    const serialised = original.serialise();
    const result = AdaptorInfo.deserialise(serialised);
    result.match(
      (deserialised: AdaptorInfo) => {
        expect(deserialised.adaptorEd25519VerificationKey.key).toStrictEqual(original.adaptorEd25519VerificationKey.key);
        expect(deserialised.closePeriod).toBe(original.closePeriod);
        expect(deserialised.fee).toBe(original.fee);
        expect(deserialised.maxTagLength).toBe(original.maxTagLength);
        expect(deserialised.referenceScriptHostAddress).toEqual(original.referenceScriptHostAddress);
        expect(deserialised.konduitScriptHash).toEqual(original.konduitScriptHash);
      },
      (err: any) => {
        throw new Error(`Deserialization failed: ${JSON.stringify(err, null, 2)}`);
      }
    );
  });

});
