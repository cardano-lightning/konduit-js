import { isJson, stringify } from '@konduit/codec/json';
import type { Result } from 'neverthrow';
import { ok, err, ResultAsync } from 'neverthrow';

// DEPRECATED: Use shorter toPromise instead
export const resultAsyncToPromise = async <T, E>(resultAsync: ResultAsync<T, E>): Promise<Result<T, E>> => {
  return resultAsync.match(
    (value) => Promise.resolve(ok(value)),
    (error) => Promise.resolve(err(error))
  );
}

export const toPromise = async <T, E>(resultAsync: ResultAsync<T, E>): Promise<Result<T, E>> => {
  return resultAsync.match(
    (value) => Promise.resolve(ok(value)),
    (error) => Promise.resolve(err(error))
  );
}

// DEPRECATED: Use constructor directly or shorter promiseToAsync instead
export const promiseToResultAsync = <T, E>(promise: Promise<Result<T, E>>): ResultAsync<T, E> => {
  return new ResultAsync(promise);
}

export const promiseToAsync = <T, E>(promise: Promise<Result<T, E>>): ResultAsync<T, E> => {
  return new ResultAsync(promise);
}

export const okAsyncPromise = <T, E>(value: Promise<T>): ResultAsync<T, E> => {
  return promiseToAsync(value.then(v => ok(v) as Result<T, E>));
}

// DEPRECATED: Use shorter toAsync instead
export const hoistToResultAsync = <T, E>(result: Result<T, E>): ResultAsync<T, E> => {
  return promiseToResultAsync(Promise.resolve(result));
}

export const toAsync = <T, E>(result: Result<T, E>): ResultAsync<T, E> => {
  return new ResultAsync(Promise.resolve(result));
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

export const assert = (condition: boolean, errorMessage: string): void => {
  if (!condition) {
    throw new Error(errorMessage);
  }
}
