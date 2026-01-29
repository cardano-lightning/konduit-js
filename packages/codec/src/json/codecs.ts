import { err, ok, type Result } from "neverthrow";
import type { Json } from "../json";
import { onBigInt, onBoolean, onArray, onObject, onNull, nullJson, onString, stringify } from "../json";
import * as json from "../json";
import { altCodec, type Codec, type Deserialiser, type Serialiser } from "../codec";

// We actually represent parsing errors as JSON too :-P
export type JsonError = Json;

export const toJsonError = (error: Json): JsonError => {
  return error as JsonError;
}

export type JsonSerialiser<O> = Serialiser<O, Json>;

export type JsonDeserialiser<O> = Deserialiser<Json, O, JsonError>;

export type JsonCodec<O> = Codec<Json, O, JsonError>;

export const mkParser = <T>(codec: JsonCodec<T>): (jsonStr: string) => Result<T, JsonError> => {
  return (jsonStr: string): Result<T, JsonError> => {
    return json.parse(jsonStr).match(
      (parsedJson) => codec.deserialise(parsedJson),
      (parseErr) => err(parseErr)
    );
  }
};

export const mkStringifier = <T>(codec: JsonCodec<T>): (value: T) => string => {
  return (value: T): string => {
    const jsonValue = codec.serialise(value);
    return json.stringify(jsonValue);
  }
}

// Codec for bigint
export const json2BigIntCodec: JsonCodec<bigint> = {
  deserialise: onBigInt(err("Expected bigint") as Result<bigint, string>)(ok),
  serialise: (value: bigint) => value as Json
};

// Codec for number (checks safe integer range during deserialisation)
export const json2NumberCodec: JsonCodec<number> = {
  deserialise: onBigInt(err("Expected bigint (for number)") as Result<number, string>)((value: bigint) => {
    const num = Number(value);
    if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
      return err(`BigInt value ${value} is outside safe integer range [${Number.MIN_SAFE_INTEGER}, ${Number.MAX_SAFE_INTEGER}]`);
    }
    return ok(num);
  }),
  serialise: (value: number) => BigInt(Math.round(value))
};

// Codec for boolean
export const json2BooleanCodec: JsonCodec<boolean> = {
  deserialise: onBoolean(err("Expected boolean") as Result<boolean, JsonError>)(ok),
  serialise: (value: boolean) => value
};

// Codec for string
export const json2StringCodec: JsonCodec<string> = {
  deserialise: onString(err("Expected string") as Result<string, JsonError>)(ok),
  serialise: (value: string) => value
};

// Codec for null
export const json2NullCodec: JsonCodec<null> = {
  deserialise: onNull(err("Expected null") as Result<null, JsonError>)(() => ok(null)),
  serialise: () => nullJson
};

// Codec for array (identity - keeps Json[] as is)
export const json2ArrayCodec: JsonCodec<Json[]> = {
  deserialise: onArray(err("Expected array") as Result<Json[], JsonError>)(ok),
  serialise: (value: Json[]) => value
};

// Codec for object (identity - keeps object as is)
export const json2ObjectCodec: JsonCodec<{ [key: string]: Json }> = {
  deserialise: onObject(
      (value: Json) => err(`Expected object but got ${stringify(value)}`) as Result<{ [key: string]: Json }, JsonError>
    )(ok),
  serialise: (value: { [key: string]: Json }) => value as Json
};

export const altJsonCodecs = <O1, O2>(
  first: JsonCodec<O1>,
  second: JsonCodec<O2>,
  caseSerialisers: (serO1: JsonSerialiser<O1>, serO2: JsonSerialiser<O2>) => JsonSerialiser<O1 | O2>
): JsonCodec<O1 | O2> => {
  let
    combineErrs = (err1: JsonError, err2: JsonError): JsonError => {
      const arr1 = Array.isArray(err1) ? err1 : [err1];
      const arr2 = Array.isArray(err2) ? err2 : [err2];
      return [...arr1, ...arr2];
    };
  return altCodec<Json, O1, O2, JsonError>(
    first,
    second,
    caseSerialisers,
    combineErrs
  );
}

export const optional = <O>(codec: JsonCodec<O>): JsonCodec<O | undefined> => {
  return {
    deserialise: (data: Json): Result<O | undefined, JsonError> => {
      if (data === null) {
        return ok(undefined);
      }
      return codec.deserialise(data).map(value => value as O | undefined);
    },
    serialise: (value: O | undefined): Json => {
      if (value === undefined) {
        return nullJson;
      }
      return codec.serialise(value);
    }
  };
};

export const nullable = <O>(codec: JsonCodec<O>): JsonCodec<O | null> => {
  return {
    deserialise: (data: Json): Result<O | null, JsonError> => {
      if (data === null) {
        return ok(null);
      }
      return codec.deserialise(data).map(value => value as O | null);
    },
    serialise: (value: O | null): Json => {
      if (value === null) {
        return nullJson;
      }
      return codec.serialise(value);
    }
  };
}

export const constant = <C extends string | number | boolean | bigint>(constant: C): JsonCodec<C> => {
  return {
    deserialise: (data: Json): Result<C, JsonError> => {
      if (data === constant) {
        return ok(constant);
      }
      return err(`Expected constant value ${constant}, got ${JSON.stringify(data)}`);
    },
    serialise: (_value: C): Json => {
      return constant as Json;
    }
  };
}

// Type to extract the output type from a codec
type CodecOutput<C> = C extends JsonCodec<infer O> ? O : never;

// Type to convert an object of codecs to an object of their output types
type CodecsToObject<T extends Record<string, JsonCodec<any>>> = {
  [K in keyof T]: CodecOutput<T[K]>;
};

export const objectOf = <T extends Record<string, JsonCodec<any>>>(
  fieldCodecs: T
): JsonCodec<CodecsToObject<T>> => {
  return {
    deserialise: (data: Json): Result<CodecsToObject<T>, JsonError> => {
      // Check if input is an object
      return onObject(
          (value: Json) => err(`Expected object but got ${stringify(value)}`) as Result<{ [key: string]: Json }, JsonError>
        )(ok)(data).match(
        (obj) => {
          const result: any = {};
          const errors: { [key: string]: Json } = {};
          let hasErrors = false;

          for (const fieldName in fieldCodecs) {
            const fieldCodec = fieldCodecs[fieldName];
            const fieldValue = obj[fieldName];

            // If field is missing, pass undefined to the codec
            const valueToDeserialise = fieldValue === undefined ? nullJson : fieldValue;
            fieldCodec.deserialise(valueToDeserialise).match(
              (res) => result[fieldName] = res,
              (error) => {
                errors[fieldName] = error;
                hasErrors = true;
              }
            );
          }
          if (hasErrors) {
            return err(errors);
          }
          return ok(result as CodecsToObject<T>);
        },
        (error) => err(error)
      );
    },
    serialise: (value: CodecsToObject<T>): Json => {
      const result: { [key: string]: Json } = {};
      for (const fieldName in fieldCodecs) {
        const fieldCodec = fieldCodecs[fieldName];
        const fieldValue = (value as any)[fieldName];
        if (fieldValue !== undefined) {
          result[fieldName] = fieldCodec.serialise(fieldValue);
        }
      }
      return result;
    }
  };
};
