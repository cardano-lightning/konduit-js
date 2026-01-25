import { err, ok, type Result } from "neverthrow";
import type { Tagged } from 'type-fest';
import type { Json } from "./json";
import type { JsonCodec } from "./json/codecs";

// String which is a valid hex representation
export type HexString = Tagged<string, "HexString">;
export namespace HexString {
  export const fromUint8Array = (arr: Uint8Array): HexString => {
    let str = "";
    for (let i = 0; i < arr.length; i++) {
      const byte = arr[i];
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

export const jsonCodec: JsonCodec<HexString> = {
  deserialise: (data: Json): Result<HexString, string> => {
    if (typeof data !== "string") {
      return err(`Invalid type: expected string but got ${typeof data}`);
    }
    const str = data as string;
    const hexRegex = /^[0-9a-fA-F]*$/;
    if (str.length % 2 !== 0) {
      return err(`Invalid length: expected even length but got ${str.length}`);
    }
    if (!hexRegex.test(str)) {
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (!hexRegex.test(char)) {
          return err(`Invalid character '${char}' at position ${i}`);
        }
      }
    }
    return ok(str as HexString);
  },
  serialise: (hexStr: HexString): Json => {
    return hexStr;
  }
};

