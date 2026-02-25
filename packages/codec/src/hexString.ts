import { err, ok, type Result } from "neverthrow";
import type { Tagged } from 'type-fest';
import type { JsonCodec, JsonError } from "./json/codecs";
import type { Codec } from "./codec";

// String which is a valid hex representation
export type HexString = Tagged<string, "HexString">;
export namespace HexString {
  export const unsafeFromString = (str: string): HexString => str as HexString;
  export const fromString = (str: string): Result<HexString, JsonError> => {
    const hexRegex = /^[0-9a-fA-F]*$/;
    if (str.length % 2 !== 0) {
      return err(`Invalid length: expected even length but got ${str.length}`);
    }
    if (!hexRegex.test(str)) {
      let errors: string[] = [];
      // Safe loop through enumeration
      str.split('').forEach((char, i) => {
        if (!hexRegex.test(char)) {
          errors.push(`Invalid character '${char}' at position ${i}`);
        }
      });
      if (errors.length > 0) {
        return err(errors);
      }
    }
    return ok(str as HexString);
  }
  export const fromUint8Array = (arr: Uint8Array): HexString => {
    let str = "";
    for (const byte of arr) {
      str += byte.toString(16).padStart(2, '0');
    }
    return str as HexString;
  }
};

// Serialisation/Deserialisation to a typed hex string
// Given already validated hex string serialised as HexString
export const toUint8Array = (hexStr: HexString): Uint8Array => {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    const byteStr = hexStr.slice(i, i + 2);
    const byte = Number.parseInt(byteStr, 16);
    bytes[i / 2] = byte;
  }
  return bytes;
}

export const fromUint8Array = (arr: Uint8Array): HexString => HexString.fromUint8Array(arr);

export const stringCodec: Codec<string, HexString, JsonError> = {
  deserialise: (data: string): Result<HexString, JsonError> => {
    if (typeof data !== "string") {
      return err(`Invalid type: expected string but got ${typeof data}`);
    }
    return HexString.fromString(data);
  },
  serialise: (hexStr: HexString): string => {
    return hexStr;
  }
};
export const jsonCodec: JsonCodec<HexString> = stringCodec as JsonCodec<HexString>;
