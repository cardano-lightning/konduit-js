import { describe, it, expect } from 'vitest';
import {
  Milliseconds,
  Seconds,
  Hours,
  Days,
  AnyPreciseDuration,
  NormalizedDuration
} from '../../src/time/duration';
import { NonNegativeInt } from '@konduit/codec/integers/smallish';
import { expectOk } from '../assertions';

describe('NormalizedDuration', () => {
  describe('fromAnyPreciseDuration', () => {
    it('should normalize milliseconds only', () => {
      const duration = AnyPreciseDuration.fromMilliseconds(Milliseconds.fromDigits(1, 5, 0, 0));
      const normalized = NormalizedDuration.fromAnyPreciseDuration(duration);

      expect(normalized.weeks).toBe(0n);
      expect(normalized.days).toBe(0n);
      expect(normalized.hours).toBe(0n);
      expect(normalized.minutes).toBe(0n);
      expect(normalized.seconds).toBe(1n);
      expect(normalized.milliseconds).toBe(500n);
    });

    it('should normalize seconds into minutes, seconds, and milliseconds', () => {
      const duration = AnyPreciseDuration.fromSeconds(Seconds.fromDigits(1, 2, 5));
      const normalized = NormalizedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(0n);
      expect(normalized.days).toBe(0n);
      expect(normalized.hours).toBe(0n);
      expect(normalized.minutes).toBe(2n);
      expect(normalized.seconds).toBe(5n);
      expect(normalized.milliseconds).toBe(0n);
    });

    it('should normalize hours into days, hours, minutes', () => {
      const duration = AnyPreciseDuration.fromHours(Hours.fromDigits(5, 0));
      const normalized = NormalizedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(0n);
      expect(normalized.days).toBe(2n);
      expect(normalized.hours).toBe(2n);
      expect(normalized.minutes).toBe(0n);
      expect(normalized.seconds).toBe(0n);
      expect(normalized.milliseconds).toBe(0n);
    });

    it('should normalize days into weeks and days', () => {
      const duration = AnyPreciseDuration.fromDays(Days.fromDigits(1, 7));
      const normalized = NormalizedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(2n);
      expect(normalized.days).toBe(3n);
      expect(normalized.hours).toBe(0n);
      expect(normalized.minutes).toBe(0n);
      expect(normalized.seconds).toBe(0n);
      expect(normalized.milliseconds).toBe(0n);
    });

    it('should normalize complex duration with all units', () => {
      // 10 days, 5 hours, 30 minutes, 45 seconds, 250 milliseconds
      const totalMs = expectOk(NonNegativeInt.fromNumber((10 * 24 * 60 * 60 * 1000) + (5 * 60 * 60 * 1000) + (30 * 60 * 1000) + (45 * 1000) + 250).map(Milliseconds.fromNonNegativeInt));
      const duration = AnyPreciseDuration.fromMilliseconds(totalMs);
      const normalized = NormalizedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(1n);
      expect(normalized.days).toBe(3n);
      expect(normalized.hours).toBe(5n);
      expect(normalized.minutes).toBe(30n);
      expect(normalized.seconds).toBe(45n);
      expect(normalized.milliseconds).toBe(250n);
    });
  });
});
