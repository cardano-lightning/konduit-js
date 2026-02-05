import * as codec from "@konduit/codec";
import type { Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2MillisecondsCodec, type Milliseconds } from "../time/duration";
import type { VKey } from "@konduit/cardano-keys";
import { json2LovelaceCodec, json2ScriptHashCodec, type Lovelace, type ScriptHash } from "../cardano";
import { json2NonNegativeIntCodec, type NonNegativeInt } from "@konduit/codec/integers/smallish";
import { json2VKeyCodec } from "../cardano";
import type { Json } from "@konduit/codec/json";
import * as http from "../http";
import { Tagged } from "type-fest";

export type AdaptorVKey = Tagged<VKey, "AdaptorVKey">;

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
  adaptorVKey: AdaptorVKey;

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
  deployerVkey: VKey;

  /**
   * The script hash.
   * @type {Uint8Array}
   */
  scriptHash: ScriptHash;

  constructor(
    adaptorVKey: VKey,
    closePeriod: Milliseconds,
    fee: Lovelace,
    maxTagLength: NonNegativeInt,
    deployerVkey: VKey,
    scriptHash: ScriptHash,
  ) {
    this.adaptorVKey = adaptorVKey;
    this.closePeriod = closePeriod;
    this.fee = fee;
    this.maxTagLength = maxTagLength;
    this.deployerVkey = deployerVkey;
    this.scriptHash = scriptHash;
  }

  static async fromAdaptorUrl(baseUrl: string): Promise<Result<AdaptorInfo, http.GetDeserialiseError>> {
    let infoUrl = `${baseUrl}/info`;
    return http.getDeserialise(infoUrl, json2AdaptorInfoCodec.deserialise);
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
    adaptor_vkey: json2VKeyCodec,
    close_period: json2MillisecondsCodec,
    fee: json2LovelaceCodec,
    max_tag_length: json2NonNegativeIntCodec,
    deployer_vkey: json2VKeyCodec,
    script_hash: json2ScriptHashCodec,
  });
  return codec.rmap(
    adaptorRecordCodec,
    (obj) =>
      new AdaptorInfo(
        obj.adaptor_vkey,
        obj.close_period,
        obj.fee,
        obj.max_tag_length,
        obj.deployer_vkey,
        obj.script_hash,
      ),
    (adaptorInfo) => ({
      adaptor_vkey: adaptorInfo.adaptorVKey,
      close_period: adaptorInfo.closePeriod,
      fee: adaptorInfo.fee,
      max_tag_length: adaptorInfo.maxTagLength,
      deployer_vkey: adaptorInfo.deployerVkey,
      script_hash: adaptorInfo.scriptHash,
    }),
  );
})();
