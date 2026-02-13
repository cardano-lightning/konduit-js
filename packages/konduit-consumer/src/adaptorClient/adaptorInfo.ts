import * as codec from "@konduit/codec";
import type { Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2MillisecondsCodec, type Milliseconds } from "../time/duration";
import type { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { json2LovelaceCodec, json2ScriptHashCodec, type Lovelace, type ScriptHash } from "../cardano";
import { json2NonNegativeIntCodec, type NonNegativeInt } from "@konduit/codec/integers/smallish";
import { json2Ed25519VerificationKeyCodec } from "../cardano";
import type { Json } from "@konduit/codec/json";
import { Tagged } from "type-fest";

// Created from info endpoint or deserialisation
export type AdaptorEd25519VerificationKey = Tagged<Ed25519VerificationKey, "AdaptorEd25519VerificationKey">;
export const json2AdaptorEd25519VerificationKeyCodec = json2Ed25519VerificationKeyCodec as jsonCodecs.JsonCodec<AdaptorEd25519VerificationKey>;

/**
 * Holds configuration information for an adaptor.
 *
 * This class stores data using camelCase properties (e.g., `adaptorKey`)
 * but serialises to and deserialises from a snake_case object
 * (e.g., `adaptor_key`) as specified.
 */
export class AdaptorInfo {
  /**
   * The adaptor's public key.
   * @type {Uint8Array}
   */
  adaptorEd25519VerificationKey: AdaptorEd25519VerificationKey;

  /**
   * The close period.
   * @type {number}
   */
  closePeriod: Milliseconds;

  /**
   * The fee.
   * @type {number}
   */
  fee: Lovelace;

  /**
   * The maximum tag length.
   * @type {number}
   */
  maxTagLength: NonNegativeInt;

  /* FIXME: Do we really need this information?
   */
  deployerVkey: Ed25519VerificationKey;

  /**
   * The script hash.
   * @type {Uint8Array}
   */
  scriptHash: ScriptHash;

  constructor(
    adaptorEd25519VerificationKey: AdaptorEd25519VerificationKey,
    closePeriod: Milliseconds,
    fee: Lovelace,
    maxTagLength: NonNegativeInt,
    deployerVkey: Ed25519VerificationKey,
    scriptHash: ScriptHash,
  ) {
    this.adaptorEd25519VerificationKey = adaptorEd25519VerificationKey;
    this.closePeriod = closePeriod;
    this.fee = fee;
    this.maxTagLength = maxTagLength;
    this.deployerVkey = deployerVkey;
    this.scriptHash = scriptHash;
  }

  static deserialise(json: Json): Result<AdaptorInfo, jsonCodecs.JsonError> {
    return json2AdaptorInfoCodec.deserialise(json);
  }

  serialise(): Json {
    return json2AdaptorInfoCodec.serialise(this);
  }

}

export const json2AdaptorInfoCodec: jsonCodecs.JsonCodec<AdaptorInfo> = (() => {
  // Define the intermediate codec for the snake_case object returned by the API
  // We will use it also as serialisation format.
  let adaptorRecordCodec = jsonCodecs.objectOf({
    adaptor_key: json2Ed25519VerificationKeyCodec,
    close_period: json2MillisecondsCodec,
    fee: json2LovelaceCodec,
    max_tag_length: json2NonNegativeIntCodec,
    deployer_vkey: json2Ed25519VerificationKeyCodec,
    script_hash: json2ScriptHashCodec,
  });
  return codec.rmap(
    adaptorRecordCodec,
    (obj) =>
      new AdaptorInfo(
        obj.adaptor_key as AdaptorEd25519VerificationKey,
        obj.close_period,
        obj.fee,
        obj.max_tag_length,
        obj.deployer_vkey,
        obj.script_hash,
      ),
    (adaptorInfo) => ({
      adaptor_key: adaptorInfo.adaptorEd25519VerificationKey,
      close_period: adaptorInfo.closePeriod,
      fee: adaptorInfo.fee,
      max_tag_length: adaptorInfo.maxTagLength,
      deployer_vkey: adaptorInfo.deployerVkey,
      script_hash: adaptorInfo.scriptHash,
    }),
  );
})();
