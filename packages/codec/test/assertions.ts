import { Result } from 'neverthrow';
import { onString } from '../src/json';

export const expectOk = <T, Err>(result: Result<T, Err>, msgTemplate?: string): T => {
  const mkMessage = (err: any) => {
    const tpl = msgTemplate || "Expected Ok result, got Err: ERROR_STR"
    return tpl.replace("ERROR_STR", String(err));
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

export const expectErrWithSubstring = <T, E>(result: Result<T, E>, substring: string): E => {
  return expectErrWith(result, (error) => {
    return onString((_) => false)((errStr: string) => {
      return errStr.includes(substring);
    })(error);
  });
}

export const expectErr = <T, E>(result: Result<T, E>): E => {
  return expectErrWith(result, (_error) => true);
}

