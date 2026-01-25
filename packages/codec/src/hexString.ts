import { err, ok, type Result } from "neverthrow";
import type { Tagged } from 'type-fest';
import type { Json } from "./json";
import type { JsonCodec } from "./json/codecs";

// String which is a valid hex representation
export type HexString = Tagged<string, "HexString">;

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

