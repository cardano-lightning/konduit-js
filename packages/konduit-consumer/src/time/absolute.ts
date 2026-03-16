import type { Tagged } from "type-fest";
import { err, ok, type Result } from "neverthrow";
import { NonNegativeInt, type Int } from "@konduit/codec/integers/smallish";
import { type Codec, compose } from "@konduit/codec";
import { json2BigIntCodec, json2StringCodec, type JsonCodec, type JsonError } from "@konduit/codec/json/codecs";
import * as codec from "@konduit/codec";
import type { Milliseconds, Seconds } from "./duration";
import { mkOrdForScalar } from "@konduit/codec/tagged";
import type { NonNegativeBigInt } from "@konduit/codec/integers/big";

export type ValidDate = Tagged<Date, "ValidDate">;
export namespace ValidDate {
  export const now = (): ValidDate => new Date() as ValidDate;
  export const fromDate = (date: Date): Result<ValidDate, string> => {
    if(isNaN(date.getTime())) {
      return err("Invalid Date");
    }
    return ok(date as ValidDate);
  }
  export const fromPOSIXMilliseconds = (milliseconds: POSIXMilliseconds): ValidDate => {
    return new Date(milliseconds as Int) as ValidDate;
  }
  export const addMilliseconds = (date: ValidDate, milliseconds: Milliseconds): Result<ValidDate, string> => {
    const newDate = new Date(date.getTime() + milliseconds);
    return fromDate(newDate);
  }
  export const ord = {
    equal: (a: ValidDate, b: ValidDate): boolean => a.getTime() === b.getTime(),
    isLessThan: (a: ValidDate, b: ValidDate): boolean => a.getTime() < b.getTime(),
    isLessThanOrEqual: (a: ValidDate, b: ValidDate): boolean => a.getTime() <= b.getTime(),
    isGreaterThan: (a: ValidDate, b: ValidDate): boolean => a.getTime() > b.getTime(),
    isGreaterThanOrEqual: (a: ValidDate, b: ValidDate): boolean => a.getTime() >= b.getTime(),
  }
}

export const json2ValidDateCodec:JsonCodec<ValidDate> = compose({
    serialise: (date: ValidDate): string => date.toISOString(),
    deserialise: (value: string): Result<ValidDate, JsonError> => {
      const date = new Date(value);
      return ValidDate.fromDate(date);
    }
  },
  json2StringCodec,
);

// Please note that those two below types are range compatible with JavaScript's Date.

export type POSIXMilliseconds = Tagged<NonNegativeInt, "POSIXMilliseconds">;
export namespace POSIXMilliseconds {
  export const now = (): POSIXMilliseconds => Date.now() as POSIXMilliseconds;
  // * Date milliseconds range is ±8,640,000,000,000,000
  // * NonNegativeInt (53 bits) range is different 0 to +9,007,199,254,740,991.
  export const fromNonNegativeInt = (n: NonNegativeInt): Result<POSIXMilliseconds, string> => {
    if (n > 8_640_000_000_000_000) {
      return err(`POSIXMilliseconds must be less than or equal to 8,640,000,000,000,000, got ${n}`);
    }
    return ok(n as POSIXMilliseconds);
  }
  export const fromPOSIXSeconds = (seconds: POSIXSeconds): POSIXMilliseconds => (seconds * 1000) as POSIXMilliseconds;
  export const fromValidDate = (date: ValidDate): POSIXMilliseconds => date.getTime() as POSIXMilliseconds;
  export const ord = mkOrdForScalar<POSIXMilliseconds>();
  export const addMilliseconds = (milliseconds: POSIXMilliseconds, millisecondsToAdd: Milliseconds): Result<POSIXMilliseconds, string> => {
    return NonNegativeInt.add(milliseconds, millisecondsToAdd).andThen(newMilliseconds =>
      fromNonNegativeInt(newMilliseconds)
    );
  }
  export const bigIntCodec: Codec<bigint, POSIXMilliseconds, JsonError> = codec.pipe(NonNegativeInt.bigIntCodec, {
    deserialise: (n: NonNegativeInt): Result<POSIXMilliseconds, JsonError> => POSIXMilliseconds.fromNonNegativeInt(n),
    serialise: (milliseconds: POSIXMilliseconds) => milliseconds
  });
  export const jsonCodec = codec.pipe(json2BigIntCodec, bigIntCodec);
}

export type POSIXSeconds = Tagged<NonNegativeInt, "POSIXSeconds">;
export namespace POSIXSeconds {
  export const now = (): POSIXSeconds => Math.floor(Date.now() / 1000) as POSIXSeconds;
  export const fromNonNegativeInt = (n: NonNegativeInt): Result<POSIXSeconds, string> => {
    if (n > 8_640_000_000_000) {
      return err(`POSIXSeconds must be less than or equal to 8,640,000,000,000,000, got ${n}`);
    }
    return ok(n as POSIXSeconds);
  }
  export const fromPOSIXMillisecondsFloor = (milliseconds: POSIXMilliseconds): POSIXSeconds => (milliseconds / 1000) as POSIXSeconds;
  export const fromValidDate = (date: ValidDate): POSIXSeconds => (Math.floor(date.getTime() / 1000) as POSIXSeconds);
  export const addSeconds = (seconds: POSIXSeconds, secondsToAdd: Seconds): Result<POSIXSeconds, string> => {
    return NonNegativeInt.add(seconds, secondsToAdd).andThen(newSeconds => fromNonNegativeInt(newSeconds));
  }
  export const ord = mkOrdForScalar<POSIXSeconds>();
}

export type ArbitraryPOSIXSeconds = Tagged<NonNegativeBigInt, "ArbitraryPOSIXSeconds">;
export namespace ArbitraryPOSIXSeconds {
  export const fromNonNegativeBigInt = (n: NonNegativeBigInt): ArbitraryPOSIXSeconds => n as ArbitraryPOSIXSeconds;
  export const fromPOSIXMillisecondsFloor = (milliseconds: POSIXMilliseconds): ArbitraryPOSIXSeconds => (BigInt(milliseconds / 1000) as ArbitraryPOSIXSeconds);
  export const addSeconds = (seconds: ArbitraryPOSIXSeconds, secondsToAdd: Seconds): ArbitraryPOSIXSeconds => {
    return (BigInt(seconds) + BigInt(secondsToAdd)) as ArbitraryPOSIXSeconds;
  }
  export const ord = mkOrdForScalar<ArbitraryPOSIXSeconds>();
}
