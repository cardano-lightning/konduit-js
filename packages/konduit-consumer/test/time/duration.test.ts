import { describe, it, expect } from 'vitest';
import {
  Milliseconds,
  Seconds,
  Hours,
  Days,
  AnyPreciseDuration,
  NormalisedDuration
} from '../../src/time/duration';
import { NonNegativeInt } from '@konduit/codec/integers/smallish';
import { expectOk } from '../assertions';

describe('NormalisedDuration', () => {
  describe('fromAnyPreciseDuration', () => {
    it('should normalize milliseconds only', () => {
      const duration = AnyPreciseDuration.fromMilliseconds(Milliseconds.fromDigits(1, 5, 0, 0));
      const normalized = NormalisedDuration.fromAnyPreciseDuration(duration);

      expect(normalized.weeks).toBe(0);
      expect(normalized.days).toBe(0);
      expect(normalized.hours).toBe(0);
      expect(normalized.minutes).toBe(0);
      expect(normalized.seconds).toBe(1);
      expect(normalized.milliseconds).toBe(500);
    });

    it('should normalize seconds into minutes, seconds, and milliseconds', () => {
      const duration = AnyPreciseDuration.fromSeconds(Seconds.fromDigits(1, 2, 5));
      const normalized = NormalisedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(0);
      expect(normalized.days).toBe(0);
      expect(normalized.hours).toBe(0);
      expect(normalized.minutes).toBe(2);
      expect(normalized.seconds).toBe(5);
      expect(normalized.milliseconds).toBe(0);
    });

    it('should normalize hours into days, hours, minutes', () => {
      const duration = AnyPreciseDuration.fromHours(Hours.fromDigits(5, 0));
      const normalized = NormalisedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(0);
      expect(normalized.days).toBe(2);
      expect(normalized.hours).toBe(2);
      expect(normalized.minutes).toBe(0);
      expect(normalized.seconds).toBe(0);
      expect(normalized.milliseconds).toBe(0);
    });

    it('should normalize days into weeks and days', () => {
      const duration = AnyPreciseDuration.fromDays(Days.fromDigits(1, 7));
      const normalized = NormalisedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(2);
      expect(normalized.days).toBe(3);
      expect(normalized.hours).toBe(0);
      expect(normalized.minutes).toBe(0);
      expect(normalized.seconds).toBe(0);
      expect(normalized.milliseconds).toBe(0);
    });

    it('should normalize complex duration with all units', () => {
      // 10 days, 5 hours, 30 minutes, 45 seconds, 250 milliseconds
      const totalMs = expectOk(NonNegativeInt.fromNumber((10 * 24 * 60 * 60 * 1000) + (5 * 60 * 60 * 1000) + (30 * 60 * 1000) + (45 * 1000) + 250).map(Milliseconds.fromNonNegativeInt));
      const duration = AnyPreciseDuration.fromMilliseconds(totalMs);
      const normalized = NormalisedDuration.fromAnyPreciseDuration(duration);
      expect(normalized.weeks).toBe(1);
      expect(normalized.days).toBe(3);
      expect(normalized.hours).toBe(5);
      expect(normalized.minutes).toBe(30);
      expect(normalized.seconds).toBe(45);
      expect(normalized.milliseconds).toBe(250);
    });
  });
});
