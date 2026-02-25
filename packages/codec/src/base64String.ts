import { err, ok, type Result } from "neverthrow";
import type { Tagged } from 'type-fest';
import type { Json } from "./json";
import type { JsonCodec } from "./json/codecs";

// String which is a valid base64 representation
export type Base64String = Tagged<string, "Base64String">;
export namespace Base64String {
  export const unsafeFromString = (str: string): Base64String => str as Base64String;
  export const fromString = (str: string): Result<Base64String, string> => {
    // Base64 regex: alphanumeric + / and +, with optional = padding at the end
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

    if (!base64Regex.test(str)) {
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (!/[A-Za-z0-9+/=]/.test(char)) {
          return err(`Invalid character '${char}' at position ${i}`);
        }
      }
      return err(`Invalid base64 format`);
    }

    // Validate padding rules
    const firstEq = str.indexOf('=');
    if (firstEq !== -1) {
      const lastEq = str.lastIndexOf('=');
      const paddingCount = str.length - firstEq;

      // '=' can only appear in the last 2 positions and must be contiguous
      if (firstEq < str.length - 2) {
        return err(`Invalid padding: '=' can only appear in the last two characters`);
      }
      if (paddingCount > 2 || (lastEq !== str.length - 1 && lastEq !== str.length - 2)) {
        return err(`Invalid padding: too many '=' characters or non-contiguous padding`);
      }
    }

    // Now check length: if padded, length must be multiple of 4
    if (str.includes('=') && str.length % 4 !== 0) {
      return err(`Invalid padding: base64 string with padding must have length divisible by 4, got ${str.length}`);
    }

    return ok(str as Base64String);
  }

  export const fromUint8Array = (arr: Uint8Array): Base64String => {
    // Use native btoa with binary string conversion
    const binaryString = String.fromCharCode(...arr);
    return btoa(binaryString) as Base64String;
  }
};

// Serialisation/Deserialisation to a typed base64 string
// Given already validated base64 string serialised as Base64String
export const toUint8Array = (base64Str: Base64String): Uint8Array => {
  // Use native atob to decode
  const binaryString = atob(base64Str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const fromUint8Array = (arr: Uint8Array): Base64String => Base64String.fromUint8Array(arr);

export const jsonCodec: JsonCodec<Base64String> = {
  deserialise: (data: Json): Result<Base64String, string> => {
    if (typeof data !== "string") {
      return err(`Invalid type: expected string but got ${typeof data}`);
    }
    return Base64String.fromString(data);
  },
  serialise: (base64Str: Base64String): Json => {
    return base64Str;
  }
};
