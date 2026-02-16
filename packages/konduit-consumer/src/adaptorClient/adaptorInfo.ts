import * as codec from "@konduit/codec";
import type { Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2SecondsCodec, Seconds } from "../time/duration";
import type { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { Address, json2AddressCodec, json2LovelaceCodec, json2ScriptHashCodec, type Lovelace, type ScriptHash } from "../cardano";
import { json2NonNegativeIntCodec, type NonNegativeInt } from "@konduit/codec/integers/smallish";
import { json2Ed25519VerificationKeyCodec } from "../cardano";
import type { Json } from "@konduit/codec/json";
import type { Tagged } from "type-fest";

// Created from info endpoint or deserialisation
export type AdaptorEd25519VerificationKey = Tagged<Ed25519VerificationKey, "AdaptorEd25519VerificationKey">;
export const json2AdaptorEd25519VerificationKeyCodec = codec.rmap(
  json2Ed25519VerificationKeyCodec,
  (key) => key as AdaptorEd25519VerificationKey,
  (aKey) => aKey
)

export class AdaptorInfo {
  adaptorEd25519VerificationKey: AdaptorEd25519VerificationKey;
  closePeriod: Seconds;
  fee: Lovelace;
  maxTagLength: NonNegativeInt;
  referenceScriptHostAddress: Address;
  konduitScriptHash: ScriptHash;

  constructor(
    adaptorEd25519VerificationKey: AdaptorEd25519VerificationKey,
    closePeriod: Seconds,
    fee: Lovelace,
    maxTagLength: NonNegativeInt,
    referenceScriptHostAddress: Address,
    konduitScriptHash: ScriptHash,
  ) {
    this.adaptorEd25519VerificationKey = adaptorEd25519VerificationKey;
    this.closePeriod = closePeriod;
    this.fee = fee;
    this.maxTagLength = maxTagLength;
    this.referenceScriptHostAddress = referenceScriptHostAddress;
    this.konduitScriptHash = konduitScriptHash;
  }

  static deserialise(json: Json): Result<AdaptorInfo, jsonCodecs.JsonError> {
    return json2AdaptorInfoCodec.deserialise(json);
  }

  serialise(): Json {
    return json2AdaptorInfoCodec.serialise(this);
  }

}

export const json2AdaptorInfoCodec: jsonCodecs.JsonCodec<AdaptorInfo> = (() => {
  let adaptorRecordCodec = jsonCodecs.objectOf({
    "tos": jsonCodecs.objectOf({
      "flat_fee": json2LovelaceCodec,
    }),
    "channel_parameters": jsonCodecs.objectOf({
      adaptor_key: json2AdaptorEd25519VerificationKeyCodec,
      close_period: jsonCodecs.objectOf({
        secs: json2SecondsCodec,
      }),
      tag_length: json2NonNegativeIntCodec,
    }),
    "tx_help": jsonCodecs.objectOf({
      host_address: json2AddressCodec,
      validator: json2ScriptHashCodec,
    }),
  });

  return codec.rmap(
    adaptorRecordCodec,
    (obj) =>
      new AdaptorInfo(
        obj.channel_parameters.adaptor_key,
        obj.channel_parameters.close_period.secs,
        obj.tos.flat_fee,
        obj.channel_parameters.tag_length,
        obj.tx_help.host_address,
        obj.tx_help.validator,
      ),
    (adaptorInfo) => ({
      tos: {
        flat_fee: adaptorInfo.fee,
      },
      channel_parameters: {
        adaptor_key: adaptorInfo.adaptorEd25519VerificationKey,
        close_period: {
          secs: adaptorInfo.closePeriod,
          nanos: 0,
        },
        tag_length: adaptorInfo.maxTagLength,
      },
      tx_help: {
        host_address: adaptorInfo.referenceScriptHostAddress,
        validator: adaptorInfo.konduitScriptHash,
      },
    }),
  );
})();
