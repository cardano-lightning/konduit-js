import * as hexString from "./hexString";
import type { HexString } from "./hexString";
import type { JsonCodec, JsonError } from "./json/codecs";
import { pipe, type Codec } from "./codec";
import { err, ok, Result } from "neverthrow";

// Serialisation/Deserialisation to a typed hex string
// Given already validated hex string serialised as HexString
export const fromHexString = (hexStr: HexString): Uint8Array => {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    const byteStr = hexStr.slice(i, i + 2);
    const byte = Number.parseInt(byteStr, 16);
    bytes[i / 2] = byte;
  }
  return bytes;
}

export const toHexString = (arr: Uint8Array): HexString => {
  let str = "";
  for (let i = 0; i < arr.length; i++) {
    const byte = arr[i];
    str += byte.toString(16).padStart(2, '0');
  }
  return str as HexString;
}

// `HexString` is an intermediate representation for Uint8Array.
// It is useful to separate the codecs.
export const hexStringCodec: Codec<HexString, Uint8Array, JsonError> = {
  deserialise: (hexStr: HexString) => ok(fromHexString(hexStr)),
  serialise: (arr: Uint8Array) => toHexString(arr)
}

export const mkTaggedHexStringCodec = <T>(validate: (arr: Uint8Array) => boolean, tag: string | null = null): Codec<HexString, T, JsonError> => {
  return pipe(
    hexStringCodec,
    {
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
    }
  );
}

export const jsonCodec: JsonCodec<Uint8Array> = pipe(hexString.jsonCodec, hexStringCodec);

export const mkTaggedJsonCodec = <T>(validate: (arr: Uint8Array) => boolean, tag: string | null = null): JsonCodec<T> => {
  return pipe(
    hexString.jsonCodec,
    mkTaggedHexStringCodec<T>(validate, tag)
  );
};
