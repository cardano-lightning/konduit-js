import { Result } from 'neverthrow';
import { isJson, onString, stringify } from '@konduit/codec/json';
import { JsonError } from '@konduit/codec/json/codecs';
import { expect } from 'vitest';

export const expectOk = <T, Err>(result: Result<T, Err>, msgTemplate?: string): T => {
  const mkMessage = (err: any) => {
    console.debug(err);
    const tpl = msgTemplate || "Expected Ok result, got Err: ERROR_STR"
    const errorStr = (() => {
      if (isJson(err)) {
        return stringify(err);
      }
      return stringify(err);
    })();
    return tpl.replace("ERROR_STR", errorStr);
  };
  return result.match(
    (value) => value,
    (error) => { throw new Error(mkMessage(error)); }
  );
}

const expectErrWith = <T, E>(result: Result<T, E>, onErr: (error: E) => boolean): E => {
  return result.match(
    (value) => { throw new Error(`Expected Err result, got Ok: ${value}`); },
    (error) => {
      if (!onErr(error)) {
        throw new Error(`Error did not match expected condition: ${error}`);
      }
      return error;
    }
  );
}

export const expectErr = <T, E>(result: Result<T, E>): E => {
  return expectErrWith(result, (_error) => true);
}

export const expectErrWithSubstring = <T>(result: Result<T, JsonError>, substring: string): JsonError => {
  return expectErrWith(result, (error) => {
    return onString((_) => false)((errStr: string) => {
      return errStr.includes(substring);
    })(error);
  });
}

// TYPE SAFE versions of expects:
export const expectToBe = <T>(a: T, b: T): void => {
  return expect(a).toBe(b);
}

export const expectToEqual = <T>(a: T, b: T): void => {
  return expect(a).toEqual(b);
}

export const expectToStrictEqual = <T>(a: T, b: T): void => {
  return expect(a).toStrictEqual(b);
}

export const expectNotNull = <T>(value: T | null): T => {
  if (value === null) {
    throw new Error("Expected value to be not null, but it was null");
  }
  return value;
}
