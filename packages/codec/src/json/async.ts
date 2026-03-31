import { err, ok, Result } from "neverthrow";
import type { Json } from "../json";
import { onObject, nullJson, stringify } from "../json";
import { type JsonError } from "./codecs";
import type { AsyncCodec } from "../codec/async";

// I found `ResultAsync` from neverthrow to be limiting in terms of composing multiple async results together.
export type JsonAsyncDeserialiser<O> = (i: Json) => Promise<Result<O, JsonError>>;

export type JsonAsyncCodec<O> = AsyncCodec<Json, O, JsonError>;

type CodecOutput<C> = C extends JsonAsyncCodec<infer O> ? O : never;

// Type to convert an object of codecs to an object of their output types
type CodecsToObject<T extends Record<string, JsonAsyncCodec<any>>> = {
  [K in keyof T]: CodecOutput<T[K]>;
};

export const objectOf = <T extends Record<string, JsonAsyncCodec<any>>>(
  fieldCodecs: T
): JsonAsyncCodec<CodecsToObject<T>> => {
  return {
    deserialise: async (data: Json): Promise<Result<CodecsToObject<T>, JsonError>> => {
      let possibleObj: Result<{ [key: string]: Json }, JsonError> = onObject((value) =>
        err(`Expected object but got ${stringify(value)}`) as Result<{ [key: string]: Json }, JsonError>
      )(ok)(data);
      return await possibleObj.match(
        async (obj: { [key: string]: Json }) => {
          const result: any = {};
          const errors: { [key: string]: Json } = {};
          let hasErrors = false;

          for (const fieldName in fieldCodecs) {
            const fieldCodec = fieldCodecs[fieldName]!;
            const fieldValue = obj[fieldName];

            // If field is missing, pass undefined to the codec
            const valueToDeserialise = fieldValue === undefined ? nullJson : fieldValue;
            const fieldResult = await fieldCodec.deserialise(valueToDeserialise);
            fieldResult.match(
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
        async (e) => err(e)
      );
    },
    serialise: (value: CodecsToObject<T>): Json => {
      const result: { [key: string]: Json } = {};
      for (const fieldName in fieldCodecs) {
        const fieldCodec = fieldCodecs[fieldName]!;
        const fieldValue = (value as any)[fieldName];
        if (fieldValue !== undefined) {
          result[fieldName] = fieldCodec.serialise(fieldValue);
        }
      }
      return result;
    }
  };
};
