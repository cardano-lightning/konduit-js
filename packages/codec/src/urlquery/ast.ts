import { ok, err } from "neverthrow";
import type { Codec } from "../codec";
import type { JsonError } from "../json/codecs";

export type QueryValue = string | string[]

export type UrlQuery = Record<string, QueryValue>

export const string2UrlQueryCodec: Codec<string, UrlQuery, JsonError> = {
  deserialise: (input: string) => {
    try {
      const params = new URLSearchParams(input);
      const query: UrlQuery = {};

      for (const [key, value] of params.entries()) {
        const existing = query[key];
        if (existing === undefined) {
          query[key] = value;
        } else if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          query[key] = [existing, value];
        }
      }

      return ok(query);
    } catch (e: any) {
      return err(`Invalid query string: ${e?.message ?? String(e)}` as JsonError);
    }
  },
  serialise: (query: UrlQuery): string => {
    const params = new URLSearchParams();

    for (const key of Object.keys(query)) {
      const value = query[key]!;
      if (Array.isArray(value)) {
        for (const v of value) {
          params.append(key, v);
        }
      } else {
        params.append(key, value);
      }
    }

    return params.toString();
  }
};
