import { describe, it, expect } from 'vitest';
import * as smallish from '../src/integers/smallish';
import * as big from '../src/integers/big';
import { expectOk, expectErr } from './assertions';

describe('Integer Codecs', () => {
  describe('Int codec', () => {
    it('should successfully deserialize valid safe integer', () => {
      const validInt = 42n;
      const result = smallish.json2IntCodec.deserialise(validInt);
      const decoded = expectOk(result);
      expect(decoded).toBe(42);
    });

    it('should fail to deserialize integer outside safe range', () => {
      const tooBig = BigInt(BigInt(Number.MAX_SAFE_INTEGER) + 100n);
      const result = smallish.json2IntCodec.deserialise(tooBig);
      expectErr(result);
    });

    it('should roundtrip correctly', () => {
      const original = expectOk(smallish.number2IntCodec.deserialise(12345));
      const encoded = smallish.json2IntCodec.serialise(original);
      const decoded = expectOk(smallish.json2IntCodec.deserialise(encoded));
      expect(decoded).toBe(12345);
    });

    it('should construct Int from single digit', () => {
      const value = smallish.Int.fromDigits(5);
      expect(value).toBe(5);
    });

    it('should construct Int from multiple digits', () => {
      const value = smallish.Int.fromDigits(1, 2, 3, 4, 5);
      expect(value).toBe(12345);
    });

    it('should construct negative Int from digits', () => {
      const value = smallish.Int.fromDigits(-9, 9, 9);
      expect(value).toBe(-999);
    });
  });

  describe('PositiveInt codec', () => {
    it('should successfully deserialize positive integer', () => {
      const positiveInt = 100n;
      const result = smallish.json2PositiveIntCodec.deserialise(positiveInt);
      const decoded = expectOk(result);
      expect(decoded).toBe(100);
    });

    it('should fail to deserialize zero', () => {
      const zero = 0n;
      const result = smallish.json2PositiveIntCodec.deserialise(zero);
      expectErr(result);
    });

    it('should fail to deserialize negative integer', () => {
      const negative = -5n;
      const result = smallish.json2PositiveIntCodec.deserialise(negative);
      expectErr(result);
    });

    it('should roundtrip correctly', () => {
      const original = expectOk(
        smallish.number2IntCodec.deserialise(999)
        .andThen(smallish.int2PositiveIntCodec.deserialise)
      );
      const encoded = smallish.json2PositiveIntCodec.serialise(original);
      const decoded = expectOk(smallish.json2PositiveIntCodec.deserialise(encoded));
      expect(decoded).toBe(999);
    });

    it('should construct PositiveInt from single digit', () => {
      const value = smallish.PositiveInt.fromDigits(7);
      expect(value).toBe(7);
    });

    it('should construct PositiveInt from multiple digits', () => {
      const value = smallish.PositiveInt.fromDigits(9, 8, 7, 6);
      expect(value).toBe(9876);
    });
  });

  describe('NonNegativeInt codec', () => {
    it('should successfully deserialize zero', () => {
      const zero = 0n;
      const result = smallish.json2NonNegativeIntCodec.deserialise(zero);
      const decoded = expectOk(result);
      expect(decoded).toBe(0);
    });

    it('should successfully deserialize positive integer', () => {
      const positive = 50n;
      const result = smallish.json2NonNegativeIntCodec.deserialise(positive);
      const decoded = expectOk(result);
      expect(decoded).toBe(50);
    });

    it('should fail to deserialize negative integer', () => {
      const negative = -10n;
      const result = smallish.json2NonNegativeIntCodec.deserialise(negative);
      expectErr(result);
    });

    it('should roundtrip correctly', () => {
      const original = expectOk(
        smallish.number2IntCodec.deserialise(0)
        .andThen(smallish.int2NonNegativeIntCodec.deserialise)
      );
      const encoded = smallish.json2NonNegativeIntCodec.serialise(original);
      const decoded = expectOk(smallish.json2NonNegativeIntCodec.deserialise(encoded));
      expect(decoded).toBe(0);
    });

    it('should construct NonNegativeInt from zero', () => {
      const value = smallish.NonNegativeInt.fromDigits(0);
      expect(value).toBe(0);
    });

    it('should construct NonNegativeInt from multiple digits', () => {
      const value = smallish.NonNegativeInt.fromDigits(1, 0, 2, 4);
      expect(value).toBe(1024);
    });
  });

  describe('PositiveBigInt codec', () => {
    it('should successfully deserialize positive bigint', () => {
      const positiveBigInt = 1000000000000n;
      const result = big.json2PositiveBigIntCodec.deserialise(positiveBigInt);
      const decoded = expectOk(result);
      expect(decoded).toBe(1000000000000n);
    });

    it('should fail to deserialize zero', () => {
      const zero = 0n;
      const result = big.json2PositiveBigIntCodec.deserialise(zero);
      expectErr(result);
    });

    it('should fail to deserialize negative bigint', () => {
      const negative = -999n;
      const result = big.json2PositiveBigIntCodec.deserialise(negative);
      expectErr(result);
    });

    it('should roundtrip correctly', () => {
      const original = expectOk(big.bigInt2PositiveBigIntCodec.deserialise(123456789n));
      const encoded = big.json2PositiveBigIntCodec.serialise(original);
      const decoded = expectOk(big.json2PositiveBigIntCodec.deserialise(encoded));
      expect(decoded).toBe(123456789n);
    });

    it('should construct PositiveBigInt from small number', () => {
      const value = big.PositiveBigInt.fromSmallNumber(40);
      expect(value).toBe(40n);
    });

    it('should construct PositiveBigInt from single digit', () => {
      const value = big.PositiveBigInt.fromDigits(5);
      expect(value).toBe(5n);
    });

    it('should construct PositiveBigInt from multiple digits', () => {
      const value = big.PositiveBigInt.fromDigits(1, 2, 3, 4, 5, 6, 7, 8, 9);
      expect(value).toBe(123456789n);
    });
  });

  describe('NonNegativeBigInt codec', () => {
    it('should successfully deserialize zero', () => {
      const zero = 0n;
      const result = big.json2NonNegativeBigIntCodec.deserialise(zero);
      const decoded = expectOk(result);
      expect(decoded).toBe(0n);
    });

    it('should successfully deserialize positive bigint', () => {
      const positive = 999999999999n;
      const result = big.json2NonNegativeBigIntCodec.deserialise(positive);
      const decoded = expectOk(result);
      expect(decoded).toBe(999999999999n);
    });

    it('should fail to deserialize negative bigint', () => {
      const negative = -1n;
      const result = big.json2NonNegativeBigIntCodec.deserialise(negative);
      expectErr(result);
    });

    it('should roundtrip correctly', () => {
      const original = expectOk(big.bigInt2NonNegativeBigIntCodec.deserialise(0n));
      const encoded = big.json2NonNegativeBigIntCodec.serialise(original);
      const decoded = expectOk(big.json2NonNegativeBigIntCodec.deserialise(encoded));
      expect(decoded).toBe(0n);
    });

    it('should construct NonNegativeBigInt from small number', () => {
      const value = big.NonNegativeBigInt.fromSmallNumber(0);
      expect(value).toBe(0n);
    });

    it('should construct NonNegativeBigInt from absolute value of negative', () => {
      const value = big.NonNegativeBigInt.fromAbs(-123n);
      expect(value).toBe(123n);
    });

    it('should construct NonNegativeBigInt from absolute value of positive', () => {
      const value = big.NonNegativeBigInt.fromAbs(456n);
      expect(value).toBe(456n);
    });

    it('should construct NonNegativeBigInt from zero', () => {
      const value = big.NonNegativeBigInt.fromDigits(0);
      expect(value).toBe(0n);
    });

    it('should construct NonNegativeBigInt from multiple digits', () => {
      const value = big.NonNegativeBigInt.fromDigits(0, 0, 0, 9, 8, 7, 6, 5, 4, 3, 2, 1);
      expect(value).toBe(987654321n);
    });
  });
});
