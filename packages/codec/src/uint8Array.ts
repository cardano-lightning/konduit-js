import * as hexString from "./hexString";
import type { HexString } from "./hexString";
import type { JsonCodec, JsonError } from "./json/codecs";
import { lmap, pipe, rmap, type Codec } from "./codec";
import { err, ok, Result } from "neverthrow";

export const mkTaggedHexStringCodec = <T>(validate: (arr: Uint8Array) => boolean, tag: string | null = null): Codec<HexString, T, JsonError> => {
  return lmap({
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
    },
    hexString.toUint8Array,
    hexString.fromUint8Array,
  );
}

export const jsonCodec: JsonCodec<Uint8Array> = rmap(hexString.jsonCodec, hexString.toUint8Array, hexString.fromUint8Array);

export const mkTaggedJsonCodec = <T>(validate: (arr: Uint8Array) => boolean, tag: string | null = null): JsonCodec<T> => {
  return pipe(
    hexString.jsonCodec,
    mkTaggedHexStringCodec<T>(validate, tag)
  );
};
