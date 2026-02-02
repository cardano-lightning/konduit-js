import type { Tagged } from "type-fest";
import { err, ok, type Result } from "neverthrow";
import type { Int, NonNegativeInt } from "@konduit/codec/integers/smallish";
import { compose } from "@konduit/codec";
import { json2StringCodec, type JsonCodec, type JsonError } from "@konduit/codec/json/codecs";

export type ValidDate = Tagged<Date, "ValidDate">;
export namespace ValidDate {
  export const now = (): ValidDate => new Date() as ValidDate;
  export const fromDate = (date: Date): Result<ValidDate, string> => {
    if(isNaN(date.getTime())) {
      return err("Invalid Date");
    }
    return ok(date as ValidDate);
  }
  export const fromPOSIXMilliseconds = (milliseconds: POSIXMilliseconds): Result<ValidDate, string> => {
    const date = new Date(milliseconds as Int);
    return fromDate(date);
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


// FIXME: This type is not fully compatible with `Date`:
// * Date milliseconds range is ±8,640,000,000,000,000
// * NonNegativeInt range is different 0 to +9,007,199,254,740,991.
export type POSIXMilliseconds = Tagged<NonNegativeInt, "POSIXMilliseconds">;
export namespace POSIXMilliseconds {
  export const now = (): POSIXMilliseconds => Date.now() as POSIXMilliseconds;
  export const fromNonNegativeInt = (n: NonNegativeInt): POSIXMilliseconds => n as POSIXMilliseconds;
  export const fromPOSIXSeconds = (seconds: POSIXSeconds): POSIXMilliseconds => (seconds * 1000) as POSIXMilliseconds;
  export const fromValidDate = (date: ValidDate): POSIXMilliseconds => date.getTime() as POSIXMilliseconds;
}

export type POSIXSeconds = Tagged<NonNegativeInt, "POSIXSeconds">;
export namespace POSIXSeconds {
  export const now = (): POSIXSeconds => Math.floor(Date.now() / 1000) as POSIXSeconds;
  export const fromNonNegativeInt = (n: NonNegativeInt): POSIXSeconds => n as POSIXSeconds;
  export const fromPOSIXMillisecondsFloor = (milliseconds: POSIXMilliseconds): POSIXSeconds => (milliseconds / 1000) as POSIXSeconds;
  export const fromValidDate = (date: ValidDate): POSIXSeconds => (Math.floor(date.getTime() / 1000) as POSIXSeconds);
}
