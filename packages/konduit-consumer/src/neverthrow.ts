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

