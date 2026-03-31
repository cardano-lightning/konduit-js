import type { Codec } from "../../codec";
import { pipe } from "../../codec";
import { err, ok, Result } from "neverthrow";
import type { QueryValue } from "../ast";
import type { JsonError } from "../../json/codecs";
import { stringify } from "../../json";
import { Int, number2IntCodec } from "../../integers/smallish";

export type QueryValueCodec<T> = Codec<QueryValue, T, JsonError>

const queryValue2StringCodec: QueryValueCodec<string> = {
  deserialise: (input: QueryValue) => {
    if (typeof input === "string") {
      return ok(input);
    }
    // An array
    if (input.length === 1) {
      return ok(input[0]!);
    } else if (input.length === 0) {
      return err("Expecting a single value but got an empty array");
    } else {
      return err(`Expecting a single value but got an array with multiple values: ${stringify(input)}`);
    }
  },
  serialise: (str: string) => {
    return str;
  }
};

export type StringDeserialiser<T> = (input: string) => Result<T, JsonError>

export type StringCodec<T> = Codec<string, T, JsonError>

export const string2NumberCodec: StringCodec<number> = {
  deserialise: (input: string) => {
    const num = parseInt(input, 10);
    if (isNaN(num)) {
      return err(`Input is not a valid number string: ${input}`);
    }
    return ok(num);
  },
  serialise: (num: number) => {
    return String(num);
  }
};

export const queryValue2NumberCodec: QueryValueCodec<number> = pipe(
  queryValue2StringCodec,
  string2NumberCodec
);

export const string2IntCodec: StringCodec<Int> = pipe(
  string2NumberCodec,
  number2IntCodec
);

export const string2BigIntCodec: StringCodec<bigint> = {
  deserialise: (input: string) => {
    try {
      const bigIntValue = BigInt(input);
      return ok(bigIntValue);
    } catch (e) {
      return err(`Input is not a valid bigint string: ${input}`);
    }
  },
  serialise: (bigIntValue: bigint) => {
    return bigIntValue.toString();
  }
};

export const queryValue2BigIntCodec: QueryValueCodec<bigint> = pipe(
  queryValue2StringCodec,
  string2BigIntCodec
);

