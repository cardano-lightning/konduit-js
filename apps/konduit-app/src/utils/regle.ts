import { type Maybe, createRule, type RegleRuleDefinition } from "@regle/core";
import { type Deserialiser } from "@konduit/codec";
import type { JsonError } from "@konduit/codec/json/codecs";
import { isEmpty } from "@regle/rules";
import type { Result } from "neverthrow";
import { stringify } from "@konduit/codec/json";

const formatError = (error: JsonError): string => {
  if(typeof error === "string") {
    return error;
  }
  return stringify(error);
};

export const ruleFromDeserialiser = <T>(
  deserialiser: Deserialiser<string, T, JsonError>,
  handleResult: (result: Result<T, JsonError>) => void = () => {},
): RegleRuleDefinition<string, string, [], true, { $valid: boolean, deserialisationError: JsonError | null, value: T | null }> => {
  return createRule({
    validator: async (value: Maybe<string>) => {
      if(isEmpty(value)) {
        return { $valid: false, value: null, deserialisationError: "Value is required." };
      }
      let deserialisationResult = deserialiser(value);
      handleResult(deserialisationResult);
      return deserialisationResult.match(
        (value) => {
          return { $valid: true, value, deserialisationError: null }
        },
        (_err) => ({ $valid: false, value: null, deserialisationError: _err })
      );
    },
    message: (result) => {
      if(result.deserialisationError) {
        return formatError(result.deserialisationError);
      }
      return "The provided value is not valid.";
    },
  });
}

export const ruleFromAsyncDeserialiser = <T>(
  deserialiser: (value: string) => Promise<Result<T, JsonError>>,
  handleResult: (result: Result<T, JsonError>) => Promise<void> = () => Promise.resolve()
): RegleRuleDefinition<unknown, string, [], true, { rawValue: Maybe<string>, $valid: boolean, deserialisationError: JsonError | null, value: T | null }> => {
  return createRule({
    validator: async (rawValue: Maybe<string>) => {
      if(isEmpty(rawValue)) {
        return { $valid: false, rawValue, value: null, deserialisationError: "Value is required." };
      }
      let deserialisationResult = await deserialiser(rawValue);
      await handleResult(deserialisationResult);
      return deserialisationResult.match(
        async (value) => {
          return { $valid: true, rawValue, value, deserialisationError: null };
        },
        async (_err) => ({ $valid: false, rawValue, value: null, deserialisationError: _err })
      );
    },
    message: (result) => {
      if(result.deserialisationError) {
        return formatError(result.deserialisationError);
      }
      return "The provided value is not valid.";
    },
  });
}


