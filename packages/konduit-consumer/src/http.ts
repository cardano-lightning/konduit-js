// A rather systematic approach for making HTTP requests/clients.
import type { Result } from "neverthrow";
import { err } from "neverthrow";
import type { JsonDeserialiser, JsonError, JsonSerialiser } from "@konduit/codec/json/codecs";
import { Json, parse, stringify } from "@konduit/codec/json";
import { CborDeserialiser, CborSerialiser, deserialiseCbor, serialiseCbor } from "@konduit/codec/cbor/codecs/sync";
import { Cbor } from "@konduit/codec/cbor/core";

export type Url = string;

// We are trying to decode the body of an error response
// to simplify debugging. Returning Uint8Array which is lower
// common denominator would not be helpful.
export type DecodedErrorBody =
  | { type: "bytes", value: Uint8Array }
  | { type: "text", decoded: string, raw: Uint8Array }
  | { type: "json", decoded: Json, raw: Uint8Array }
  | { type: "cbor", decoded: Cbor, raw: Uint8Array }
export namespace DecodedErrorBody {
  export const fromBytes = (value: Uint8Array): DecodedErrorBody => ({ type: "bytes", value });
  export const fromText = (decoded: string, raw: Uint8Array): DecodedErrorBody => ({ type: "text", decoded, raw });
  export const fromJson = (decoded: Json, raw: Uint8Array): DecodedErrorBody => ({ type: "json", decoded, raw });
  export const fromCbor = (decoded: Cbor, raw: Uint8Array): DecodedErrorBody => ({ type: "cbor", decoded, raw });
  // TODO: We should probably use or at least include the content type header here.
  export const decode = (bodyBytes: Uint8Array): DecodedErrorBody => {
    let text: string;
    try {
      text = new TextDecoder().decode(bodyBytes);
    } catch {
      try {
        const cbor = deserialiseCbor(bodyBytes).unwrapOr(bodyBytes);
        return DecodedErrorBody.fromCbor(cbor, bodyBytes);
      } catch {
        return DecodedErrorBody.fromBytes(bodyBytes);
      }
    }
    try {
      const json = parse(text);
      return DecodedErrorBody.fromJson(json.unwrapOr(text), bodyBytes);
    } catch {
      return DecodedErrorBody.fromText(text, bodyBytes);
    }
  };
}

export type HttpEndpointError =
  | { type: "HttpError"; status: number; statusText: string; body: DecodedErrorBody }
  | { type: "NetworkError"; message: string }
  | { type: "DeserialisationError"; message: JsonError; body: DecodedErrorBody; decodingError?: JsonError };

export type Body =
  | { type: "text"; value: string }
  | { type: "json"; value: Json }
  | { type: "cbor"; value: Cbor };
export namespace Body {
  export const fromText = (value: string): Body => ({ type: "text", value });
  export const fromJson = (value: Json): Body => ({ type: "json", value });
  export const fromCbor = (value: Cbor): Body => ({ type: "cbor", value });
}

export type RequestSerialiser<T> =
  | { type: "json"; serialiser: JsonSerialiser<T> }
  | { type: "text" }
  | { type: "cbor"; serialiser: CborSerialiser<T> };

export type ResponseDeserialiser<T> =
  | { type: "json"; deserialiser: JsonDeserialiser<T> }
  | { type: "cbor"; deserialiser: CborDeserialiser<T> };
export namespace ResponseDeserialiser {
  export const fromJsonDeserialiser = <T>(deserialiser: JsonDeserialiser<T>): ResponseDeserialiser<T> => ({ type: "json", deserialiser });
  export const fromCborDeserialiser = <T>(deserialiser: CborDeserialiser<T>): ResponseDeserialiser<T> => ({ type: "cbor", deserialiser });
}

