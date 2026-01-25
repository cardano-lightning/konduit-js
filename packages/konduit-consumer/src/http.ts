import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import type { JsonDeserialiser, JsonError } from "@konduit/codec/json/codecs";

export type Url = string;

export type GetDeserialiseError =
  | { type: "HttpError"; status: number; statusText: string; body: string }
  | { type: "NetworkError"; message: string }
  | { type: "DeserialisationError"; message: JsonError };

export const getDeserialise = async <T>(url: Url, deserialiser: JsonDeserialiser<T>): Promise<Result<T, GetDeserialiseError>> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      return err({ type: "HttpError", status: response.status, statusText: response.statusText, body });
    }
    const json = await response.json();
    const deserialisationResult = deserialiser(json);
    return deserialisationResult.match(
      (value) => ok(value),
      (error) => err({ type: "DeserialisationError", message: error }),
    );
  } catch (error: any) {
    return err({ type: "NetworkError", message: error.message || String(error) });
  }
}
