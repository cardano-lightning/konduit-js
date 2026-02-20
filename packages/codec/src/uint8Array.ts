import * as hexString from "./hexString";
import type { HexString } from "./hexString";
import type { JsonCodec, JsonError } from "./json/codecs";
import { lmap, pipe, rmap, type Codec } from "./codec";
import { err, ok, Result } from "neverthrow";
import type { Cbor } from "./cbor/core";
import { cbor2ByteStringCodec } from "./cbor/codecs/sync";
import * as base64String from "./base64String";

// Uint8Array to Tagged Uint8Array Codec with validation. The tag is optional and only used for error messages.
export const mkTaggedUint8ArrayCodec = <T>(tag: string, validate: (arr: Uint8Array) => boolean): Codec<Uint8Array, T, JsonError> => {
  return {
    deserialise: (arr: Uint8Array): Result<T, JsonError> => {
      if (!validate(arr)) {
        if(tag) {
          return err(`Uint8Array validation failed for tagged type ${tag}. Value parsed: ${hexString.fromUint8Array(arr)}, value length: ${arr.length}`);
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


export const json2Uint8ArrayThroughBase64Codec = rmap(
  base64String.jsonCodec,
  base64String.toUint8Array,
  base64String.fromUint8Array,
);

export const mkTaggedCborCodec = <T>(tag: string, validate: (arr: Uint8Array) => boolean): Codec<Cbor, T, JsonError> => {
  return pipe(
    cbor2ByteStringCodec,
    mkTaggedUint8ArrayCodec<T>(tag, validate),
  );
}

export const concat = (arrays: Uint8Array[]): Uint8Array => {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

export const writeUInt32LE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset, arr.byteLength).setUint32(offset, value, true);
}

export const writeUInt8 = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset, arr.byteLength).setUint8(offset, value);
}

export const equal = (a: Uint8Array, b: Uint8Array): boolean => {
  const equals = true;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) {
      return false;
    }
  }
  return equals;
}

export const alloc = (size: number): Uint8Array => {
  return new Uint8Array(size);
};

export const toUtf8 = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

export const fromUtf8 = (arr: Uint8Array): string => {
  return new TextDecoder("utf-8", { fatal: false }).decode(arr);
};

export const readUInt16BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 2).getUint16(0, false);
};

export const writeUInt16BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 2).setUint16(0, value, false);
};

export const readUInt32BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 4).getUint32(0, false);
};

export const writeUInt32BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 4).setUint32(0, value, false);
};

export const readFloat32BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 4).getFloat32(0, false);
};

export const writeFloat32BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 4).setFloat32(0, value, false);
};

export const readFloat64BE = (arr: Uint8Array, offset: number): number => {
  return new DataView(arr.buffer, arr.byteOffset + offset, 8).getFloat64(0, false);
};

export const writeFloat64BE = (arr: Uint8Array, value: number, offset: number): void => {
  new DataView(arr.buffer, arr.byteOffset + offset, 8).setFloat64(0, value, false);
};
