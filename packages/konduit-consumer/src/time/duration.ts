import * as codec from "@konduit/codec";
import type { Tagged } from "type-fest";
import type { Small } from "@konduit/codec/integers/smallish";
import { json2NonNegativeIntCodec, NonNegativeInt } from "@konduit/codec/integers/smallish";
import type { POSIXMilliseconds, POSIXSeconds } from "./absolute";

export type Milliseconds = Tagged<NonNegativeInt, "Milliseconds">;
export namespace Milliseconds {
  export const fromNonNegativeInt = (n: NonNegativeInt): Milliseconds => n as Milliseconds;
  // Pass all the arguments to fromDigits of NonNegativeInt
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Milliseconds => NonNegativeInt.fromDigits(...args) as Milliseconds;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Milliseconds;
  export const fromSeconds = (seconds: Seconds): Milliseconds => (seconds * 1000) as Milliseconds;
  // Please note that the order of timestamps does not matter here
  // The result is always a positive duration
  export const fromDiffTime = (timestamp1: POSIXMilliseconds, timestamp2: POSIXMilliseconds): Milliseconds => {
    const diff = timestamp2 - timestamp1;
    return (diff < 0 ? -diff : diff) as Milliseconds;
  }
}
export const json2MillisecondsCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Milliseconds.fromNonNegativeInt(n), (ms) => ms);

export type Seconds = Tagged<NonNegativeInt, "Seconds">;
export namespace Seconds {
  export const fromNonNegativeInt = (n: NonNegativeInt): Seconds => n as Seconds;
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Seconds => NonNegativeInt.fromDigits(...args) as Seconds;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Seconds;
  export const fromMinutes = (minutes: Minutes): Seconds => (minutes * 60) as Seconds;
  export const fromMillisecondsFloor = (milliseconds: Milliseconds): Seconds => (Math.floor(milliseconds / 1000)) as Seconds;
  export const fromDiffTime = (timestamp1: POSIXSeconds, timestamp2: POSIXSeconds): Seconds => {
    const diff = timestamp2 - timestamp1;
    return (diff < 0 ? -diff : diff) as Seconds;
  }
}
export const json2SecondsCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Seconds.fromNonNegativeInt(n), (s) => s);

export type Minutes = Tagged<NonNegativeInt, "Minutes">;
export namespace Minutes {
  export const fromNonNegativeInt = (n: NonNegativeInt): Minutes => n as Minutes;
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Minutes => NonNegativeInt.fromDigits(...args) as Minutes;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Minutes;
  export const fromHours = (hours: Hours): Minutes => (hours * 60) as Minutes;
  export const fromSecondsFloor = (seconds: Seconds): Minutes => (Math.floor(seconds / 60)) as Minutes;
}
export const json2MinutesCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Minutes.fromNonNegativeInt(n), (m) => m);

export type Hours = Tagged<NonNegativeInt, "Hours">;
export namespace Hours {
  export const fromNonNegativeInt = (n: NonNegativeInt): Hours => n as Hours;
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Hours => NonNegativeInt.fromDigits(...args) as Hours;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Hours;
  export const fromMinutesFloor = (minutes: Minutes): Hours => (Math.floor(minutes / 60)) as Hours;
}
export const json2HoursCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Hours.fromNonNegativeInt(n), (h) => h);
