import * as hexString from "./hexString";
import type { HexString } from "./hexString";
import type { JsonCodec, JsonError } from "./json/codecs";
import { lmap, pipe, rmap, type Codec } from "./codec";
import { err, ok, Result } from "neverthrow";
import type { Cbor } from "./cbor/core";
import { cbor2ByteStringCodec } from "./cbor/codecs/sync";

// Uint8Array to Tagged Uint8Array Codec with validation. The tag is optional and only used for error messages.
export const mkTaggedUint8ArrayCodec = <T>(tag: string, validate: (arr: Uint8Array) => boolean): Codec<Uint8Array, T, JsonError> => {
  return {
    deserialise: (arr: Uint8Array): Result<T, JsonError> => {
      if (!validate(arr)) {
        if(tag) {
          return err(`Uint8Array validation failed for tagged type ${tag}`);
        }
        return err("Uint8Array validation failed for tagged type");
      }
      return ok(arr as unknown as T);
    },
    serialise: (tagged: T): Uint8Array => {
      return tagged as unknown as Uint8Array;
    }
  };
};

export const mkTaggedHexStringCodec = <T>(tag: string, validate: (arr: Uint8Array) => boolean): Codec<HexString, T, JsonError> => {
  return lmap(
    mkTaggedUint8ArrayCodec(tag, validate),
    hexString.toUint8Array,
    hexString.fromUint8Array,
  );
}

export const jsonCodec: JsonCodec<Uint8Array> = rmap(hexString.jsonCodec, hexString.toUint8Array, hexString.fromUint8Array);

export const mkTaggedJsonCodec = <T>(tag: string, validate: (arr: Uint8Array) => boolean): JsonCodec<T> => {
  return pipe(
    hexString.jsonCodec,
    mkTaggedHexStringCodec<T>(tag, validate)
  );
};

export const mkTaggedCborCodec = <T>(tag: string, validate: (arr: Uint8Array) => boolean): Codec<Cbor, T, JsonError> => {
  return pipe(
    cbor2ByteStringCodec,
    mkTaggedUint8ArrayCodec<T>(tag, validate),
  );
}
