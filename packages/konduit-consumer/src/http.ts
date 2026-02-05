import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import type { JsonDeserialiser, JsonError } from "@konduit/codec/json/codecs";
import { parse } from "@konduit/codec/json";

export type Url = string;

export type GetDeserialiseError =
  | { type: "HttpError"; status: number; statusText: string; body: string }
  | { type: "NetworkError"; message: string }
  | { type: "DeserialisationError"; message: JsonError };

export const getDeserialise = async <T>(url: Url, deserialiser: JsonDeserialiser<T>, headers: [string, string][] = []): Promise<Result<T, GetDeserialiseError>> => {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: [...headers, ["Accept", "application/json"]],
    });
    if (!response.ok) {
      const body = await response.text();
      return err({ type: "HttpError", status: response.status, statusText: response.statusText, body });
    }
    // This is important - we use our custom Json deserialiser which uses bigint
    const jsonStr = await response.text();
    const possibleJson = parse(jsonStr);
    return possibleJson.andThen((json) => deserialiser(json)).match(
      (value) => ok(value),
      (error) => err({ type: "DeserialisationError", message: error }),
    );
  } catch (error: any) {
    return err({ type: "NetworkError", message: error.message || String(error) });
  }
}
