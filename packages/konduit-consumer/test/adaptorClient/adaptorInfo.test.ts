// import { describe, it, expect } from "vitest";
// import { AdaptorInfo, AdaptorEd25519VerificationKey } from "../../src/adaptorClient/adaptorInfo";
// import { generateMnemonic, KeyIndex, KeyRole, Ed25519RootPrivateKey, WalletIndex } from "@konduit/cardano-keys";
// import { Days, Milliseconds, NormalisedDuration } from "../../src/time/duration";
// import { Ada, Lovelace, ScriptHash } from "../../src/cardano";
// import { NonNegativeInt } from "@konduit/codec/integers/smallish";
// import { HexString } from "@konduit/codec/hexString";
// 
// const mkEd25519SigningKey = async () => {
//   const mnemonic = generateMnemonic("24-words");
//   const rootKey = await Ed25519RootPrivateKey.fromMnemonic(mnemonic);
//   return rootKey.deriveSigningKey(WalletIndex.fromSmallInt(0), KeyRole.External, KeyIndex.fromSmallInt(0))
// }
// 
// 
// describe("AdaptorInfo serialization/deserialization", () => {
//   const createValidAdaptorInfo = async () => {
//     const adaptorEd25519VerificationKey = (await mkEd25519SigningKey()).toVerificationKey() as AdaptorEd25519VerificationKey;
//     const closePeriod = Milliseconds.fromNormalisedDuration(NormalisedDuration.fromComponentsNormalization({ days: Days.fromSmallNumber(2) }));
//     const fee = Lovelace.fromAda(Ada.fromSmallNumber(1));
//     const maxTagLength = NonNegativeInt.fromSmallNumber(64);
//     const deployerVkey = (await mkEd25519SigningKey()).toVerificationKey();
//     const scriptHash = new Uint8Array(28).fill(3) as ScriptHash;
// 
//     return new AdaptorInfo(
//       adaptorEd25519VerificationKey,
//       closePeriod,
//       fee,
//       maxTagLength,
//       deployerVkey,
//       scriptHash,
//     );
//   };
// 
//   it("should successfully roundtrip serialize and deserialize", async () => {
//     const original = await createValidAdaptorInfo();
//     const serialised = original.serialise();
//     const result = AdaptorInfo.deserialise(serialised);
//     result.match(
//       (deserialised: AdaptorInfo) => {
//         expect(deserialised.adaptorEd25519VerificationKey.key).toStrictEqual(original.adaptorEd25519VerificationKey.key);
//         expect(deserialised.closePeriod).toBe(original.closePeriod);
//         expect(deserialised.fee).toBe(original.fee);
//         expect(deserialised.maxTagLength).toBe(original.maxTagLength);
//         expect(deserialised.deployerVkey.key).toEqual(original.deployerVkey.key);
//         expect(deserialised.scriptHash).toEqual(original.scriptHash);
//       },
//       (err: any) => {
//         throw new Error(`Deserialization failed: ${JSON.stringify(err, null, 2)}`);
//       }
//     );
//   });
// 
//   it("should serialize to hex strings", async () => {
//     const adaptorInfo = await createValidAdaptorInfo();
//     const serialised = adaptorInfo.serialise();
// 
//     expect(typeof serialised["adaptor_key"]).toBe("string");
//     expect(typeof serialised["deployer_vkey"]).toBe("string");
//     expect(typeof serialised["script_hash"]).toBe("string");
// 
//     // Using node buffer for testing here as a shortcut
//     expect(serialised["adaptor_key"]).toBe(HexString.fromUint8Array(adaptorInfo.adaptorEd25519VerificationKey.key));
//     expect(serialised["deployer_vkey"]).toBe(HexString.fromUint8Array(adaptorInfo.deployerVkey.key));
//     expect(serialised["script_hash"]).toBe(HexString.fromUint8Array(adaptorInfo.scriptHash));
//   });
// 
//   it("should serialize to correct snake_case format", async () => {
//     const info = await createValidAdaptorInfo();
//     const serialised = info.serialise();
// 
//     expect(serialised).toHaveProperty("adaptor_key");
//     expect(serialised).toHaveProperty("close_period");
//     expect(serialised).toHaveProperty("fee");
//     expect(serialised).toHaveProperty("max_tag_length");
//     expect(serialised).toHaveProperty("deployer_vkey");
//     expect(serialised).toHaveProperty("script_hash");
// 
//     expect(typeof serialised["adaptor_key"]).toBe("string");
//     expect(typeof serialised["close_period"]).toBe("bigint");
//     expect(typeof serialised["fee"]).toBe("bigint");
//     expect(typeof serialised["max_tag_length"]).toBe("bigint");
//     expect(typeof serialised["deployer_vkey"]).toBe("string");
//     expect(typeof serialised["script_hash"]).toBe("string");
// 
//     expect(serialised["adaptor_key"]).toBe(HexString.fromUint8Array(info.adaptorEd25519VerificationKey.key));
//     expect(serialised["close_period"]).toBe(BigInt(info.closePeriod));
//     expect(serialised["fee"]).toBe(info.fee);
//     expect(serialised["max_tag_length"]).toBe(BigInt(info.maxTagLength));
//     expect(serialised["deployer_vkey"]).toBe(HexString.fromUint8Array(info.deployerVkey.key));
//     expect(serialised["script_hash"]).toBe(HexString.fromUint8Array(info.scriptHash));
//   });
// });