export const mkPostEndpoint = <Req, Res>(url: Url, requestSerialiser: RequestSerialiser<Req>, responseDeserialiser: ResponseDeserialiser<Res>) => {
  return async (requestBody: Req, headers: [string, string][] = []): Promise<Result<Res, HttpEndpointError>> => {
    const contentTypeHeader = (() => {
      switch (requestSerialiser.type) {
        case "json": return "application/json";
        case "cbor": return "application/cbor";
      }
    })();
    const payload = (() => {
      switch (requestSerialiser.type) {
        case "json": return stringify(requestBody as unknown as Json);
        case "cbor": return serialiseCbor(requestBody as unknown as Cbor);
      }
    })();
    const acceptHeader = (() => {
      switch (responseDeserialiser.type) {
        case "json": return "application/json";
        case "cbor": return "application/cbor";
      }
    })();
    let httpResponse: Response;
    try {
      httpResponse = await fetch(url, {
        method: "POST",
        headers: [...headers, ["Content-Type", contentTypeHeader], ["Accept", acceptHeader]],
        body: payload,
      });
    } catch (error: any) {
      return err({ type: "NetworkError", message: error.message || String(error) });
    }

    let bodyBytes: Uint8Array;
    try {
      bodyBytes = new Uint8Array(await httpResponse.arrayBuffer());
    } catch (error: any) {
      return err({ type: "NetworkError", message: `Failed to read response body as bytes: ${error.message || String(error)}` });
    }
    if (!httpResponse.ok) {
      return err({
        type: "HttpError",
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        body: DecodedErrorBody.decode(bodyBytes)
      });
    }
    switch (responseDeserialiser.type) {
      case "json": {
        let bodyText: string;
        try {
          bodyText = new TextDecoder().decode(bodyBytes);
        } catch (error: any) {
          return err({
            body: DecodedErrorBody.fromBytes(bodyBytes),
            message: `Failed to decode response body as text (required for Json): ${error.message || String(error)}`,
            type: "DeserialisationError",
          });
        }
        const possibleJson = parse(bodyText);
        return possibleJson.match(
          (json) => responseDeserialiser.deserialiser(json).mapErr((error) => ({
            body: DecodedErrorBody.fromJson(json, bodyBytes),
            decodingError: error,
            message: `Failed to deserialise JSON response`,
            type: "DeserialisationError",
          } as HttpEndpointError)),
          (error) => err({
            body: DecodedErrorBody.fromText(bodyText, bodyBytes),
            decodingError: error,
            message: `Failed to parse response body as JSON`,
            type: "DeserialisationError",
          } as HttpEndpointError)
        );
      }
      case "cbor": {
        let possibleCbor = deserialiseCbor(bodyBytes);
        return possibleCbor.match(
          (cbor) => responseDeserialiser.deserialiser(cbor).mapErr((error) => ({
            body: DecodedErrorBody.fromCbor(cbor, bodyBytes),
            decodingError: error,
            message: `Failed to deserialise CBOR response`,
            type: "DeserialisationError",
          } as HttpEndpointError)),
          (error) => err({
            body: DecodedErrorBody.fromBytes(bodyBytes),
            decodingError: error,
            message: `Failed to parse response body as CBOR`,
            type: "DeserialisationError",
          } as HttpEndpointError)
        );
      }
    }
  }
}

export const mkGetEndpoint = <Res>(url: Url, responseDeserialiser: ResponseDeserialiser<Res>) => {
  return async (headers: [string, string][] = []): Promise<Result<Res, HttpEndpointError>> => {
    const acceptHeader = (() => {
      switch (responseDeserialiser.type) {
        case "json": return "application/json";
        case "cbor": return "application/cbor";
      }
    })();

    let httpResponse: Response;
    try {
      httpResponse = await fetch(url, {
        method: "GET",
        headers: [...headers, ["Accept", acceptHeader]],
      });
    } catch (error: any) {
      return err({ type: "NetworkError", message: error.message || String(error) });
    }

    let bodyBytes: Uint8Array;
    try {
      bodyBytes = new Uint8Array(await httpResponse.arrayBuffer());
    } catch (error: any) {
      return err({ type: "NetworkError", message: `Failed to read response body as bytes: ${error.message || String(error)}` });
    }

    if (!httpResponse.ok) {
      return err({
        type: "HttpError",
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        body: DecodedErrorBody.decode(bodyBytes),
      });
    }

    switch (responseDeserialiser.type) {
      case "json": {
        let bodyText: string;
        try {
          bodyText = new TextDecoder().decode(bodyBytes);
        } catch (error: any) {
          return err({
            body: DecodedErrorBody.fromBytes(bodyBytes),
            message: `Failed to decode response body as text (required for Json): ${error.message || String(error)}`,
            type: "DeserialisationError",
          });
        }

        const possibleJson = parse(bodyText);
        return possibleJson.match(
          (json) =>
            responseDeserialiser.deserialiser(json).mapErr((error) => ({
              body: DecodedErrorBody.fromJson(json, bodyBytes),
              decodingError: error,
              message: `Failed to deserialise JSON response`,
              type: "DeserialisationError",
            } as HttpEndpointError)),
          (error) =>
            err({
              body: DecodedErrorBody.fromText(bodyText, bodyBytes),
              decodingError: error,
              message: `Failed to parse response body as JSON`,
              type: "DeserialisationError",
            } as HttpEndpointError)
        );
      }

      case "cbor": {
        const possibleCbor = deserialiseCbor(bodyBytes);
        return possibleCbor.match(
          (cbor) =>
            responseDeserialiser.deserialiser(cbor).mapErr((error) => ({
              body: DecodedErrorBody.fromCbor(cbor, bodyBytes),
              decodingError: error,
              message: `Failed to deserialise CBOR response`,
              type: "DeserialisationError",
            } as HttpEndpointError)),
          (error) =>
            err({
              body: DecodedErrorBody.fromBytes(bodyBytes),
              decodingError: error,
              message: `Failed to parse response body as CBOR`,
              type: "DeserialisationError",
            } as HttpEndpointError)
        );
      }
    }
  };
};
