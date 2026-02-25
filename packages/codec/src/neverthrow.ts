// Extra helpers for neverthrow library

import { err, errAsync, ok, okAsync, Result, ResultAsync } from "neverthrow";

// Try to stringify the exception and append that to the message if provided
export const stringifyThrowable = <T>(fn: () => T, message: string = ""): Result<T, string> => {
  try {
    return ok(fn());
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const fullMessage = message ? `${message}: ${errorMessage}` : errorMessage;
    return err(fullMessage);
  }
}

export const stringifyAsyncThrowable = async <T>(fn: () => Promise<T>, message: string = ""): Promise<Result<T, string>> => {
  try {
    const result = await fn();
    return ok(result);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const fullMessage = message ? `${message}: ${errorMessage}` : errorMessage;
    return err(fullMessage);
  }
}

export const resultToResultAsync = <T, E>(result: Result<T, E>): ResultAsync<T, E> => {
  return result.match(
    (value) => okAsync(value),
    (error) => errAsync(error)
  );
}

export const unsafeUnwrap = <T, E>(result: Result<T, E>): T => {
  return result.match(
    (value) => value,
    (error) => {
      throw new Error(`Attempted to unwrap an Err result: ${String(error)}`);
    }
  );
}

