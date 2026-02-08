import { Result } from 'neverthrow';
import { onString } from '../src/json';
import { JsonError } from '../src/json/codecs';
import { Assertion, expect } from 'vitest';

export const unwrapOk = <T, Err>(result: Result<T, Err>, msgTemplate?: string): T => {
  const mkMessage = (err: any) => {
    const tpl = msgTemplate || "Expected Ok result, got Err: ERROR_STR"
    return tpl.replace("ERROR_STR", String(err));
  };
  return result.match(
    (value) => value,
    (error) => { throw new Error(mkMessage(error)); }
  );
}

const unwrapErrWith = <T, E>(result: Result<T, E>, onErr: (error: E) => boolean): E => {
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

export const unwrapErrWithSubstring = <T>(result: Result<T, JsonError>, substring: string): JsonError => {
  return unwrapErrWith(result, (error) => {
    return onString((_) => false)((errStr: string) => {
      return errStr.includes(substring);
    })(error);
  });
}

export const unwrapErr = <T, E>(result: Result<T, E>): E => {
  return unwrapErrWith(result, (_error) => true);
}

export const expectOk = <T, E>(result: Result<T, E>): Assertion<T> => {
  return result.match(
    (value) => expect(value),
    (error) => {
      throw new Error(`Expected Ok result, got Err: ${error}`)
    }
  );
}
