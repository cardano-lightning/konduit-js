import * as codec from "@konduit/codec";
import type { Tagged } from "type-fest";
import type { Small } from "@konduit/codec/integers/smallish";
import { json2NonNegativeIntCodec, NonNegativeInt } from "@konduit/codec/integers/smallish";
import type { POSIXMilliseconds, POSIXSeconds } from "./absolute";
import { altJsonCodecs, JsonCodec } from "@konduit/codec/json/codecs";

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
  export const fromAnyPreciseDuration = (duration: AnyPreciseDuration): Milliseconds => {
    switch (duration.type) {
      case "milliseconds":
        return duration.value;
      case "seconds":
        return Milliseconds.fromSeconds(duration.value);
      case "minutes":
        return Milliseconds.fromSeconds(Seconds.fromMinutes(duration.value));
      case "hours":
        return Milliseconds.fromSeconds(Seconds.fromMinutes(Minutes.fromHours(duration.value)));
      case "days":
        return Milliseconds.fromSeconds(Seconds.fromMinutes(Minutes.fromHours(Hours.fromDays(duration.value))));
      case "weeks":
        return Milliseconds.fromSeconds(Seconds.fromMinutes(Minutes.fromHours(Hours.fromDays(Days.fromWeeks(duration.value)))));
    }
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
  export const fromDays = (days: Days): Hours => (days * 24) as Hours;
}
export const json2HoursCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Hours.fromNonNegativeInt(n), (h) => h);

export type Days = Tagged<NonNegativeInt, "Days">;
export namespace Days {
  export const fromNonNegativeInt = (n: NonNegativeInt): Days => n as Days;
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Days => NonNegativeInt.fromDigits(...args) as Days;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Days;
  export const fromHoursFloor = (hours: Hours): Days => (Math.floor(hours / 24)) as Days;
  export const fromWeeks = (weeks: Weeks): Days => (weeks * 7) as Days;
}
export const json2DaysCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Days.fromNonNegativeInt(n), (d) => d);

export type Weeks = Tagged<NonNegativeInt, "Weeks">;
export namespace Weeks {
  export const fromNonNegativeInt = (n: NonNegativeInt): Weeks => n as Weeks;
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Weeks => NonNegativeInt.fromDigits(...args) as Weeks;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Weeks;
  export const fromDaysFloor = (days: Days): Weeks => (Math.floor(days / 7)) as Weeks;
}
export const json2WeeksCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Weeks.fromNonNegativeInt(n), (w) => w);

// Non precise unit. TODO: Provide some helpers to work with that as well.
export type Months = Tagged<NonNegativeInt, "Months">;
export namespace Months {
  export const fromNonNegativeInt = (n: NonNegativeInt): Months => n as Months;
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Months => NonNegativeInt.fromDigits(...args) as Months;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Months;
}
export const json2MonthsCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Months.fromNonNegativeInt(n), (m) => m);

// This precise unit. TODO: Provide some helpers to work with that as well.
export type Years = Tagged<NonNegativeInt, "Years">;
export namespace Years {
  export const fromNonNegativeInt = (n: NonNegativeInt): Years => n as Years;
  export const fromDigits = (...args: Parameters<typeof NonNegativeInt["fromDigits"]>): Years => NonNegativeInt.fromDigits(...args) as Years;
  export const fromSmallNumber = (n: Small) => NonNegativeInt.fromSmallNumber(n) as Years;
  export const fromMonthsFloor = (months: Months): Years => (Math.floor(months / 12)) as Years;
}

export const json2YearsCodec = codec.rmap(json2NonNegativeIntCodec, (n) => Years.fromNonNegativeInt(n), (y) => y);

export type AnyPreciseDuration =
  | { type: "milliseconds"; value: Milliseconds }
  | { type: "seconds";  value: Seconds }
  | { type: "minutes"; value: Minutes }
  | { type: "hours"; value: Hours }
  | { type: "days"; value: Days }
  | { type: "weeks"; value: Weeks };

export namespace AnyPreciseDuration {
  export const fromMilliseconds = (value: Milliseconds): AnyPreciseDuration => ({ type: "milliseconds", value });
  export const fromSeconds = (value: Seconds): AnyPreciseDuration => ({ type: "seconds", value });
  export const fromMinutes = (value: Minutes): AnyPreciseDuration => ({ type: "minutes", value });
  export const fromHours = (value: Hours): AnyPreciseDuration => ({ type: "hours", value });
  export const fromDays = (value: Days): AnyPreciseDuration => ({ type: "days", value });
  export const fromWeeks = (value: Weeks): AnyPreciseDuration => ({ type: "weeks", value });
}

export const json2AnyPreciseDurationCodec: JsonCodec<AnyPreciseDuration> = altJsonCodecs(
  [ codec.rmap(json2MillisecondsCodec, value => ({ value, type: "milliseconds" as const }), (d) => d.value)
  , codec.rmap(json2SecondsCodec, value => ({ value, type: "seconds" as const }), (d) => d.value)
  , codec.rmap(json2MinutesCodec, value => ({ value, type: "minutes" as const }), (d) => d.value)
  , codec.rmap(json2HoursCodec, value => ({ value, type: "hours" as const }), (d) => d.value)
  , codec.rmap(json2DaysCodec, value => ({ value, type: "days"  as const}), (d) => d.value)
  , codec.rmap(json2WeeksCodec, value => ({ value, type: "weeks"  as const}), (d) => d.value)
  ],
  (serMilliseconds, serSeconds, serMinutes, serHours, serDays, serWeeks) => (value: AnyPreciseDuration) => {
    switch (value.type) {
      case "milliseconds":
        return serMilliseconds(value);
      case "seconds":
        return serSeconds(value);
      case "minutes":
        return serMinutes(value);
      case "hours":
        return serHours(value);
      case "days":
        return serDays(value);
      case "weeks":
        return serWeeks(value);
    }
  }
);

export type NormalizedDuration = {
  milliseconds: Milliseconds;
  seconds: Seconds;
  minutes: Minutes;
  hours: Hours;
  days: Days;
  weeks: Weeks;
};

export namespace NormalizedDuration {
  export const create = ( weeks: Weeks, days: Days, hours: Hours, minutes: Minutes, seconds: Seconds, milliseconds: Milliseconds): NormalizedDuration => {
    return { weeks, days, hours, minutes, seconds, milliseconds };
  };

  export const fromAnyPreciseDuration = (duration: AnyPreciseDuration): NormalizedDuration => {
    const totalMilliseconds = Milliseconds.fromAnyPreciseDuration(duration);
    const totalSeconds = Seconds.fromMillisecondsFloor(totalMilliseconds);
    const totalMinutes = Minutes.fromSecondsFloor(totalSeconds);
    const totalHours = Hours.fromMinutesFloor(totalMinutes);
    const totalDays = Days.fromHoursFloor(totalHours);
    const totalWeeks = Weeks.fromDaysFloor(totalDays);

    const milliseconds = (totalMilliseconds % 1000) as Milliseconds;
    const seconds = (totalSeconds % 60) as Seconds;
    const minutes = (totalMinutes % 60) as Minutes;
    const hours = (totalHours % 24) as Hours;
    const days = (totalDays % 7) as Days;
    const weeks = totalWeeks;

    return {
      milliseconds,
      seconds,
      minutes,
      hours,
      days,
      weeks,
    };
  }
}
