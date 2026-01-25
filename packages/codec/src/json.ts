import _JSONBig from 'json-bigint';
import type { Tagged } from 'type-fest';
import { err, ok, type Result } from 'neverthrow';
import { stringifyThrowable } from './neverthrow';

const JSONBig = _JSONBig({ useNativeBigInt: true, alwaysParseAsBig: true });

// Values of `Json` type are valid JSON values in which `bigint` and not `number` is used
// to encode integer values.
//
// In essence under the hood of this fully opaque type is something along the lines of:
// ```
// type Json = null | boolean | string | bigint | Json[] | { [key: string]: Json };
// ```
// But we gain nearly nothing by exposing this full definition as TS can not handle
// such a recursive type well.
export type Json = Tagged<any, "Json">;

export const parse = (text: string): Result<Json, string> => {
  return stringifyThrowable(() => JSONBig.parse(text), "Invalid JSON format");
}

export const stringify = (json: Json): string => {
  return JSONBig.stringify(json);
}

export type JsonMacher<T> = {
  onBigInt: (value: bigint) => T;
  onBoolean: (value: boolean) => T;
  onNull: () => T;
  onString: (value: string) => T;
  onArray: (value: Json[]) => T;
  onObject: (value: { [key: string]: Json }) => T;
};

export const matchJson = <T>(json: Json, matcher: JsonMacher<T>): T => {
  switch (typeof json) {
    case "bigint":
      return matcher.onBigInt(json as bigint);
    case "boolean":
      return matcher.onBoolean(json as boolean);
    case "string":
      return matcher.onString(json as string);
    case "object":
      if (json === null) {
        return matcher.onNull();
      } else if (Array.isArray(json)) {
        return matcher.onArray(json as Json[]);
      } else {
        return matcher.onObject(json as { [key: string]: Json });
      }
    default:
      // Should never happen if Json value was correctly constructed
      throw new Error(`Unsupported JSON type: ${typeof json}`);
  }
}

const onType = <T>(typeCheck: (json: Json) => boolean, def: T | ((json: Json) => T), handle: ((value: any) => T)) => (json: Json): T => {
  if (typeCheck(json)) {
    return handle(json);
  }
  if (typeof def === "function") {
    return (def as (json: Json) => T)(json);
  }
  return def;
}
// Helpers usage: onBigInt(defaultValueOrFallbackFunction)(handlerFunction)
export const onBigInt = <T>(def: T | ((json: Json) => T)) => (handle: ((value: bigint) => T)) =>
  onType((j) => typeof j === "bigint", def, handle);

export const onString = <T>(def: T | ((json: Json) => T)) => (handle: ((value: string) => T)) =>
  onType((j) => typeof j === "string", def, handle);

export const onBoolean = <T>(def: T | ((json: Json) => T)) => (handle: ((value: boolean) => T)) =>
  onType((j) => typeof j === "boolean", def, handle);

export const onArray = <T>(def: T | ((json: Json) => T)) => (handle: ((value: Json[]) => T)) =>
  onType((j) => typeof j === "object" && j !== null && Array.isArray(j), def, handle);

export const onObject = <T>(def: T) => (handle: ((value: { [key: string]: Json }) => T)) =>
  onType((j) => typeof j === "object" && j !== null && !Array.isArray(j), def, handle);

export const onNull = <T>(def: T) => (handle: (() => T)) => (json: Json): T => {
  if (json === null) {
    return handle();
  }
  return def;
}

export const fromBigInt = (value: bigint): Json => {
  return value as Json;
}

export const fromString = (value: string): Json => {
  return value as Json;
}

export const fromBoolean = (value: boolean): Json => {
  return value as Json;
}

export const nullJson = null as Json;

export const fromArray = (value: Json[]): Json => {
  return value as Json;
}

export const fromObject = (value: { [key: string]: Json }): Json => {
  return value as Json;
}

export const mkJSON = (data: any): Result<Json, string> => {
  if (isJson(data)) {
    return ok(data as Json);
  } else {
    return err("Data is not valid JSON");
  }
}

// This traversal avoids whole structure re-allocation.
// Should we use `stringify` and `parse` roundtrip instead?
export const isJson = (data: any): boolean => {
  switch (typeof data) {
    case "bigint":
    case "boolean":
    case "string":
      return true;
    case "object":
      if (data === null) {
        return true;
      } else if (Array.isArray(data)) {
        for (const item of data) {
          if (!isJson(item)) return false;
        }
        return true;
      } else {
        for (const key in data) {
          if (!isJson(data[key])) return false;
        }
        return true;
      }
    default:
      return false;
  }
}

