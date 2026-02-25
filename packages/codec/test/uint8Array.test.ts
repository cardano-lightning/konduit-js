import { describe, it, expect } from 'vitest';
import type { Tagged } from 'type-fest';
import * as uint8Array from '../src/uint8Array';
import { type Json, parse, stringify } from '../src/json';
import type { JsonCodec } from '../src/json/codecs';
import { unwrapErr, unwrapErrWithSubstring, unwrapOk } from './assertions';

// SHA-256 produces 32 bytes (256 bits / 8)
type Sha256 = Tagged<Uint8Array, "Sha256">;

const validateSha256 = (arr: Uint8Array): boolean => {
  return arr.length === 32;
};

const sha256Codec: JsonCodec<Sha256> = uint8Array.mkTaggedJsonCodec<Sha256>("Sha256", validateSha256);

describe('Uint8Array codec', () => {
  describe('basic Uint8Array encoding/decoding', () => {
    it('should encode empty Uint8Array', () => {
      const arr = new Uint8Array([]);
      const json = uint8Array.jsonCodec.serialise(arr);
      expect(json).toBe('');
    });

    it('should decode empty hex string', () => {
      const json = "" as Json;
      const result = uint8Array.jsonCodec.deserialise(json);
      const arr = unwrapOk(result);
      expect(arr.length).toBe(0);
    });

    it('should encode multiple bytes', () => {
      const arr = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
      const json = uint8Array.jsonCodec.serialise(arr);
      expect(json).toBe('0123456789abcdef');
    });

    it('should decode multiple bytes', () => {
      const json = "0123456789abcdef" as Json;
      const result = uint8Array.jsonCodec.deserialise(json);
      const arr = unwrapOk(result);
      expect(arr).toEqual(new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]));
    });

    it('should handle uppercase hex', () => {
      const json = "ABCDEF" as Json;
      const result = uint8Array.jsonCodec.deserialise(json);
      const arr = unwrapOk(result);
      expect(arr).toStrictEqual(new Uint8Array([0xab, 0xcd, 0xef]));
    });

    it('should roundtrip correctly', () => {
      const original = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
      const json = uint8Array.jsonCodec.serialise(original);
      const parsed = unwrapOk(parse(stringify(json)));
      const decoded = unwrapOk(uint8Array.jsonCodec.deserialise(parsed));
      expect(decoded).toStrictEqual(original);
    });
  });

  describe('error cases', () => {
    it('should fail on odd length hex string', () => {
      const json = "abc" as Json;
      unwrapErr(uint8Array.jsonCodec.deserialise(json));
    });

    it('should fail on invalid hex characters', () => {
      const json = "abcg" as Json;
      unwrapErrWithSubstring(uint8Array.jsonCodec.deserialise(json), 'Invalid character');
    });

    it('should fail on non-string input', () => {
      const json = 123n as Json;
      const result = uint8Array.jsonCodec.deserialise(json);
      unwrapErr(result);
    });
  });

  describe('Sha256 tagged type', () => {
    it('should accept valid 32-byte array', () => {
      const validSha256 = new Uint8Array(32).fill(0xaa);
      const json = uint8Array.jsonCodec.serialise(validSha256);
      const parsed = unwrapOk(parse(`"${json}"`));
      const result = unwrapOk(sha256Codec.deserialise(parsed));
      expect(result).toStrictEqual(validSha256);
    });

    it('should reject array with less than 32 bytes', () => {
      const tooShort = new Uint8Array(31).fill(0xaa);
      const json = uint8Array.jsonCodec.serialise(tooShort);
      const parsed = unwrapOk(parse(`"${json}"`));
      unwrapErrWithSubstring(sha256Codec.deserialise(parsed), "Sha256");
    });

    it('should reject array with more than 32 bytes', () => {
      const tooLong = new Uint8Array(33).fill(0xaa);
      const json = uint8Array.jsonCodec.serialise(tooLong);
      const parsed = unwrapOk(parse(`"${json}"`));
      unwrapErrWithSubstring(sha256Codec.deserialise(parsed), "Sha256");
    });

    it('should roundtrip valid Sha256', () => {
      // Example SHA-256 hash
      const hash = new Uint8Array([
        0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14,
        0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f, 0xb9, 0x24,
        0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c,
        0xa4, 0x95, 0x99, 0x1b, 0x78, 0x52, 0xb8, 0x55
      ]);
      const json = sha256Codec.serialise(hash as Sha256);
      const parsed = unwrapOk(parse(`"${json}"`));
      const decoded = unwrapOk(sha256Codec.deserialise(parsed));
      expect(decoded).toStrictEqual(hash);
    });
  });
});
