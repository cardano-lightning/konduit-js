import { describe, it, expect } from "vitest";
import { AdaptorInfo, AdaptorVKey } from "../../src/adaptorClient/adaptorInfo";
import { generateMnemonic, KeyIndex, KeyRole, RootPrivateKey, WalletIndex } from "@konduit/cardano-keys";
import { Days, Milliseconds, NormalisedDuration } from "../../src/time/duration";
import { Ada, Lovelace, ScriptHash } from "../../src/cardano";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { HexString } from "@konduit/codec/hexString";

const mkSKey = async () => {
  const mnemonic = generateMnemonic("24-words");
  const rootKey = await RootPrivateKey.fromMnemonic(mnemonic);
  return rootKey.deriveSKey(WalletIndex.fromSmallInt(0), KeyRole.External, KeyIndex.fromSmallInt(0))
}


describe("AdaptorInfo serialization/deserialization", () => {
  const createValidAdaptorInfo = async () => {
    const adaptorVKey = (await mkSKey()).toVKey() as AdaptorVKey;
    const closePeriod = Milliseconds.fromNormalisedDuration(NormalisedDuration.fromComponentsNormalization({ days: Days.fromSmallNumber(2) }));
    const fee = Lovelace.fromAda(Ada.fromSmallNumber(1));
    const maxTagLength = NonNegativeInt.fromSmallNumber(64);
    const deployerVkey = (await mkSKey()).toVKey();
    const scriptHash = new Uint8Array(28).fill(3) as ScriptHash;

    return new AdaptorInfo(
      adaptorVKey,
      closePeriod,
      fee,
      maxTagLength,
      deployerVkey,
      scriptHash,
    );
  };

  it("should successfully roundtrip serialize and deserialize", async () => {
    const original = await createValidAdaptorInfo();
    const serialised = original.serialise();
    const result = AdaptorInfo.deserialise(serialised);
    result.match(
      (deserialised: AdaptorInfo) => {
        expect(deserialised.adaptorVKey.getKey()).toStrictEqual(original.adaptorVKey.getKey());
        expect(deserialised.closePeriod).toBe(original.closePeriod);
        expect(deserialised.fee).toBe(original.fee);
        expect(deserialised.maxTagLength).toBe(original.maxTagLength);
        expect(deserialised.deployerVkey.getKey()).toEqual(original.deployerVkey.getKey());
        expect(deserialised.scriptHash).toEqual(original.scriptHash);
      },
      (err: any) => {
        throw new Error(`Deserialization failed: ${JSON.stringify(err, null, 2)}`);
      }
    );
  });

  it("should serialize to hex strings", async () => {
    const adaptorInfo = await createValidAdaptorInfo();
    const serialised = adaptorInfo.serialise();

    expect(typeof serialised["adaptor_vkey"]).toBe("string");
    expect(typeof serialised["deployer_vkey"]).toBe("string");
    expect(typeof serialised["script_hash"]).toBe("string");

    // Using node buffer for testing here as a shortcut
    expect(serialised["adaptor_vkey"]).toBe(HexString.fromUint8Array(adaptorInfo.adaptorVKey.getKey()));
    expect(serialised["deployer_vkey"]).toBe(HexString.fromUint8Array(adaptorInfo.deployerVkey.getKey()));
    expect(serialised["script_hash"]).toBe(HexString.fromUint8Array(adaptorInfo.scriptHash));
  });

  it("should serialize to correct snake_case format", async () => {
    const info = await createValidAdaptorInfo();
    const serialised = info.serialise();

    expect(serialised).toHaveProperty("adaptor_vkey");
    expect(serialised).toHaveProperty("close_period");
    expect(serialised).toHaveProperty("fee");
    expect(serialised).toHaveProperty("max_tag_length");
    expect(serialised).toHaveProperty("deployer_vkey");
    expect(serialised).toHaveProperty("script_hash");

    expect(typeof serialised["adaptor_vkey"]).toBe("string");
    expect(typeof serialised["close_period"]).toBe("bigint");
    expect(typeof serialised["fee"]).toBe("bigint");
    expect(typeof serialised["max_tag_length"]).toBe("bigint");
    expect(typeof serialised["deployer_vkey"]).toBe("string");
    expect(typeof serialised["script_hash"]).toBe("string");

    expect(serialised["adaptor_vkey"]).toBe(HexString.fromUint8Array(info.adaptorVKey.getKey()));
    expect(serialised["close_period"]).toBe(BigInt(info.closePeriod));
    expect(serialised["fee"]).toBe(info.fee);
    expect(serialised["max_tag_length"]).toBe(BigInt(info.maxTagLength));
    expect(serialised["deployer_vkey"]).toBe(HexString.fromUint8Array(info.deployerVkey.getKey()));
    expect(serialised["script_hash"]).toBe(HexString.fromUint8Array(info.scriptHash));
  });
});
