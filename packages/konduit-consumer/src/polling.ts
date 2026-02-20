import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import type { Result } from "neverthrow";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as codec from "@konduit/codec";
import { json2ValidDateCodec, ValidDate } from "./time/absolute";
import { mkIdentityCodec } from "@konduit/codec";

export type SuccessfulFetch<T> = {
  value: T;
  fetchedAt: ValidDate;
};

export type FailedFetch<T> = {
  error: JsonError;
  fetchedAt: ValidDate;
  previousSuccessfulFetch: SuccessfulFetch<T> | null;
};

export type FetchResult<T> = SuccessfulFetch<T> | FailedFetch<T>;

export const mkJson2FetchResultCodec = <T>(json2ValueCodec: JsonCodec<T>): JsonCodec<FetchResult<T>> => {
  let json2SuccessfulFetchCodec: JsonCodec<SuccessfulFetch<T>> = jsonCodecs.objectOf({
    value: json2ValueCodec,
    fetchedAt: json2ValidDateCodec,
  });
  let json2FailedFetchCodec: JsonCodec<FailedFetch<T>> = jsonCodecs.objectOf({
    error: mkIdentityCodec(),
    fetchedAt: json2ValidDateCodec,
    previousSuccessfulFetch: jsonCodecs.nullable(json2SuccessfulFetchCodec),
  });
  return jsonCodecs.altJsonCodecs(
    [json2SuccessfulFetchCodec, json2FailedFetchCodec],
    (serSuccess, serFailed) => (fetchResult: FetchResult<T>) => {
      if ("value" in fetchResult) {
        return serSuccess(fetchResult);
      } else {
        return serFailed(fetchResult);
      }
    }
  );
};

export class PollingInfo<T> {
  readonly lastFetch: FetchResult<T> | null;

  constructor(lastFetch: FetchResult<T> | null) {
    this.lastFetch = lastFetch;
  }

  public static mkNew<T>(result: Result<T, JsonError>): PollingInfo<T> {
    const now = ValidDate.now();
    return result.match(
      (success) => new PollingInfo({
        value: success,
        fetchedAt: now,
      }),
      (error) => new PollingInfo({
        error,
        fetchedAt: now,
        previousSuccessfulFetch: null,
      })
    );
  }

  public get lastValue(): T | null {
    if (this.lastFetch && "value" in this.lastFetch) {
      return this.lastFetch.value;
    } else if (this.lastFetch && "previousSuccessfulFetch" in this.lastFetch && this.lastFetch.previousSuccessfulFetch) {
      return this.lastFetch.previousSuccessfulFetch.value;
    }
    return null;
  }

  public get lastFetchedAt(): ValidDate | null {
    if (this.lastFetch) {
      return this.lastFetch.fetchedAt;
    }
    return null;
  }

  public get lastSuccessfulFetch(): SuccessfulFetch<T> | null {
    if (this.lastFetch && "value" in this.lastFetch) {
      return this.lastFetch;
    }
    return (this.lastFetch && "previousSuccessfulFetch" in this.lastFetch) ? this.lastFetch.previousSuccessfulFetch : null;
  }

  public mkSuccessor(result: Result<T, JsonError>): PollingInfo<T> {
    const now = ValidDate.now();
    return result.match(
      (success) => new PollingInfo({
        value: success,
        fetchedAt: now,
      }),
      (error) => {
        const previousSuccessfulFetch = this.lastSuccessfulFetch
          ? {
              value: this.lastSuccessfulFetch.value,
              fetchedAt: this.lastSuccessfulFetch.fetchedAt,
            }
          : null;
        return new PollingInfo({
          error,
          fetchedAt: now,
          previousSuccessfulFetch,
        });
      }
    );
  }
}

export const mkJson2PollingInfoCodec = <T>(json2ResultCodec: JsonCodec<T>): JsonCodec<PollingInfo<T>> => {
  const json2FetchResultCodec = mkJson2FetchResultCodec(json2ResultCodec);
  return codec.rmap(
    jsonCodecs.nullable(json2FetchResultCodec),
    (fetchResult: FetchResult<T> | null) => new PollingInfo(fetchResult),
    (pollingInfo: PollingInfo<T>) => pollingInfo.lastFetch
  );
}
