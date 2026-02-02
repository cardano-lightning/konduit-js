import { describe, it, expect } from 'vitest';
import { fromSync, pipe, compose, rmapSync, lmapSync, rmap, mapErr, altCodec } from '../src/codec/async';
import { json2StringCodec, json2NumberCodec, json2BooleanCodec, type JsonCodec } from '../src/json/codecs';
import type { Json } from '../src/json';
import { expectOk, expectErr } from './assertions';

describe('Async Codecs', () => {
  describe('fromSync', () => {
    it('should lift a sync codec to async', async () => {
      const asyncStringCodec = fromSync(json2StringCodec);
      const result = await asyncStringCodec.deserialise("hello");
      const decoded = expectOk(result);
      expect(decoded).toBe("hello");
    });

    it('should preserve serialization', () => {
      const asyncNumberCodec = fromSync(json2NumberCodec);
      const encoded = asyncNumberCodec.serialise(42);
      expect(encoded).toBe(42n);
    });
  });

  describe('pipe', () => {
    it('should compose two async codecs', async () => {
      const stringToNumber: JsonCodec<number> = {
        deserialise: (input: Json) => {
          if (typeof input === 'string') {
            const num = parseInt(input, 10);
            if (!isNaN(num)) {
              return json2NumberCodec.deserialise(BigInt(num));
            }
          }
          return json2NumberCodec.deserialise(input);
        },
        serialise: (output: number) => {
          return String(json2NumberCodec.serialise(output));
        }
      };

      const asyncStringCodec = fromSync(json2StringCodec);
      const asyncStringToNumber = fromSync(stringToNumber);
      const composed = pipe(asyncStringCodec, asyncStringToNumber);

      const result = await composed.deserialise("123");
      const decoded = expectOk(result);
      expect(decoded).toBe(123);

      const encoded = composed.serialise(456);
      expect(encoded).toBe("456");
    });
  });

  describe('compose', () => {
    it('should compose in categorical order', async () => {
      const stringToNumber: JsonCodec<number> = {
        deserialise: (input: Json) => {
          if (typeof input === 'string') {
            const num = parseInt(input, 10);
            if (!isNaN(num)) {
              return json2NumberCodec.deserialise(BigInt(num));
            }
          }
          return json2NumberCodec.deserialise(input);
        },
        serialise: (output: number) => {
          return String(json2NumberCodec.serialise(output));
        }
      };

      const asyncStringCodec = fromSync(json2StringCodec);
      const asyncStringToNumber = fromSync(stringToNumber);
      const composed = compose(asyncStringToNumber, asyncStringCodec);

      const result = await composed.deserialise("789");
      const decoded = expectOk(result);
      expect(decoded).toBe(789);
    });
  });

  describe('rmapSync', () => {
    it('should map output type synchronously', async () => {
      const asyncNumberCodec = fromSync(json2NumberCodec);
      const doubled = rmapSync(
        asyncNumberCodec,
        (n) => n * 2,
        (n) => n / 2
      );

      const result = await doubled.deserialise(21n);
      const decoded = expectOk(result);
      expect(decoded).toBe(42);

      const encoded = doubled.serialise(100);
      expect(encoded).toBe(50n);
    });
  });

  describe('lmapSync', () => {
    it('should map input type synchronously', async () => {
      const asyncNumberCodec = fromSync(json2NumberCodec);
      const stringInput = lmapSync(
        asyncNumberCodec,
        (s: string) => BigInt(s) as Json,
        (n: Json) => String(n)
      );

      const result = await stringInput.deserialise("42");
      const decoded = expectOk(result);
      expect(decoded).toBe(42);

      const encoded = stringInput.serialise(123);
      expect(encoded).toBe("123");
    });
  });

  describe('rmap', () => {
    it('should map output type asynchronously', async () => {
      const asyncNumberCodec = fromSync(json2NumberCodec);
      const asyncDoubled = rmap(
        asyncNumberCodec,
        async (n) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return n * 2;
        },
        (n) => n / 2
      );

      const result = await asyncDoubled.deserialise(21n);
      const decoded = expectOk(result);
      expect(decoded).toBe(42);

      const encoded = asyncDoubled.serialise(100);
      expect(encoded).toBe(50n);
    });
  });

  describe('mapErr', () => {
    it('should map error type', async () => {
      const asyncStringCodec = fromSync(json2StringCodec);
      const withMappedErr = mapErr(
        asyncStringCodec,
        (err) => `Mapped: ${err}`
      );

      const result = await withMappedErr.deserialise(123n);
      const error = expectErr(result);
      expect(typeof error === 'string' && error.startsWith('Mapped:')).toBe(true);
    });
  });

  describe('altCodec', () => {
    it('should try first codec, then second on failure', async () => {
      const asyncStringCodec = fromSync(json2StringCodec);
      const asyncNumberCodec = fromSync(json2NumberCodec);
      const stringOrNumber = altCodec(
        asyncStringCodec,
        asyncNumberCodec,
        (serStr, serNum) => (value: string | number) =>
          typeof value === 'string' ? serStr(value) : serNum(value)
      );

      const strResult = await stringOrNumber.deserialise("hello");
      const strDecoded = expectOk(strResult);
      expect(strDecoded).toBe("hello");

      const numResult = await stringOrNumber.deserialise(42n);
      const numDecoded = expectOk(numResult);
      expect(numDecoded).toBe(42);

      const boolResult = await stringOrNumber.deserialise(true);
      expectErr(boolResult);
    });

    it('should serialize using correct case', async () => {
      const asyncStringCodec = fromSync(json2StringCodec);
      const asyncNumberCodec = fromSync(json2NumberCodec);
      const stringOrNumber = altCodec(
        asyncStringCodec,
        asyncNumberCodec,
        (serStr, serNum) => (value: string | number) =>
          typeof value === 'string' ? serStr(value) : serNum(value)
      );

      const strEncoded = stringOrNumber.serialise("test");
      expect(strEncoded).toBe("test");

      const numEncoded = stringOrNumber.serialise(99);
      expect(numEncoded).toBe(99n);
    });
  });
});
