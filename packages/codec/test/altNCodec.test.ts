import { describe, it, expect } from 'vitest';
import { unwrapOk, unwrapErr } from './assertions';
import { altCodecs } from '../src/codec';
import {
  json2StringCodec,
  json2NumberCodec,
  json2BooleanCodec,
  json2NullCodec,
} from '../src/json/codecs';

describe('altCodecs - Generalized N-way Alternative Codec', () => {
  describe('2 alternatives (equivalent to alt2Codec)', () => {
    const stringOrNumberCodec = altCodecs(
      [json2StringCodec, json2NumberCodec] as const,
      (serStr, serNum) => (value: string | number) => {
        return typeof value === 'string' ? serStr(value) : serNum(value);
      }
    );

    it('should decode first alternative', () => {
      const result = stringOrNumberCodec.deserialise("hello");
      const decoded = unwrapOk(result);
      expect(decoded).toBe("hello");
    });

    it('should decode second alternative', () => {
      const result = stringOrNumberCodec.deserialise(42n);
      const decoded = unwrapOk(result);
      expect(decoded).toBe(42);
    });

    it('should fail when all alternatives fail', () => {
      const result = stringOrNumberCodec.deserialise(true);
      unwrapErr(result);
    });

    it('should serialize correctly', () => {
      expect(stringOrNumberCodec.serialise("test")).toBe("test");
      expect(stringOrNumberCodec.serialise(123)).toBe(123n);
    });
  });

  describe('3 alternatives', () => {
    const stringOrNumberOrBoolCodec = altCodecs(
      [json2StringCodec, json2NumberCodec, json2BooleanCodec] as const,
      (serStr, serNum, serBool) => (value: string | number | boolean) => {
        if (typeof value === 'string') return serStr(value);
        if (typeof value === 'number') return serNum(value);
        return serBool(value);
      }
    );

    it('should decode first alternative', () => {
      const decoded = unwrapOk(stringOrNumberOrBoolCodec.deserialise("hello"));
      expect(decoded).toBe("hello");
    });

    it('should decode second alternative', () => {
      const decoded = unwrapOk(stringOrNumberOrBoolCodec.deserialise(42n));
      expect(decoded).toBe(42);
    });

    it('should decode third alternative', () => {
      const decoded = unwrapOk(stringOrNumberOrBoolCodec.deserialise(true));
      expect(decoded).toBe(true);
    });

    it('should fail when all alternatives fail', () => {
      unwrapErr(stringOrNumberOrBoolCodec.deserialise(null));
    });

    it('should serialize all types correctly', () => {
      expect(stringOrNumberOrBoolCodec.serialise("test")).toBe("test");
      expect(stringOrNumberOrBoolCodec.serialise(99)).toBe(99n);
      expect(stringOrNumberOrBoolCodec.serialise(false)).toBe(false);
    });
  });

  describe('4 alternatives', () => {
    const fourWayCodec = altCodecs(
      [json2StringCodec, json2NumberCodec, json2BooleanCodec, json2NullCodec] as const,
      (serStr, serNum, serBool, serNull) => (value: string | number | boolean | null) => {
        if (value === null) return serNull(null);
        if (typeof value === 'string') return serStr(value);
        if (typeof value === 'number') return serNum(value);
        return serBool(value);
      }
    );

    it('should decode all four alternatives', () => {
      expect(unwrapOk(fourWayCodec.deserialise("text"))).toBe("text");
      expect(unwrapOk(fourWayCodec.deserialise(100n))).toBe(100);
      expect(unwrapOk(fourWayCodec.deserialise(false))).toBe(false);
      expect(unwrapOk(fourWayCodec.deserialise(null))).toBe(null);
    });

    it('should serialize all types correctly', () => {
      expect(fourWayCodec.serialise("abc")).toBe("abc");
      expect(fourWayCodec.serialise(50)).toBe(50n);
      expect(fourWayCodec.serialise(true)).toBe(true);
      expect(fourWayCodec.serialise(null)).toBe(null);
    });
  });
});
