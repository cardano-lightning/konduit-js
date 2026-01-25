// Extra helpers for neverthrow library

import { err, ok, Result } from "neverthrow";

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
