import _JSONBig from 'json-bigint';
import type { Tagged } from 'type-fest';
import { err, ok, type Result } from 'neverthrow';
import { stringifyThrowable, unsafeUnwrap } from './neverthrow';

const JSONBig = _JSONBig({ useNativeBigInt: true, alwaysParseAsBig: false });

/* `Json` type is not pleasant to work with directly because
 * the compiler can be puzzled by the recurssion AFAIK.
 * Please rather rely on the matchJson function and the onType helpers
 */
export type JsonPrimitive = number | string | bigint | boolean | null;
export type JsonObject = { [key: string]: Json };
export type JsonArray = Json[];
export type Json = JsonPrimitive | JsonObject | JsonArray;

export const parse = (text: string): Result<Json, string> => {
  return stringifyThrowable(() => JSONBig.parse(text), "Invalid JSON format");
}

// A valid Json string which can be safely parsed.
// Useful for back and forth conversions, debugging etc.
export type JsonString = Tagged<string, "JsonString">;

export const unstringify = (jsonStr: JsonString) => unsafeUnwrap(parse(jsonStr));

export const stringify = (
  json: Json,
  replacer?: (this: any, key: string, value: any) => any,
  space?: string | number
): JsonString => {
  return JSONBig.stringify(json, replacer, space) as JsonString;
}

export type JsonMacher<T> = {
  onArray: (value: Json[]) => T;
  onBigInt: (value: bigint) => T;
  onBoolean: (value: boolean) => T;
  onNull: () => T;
  onNumber: (value: number) => T;
  onObject: (value: { [key: string]: Json }) => T;
  onString: (value: string) => T;
};

export const matchJson = <T>(json: Json, matcher: JsonMacher<T>): T => {
  switch (typeof json) {
    case "number":
      return matcher.onNumber(json as number);
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

export const onNumber = <T>(def: T | ((json: Json) => T)) => (handle: ((value: number) => T)) =>
  onType((j) => typeof j === "number", def, handle);

export const onBigInt = <T>(def: T | ((json: Json) => T)) => (handle: ((value: bigint) => T)) =>
  onType((j) => typeof j === "bigint", def, handle);

export const onString = <T>(def: T | ((json: Json) => T)) => (handle: ((value: string) => T)) =>
  onType((j) => typeof j === "string", def, handle);

export const onBoolean = <T>(def: T | ((json: Json) => T)) => (handle: ((value: boolean) => T)) =>
  onType((j) => typeof j === "boolean", def, handle);

export const onArray = <T>(def: T | ((json: Json) => T)) => (handle: ((value: Json[]) => T)) =>
  onType((j) => typeof j === "object" && j !== null && Array.isArray(j), def, handle);

export const onObject = <T>(def: T | ((json: Json) => T)) => (handle: ((value: { [key: string]: Json }) => T)) =>
  onType((j) => typeof j === "object" && j !== null && !Array.isArray(j), def, handle);

export const onNull = <T>(def: T | ((json: Json) => T)) => (handle: (() => T)) => (json: Json): T => {
  if (json === null) {
    return handle();
  }
  if (typeof def === "function") {
    return (def as (json: Json) => T)(json);
  }
  return def;
}

export const nullJson = null! as Json;

export const toJson = (data: any): Result<Json, string> => {
  if (isJson(data)) {
    return ok(data);
  } else {
    return err("Data is not valid JSON");
  }
}

// This traversal avoids whole structure re-allocation.
// Should we use `stringify` and `parse` roundtrip instead?
export const isJson = (data: any): data is Json => {
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

