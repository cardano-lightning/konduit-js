import { isJson, stringify } from '@konduit/codec/json';
import type { Result } from 'neverthrow';
import { ok, err, ResultAsync } from 'neverthrow';

export const resultAsyncToPromise = async <T, E>(resultAsync: ResultAsync<T, E>): Promise<Result<T, E>> => {
  return resultAsync.match(
    (value) => Promise.resolve(ok(value)),
    (error) => Promise.resolve(err(error))
  );
}

export const hoistToResultAsync = <T, E>(promise: Promise<Result<T, E>>): ResultAsync<T, E> => {
  return new ResultAsync(promise);
}

export const unwrapOrPanic = <T, E>(result: Result<T, E>, errorMessage: string): T => {
  return result.match(
    (value) => value,
    (error) => {
      if(isJson(error)) {
        throw new Error(`${errorMessage}: ${stringify(error)}`);
      }
      throw new Error(`${errorMessage}: ${String(error)}`);
    }
  );
}

export const unwrapOrPanicWith = <T, E>(result: Result<T, E>, mkMessageFn: (error: E) => string): T => {
  return result.match(
    (value) => value,
    (error) => {
      const errorMessage = mkMessageFn(error);
      if(isJson(error)) {
        throw new Error(`${errorMessage}: ${stringify(error)}`);
      }
      throw new Error(`${errorMessage}: ${String(error)}`);
    }
  );
}
