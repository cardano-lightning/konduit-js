import type { Tagged } from "type-fest";
import type { NonNegativeInt } from "@konduit/codec/integers/smallish";

export type POSIXMilliseconds = Tagged<NonNegativeInt, "POSIXMilliseconds">;
export namespace POSIXMilliseconds {
  export const fromNonNegativeInt = (n: NonNegativeInt): POSIXMilliseconds => n as POSIXMilliseconds;
  export const fromPOSIXSeconds = (seconds: POSIXSeconds): POSIXMilliseconds => (seconds * 1000) as POSIXMilliseconds;
}

export type POSIXSeconds = Tagged<NonNegativeInt, "POSIXSeconds">;
export namespace POSIXSeconds {
  export const fromNonNegativeInt = (n: NonNegativeInt): POSIXSeconds => n as POSIXSeconds;
  export const fromPOSIXMillisecondsFloor = (milliseconds: POSIXMilliseconds): POSIXSeconds => (milliseconds / 1000) as POSIXSeconds;
}
