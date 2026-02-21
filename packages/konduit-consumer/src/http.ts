 // A rather systematic approach for making HTTP requests/clients.
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import type { JsonDeserialiser, JsonError, JsonSerialiser } from "@konduit/codec/json/codecs";
import { type Json, parse, stringify } from "@konduit/codec/json";
import { type CborDeserialiser, type CborSerialiser, deserialiseCbor, serialiseCbor } from "@konduit/codec/cbor/codecs/sync";
import type { Cbor } from "@konduit/codec/cbor/core";
import { HexString, fromUint8Array as hex } from "@konduit/codec/hexString";

export type Url = string;

// We are trying to decode the body of an error response
// to simplify debugging. Returning Uint8Array which is the lowest
// common denominator is useful but not extremely developer-friendly.
export type DecodedErrorBody =
  | { type: "bytes", value: HexString }
  | { type: "text", decoded: string, raw: HexString }
  | { type: "json", decoded: Json, raw: HexString }
  | { type: "cbor", decoded: Cbor, raw: HexString }
export namespace DecodedErrorBody {
  export const fromBytes = (value: Uint8Array): DecodedErrorBody => ({ type: "bytes", value: hex(value) })
  export const fromText = (decoded: string, raw: Uint8Array): DecodedErrorBody => ({ type: "text", decoded, raw: hex(raw) });
  export const fromJson = (decoded: Json, raw: Uint8Array): DecodedErrorBody => ({ type: "json", decoded, raw: hex(raw) });
  export const fromCbor = (decoded: Cbor, raw: Uint8Array): DecodedErrorBody => ({ type: "cbor", decoded, raw: hex(raw) });
  // TODO: We should probably use or at least include the `Content-Type` header here.
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

type RequestInfo = {
  headers?: [string, string][];
  method: string;
  payload?: ArrayBuffer | string;
  url: string;
}

const mkRequestInfo = (url: string, method: string, headers: [string, string][], payload?: ArrayBuffer | string): RequestInfo => {
  return {
    headers,
    method,
    payload,
    url,
  };
};


export type HttpEndpointError =
  | {
    body: DecodedErrorBody,
    requestInfo: RequestInfo;
    status: number;
    statusText: string;
    type: "HttpError";
  }
  | {
    message: string,
    requestInfo: RequestInfo;
    type: "NetworkError";
  }
  | {
    body: DecodedErrorBody;
    decodingError?: JsonError;
    message: JsonError;
    requestInfo: RequestInfo;
    type: "DeserialisationError";
  };

export type RequestSerialiser<T> =
  | { type: "other", contentType: string, serialiser: (value: T) => ArrayBuffer | string }
  | { type: "json"; serialiser: JsonSerialiser<T> }
  | { type: "cbor"; serialiser: CborSerialiser<T> };
export namespace RequestSerialiser {
  export const fromJsonSerialiser = <T>(serialiser: JsonSerialiser<T>): RequestSerialiser<T> => ({ type: "json", serialiser });
  export const fromCborSerialiser = <T>(serialiser: CborSerialiser<T>): RequestSerialiser<T> => ({ type: "cbor", serialiser });
  export const fromOtherSerialiser = <T>(contentType: string, serialiser: (value: T) => ArrayBuffer | string): RequestSerialiser<T> => ({ type: "other", contentType, serialiser });
}

export type ResponseDeserialiser<T> =
  | { type: "json"; deserialiser: JsonDeserialiser<T> }
  | { type: "cbor"; deserialiser: CborDeserialiser<T> };
export namespace ResponseDeserialiser {
  export const fromJsonDeserialiser = <T>(deserialiser: JsonDeserialiser<T>): ResponseDeserialiser<T> => ({ type: "json", deserialiser });
  export const fromCborDeserialiser = <T>(deserialiser: CborDeserialiser<T>): ResponseDeserialiser<T> => ({ type: "cbor", deserialiser });
}

// TODO: add URL path and query serialiser
export const mkPostEndpoint = <Req, Res>(url: Url, requestSerialiser: RequestSerialiser<Req>, responseDeserialiser: ResponseDeserialiser<Res>) => {
  return async (requestBody: Req, headers: [string, string][] = []): Promise<Result<Res, HttpEndpointError>> => {
    const contentTypeHeader = (() => {
      switch (requestSerialiser.type) {
        case "json": return "application/json";
        case "cbor": return "application/cbor";
        case "other": return requestSerialiser.contentType;
      }
    })();
    const payload = (() => {
      switch (requestSerialiser.type) {
        case "json":
          const json = requestSerialiser.serialiser(requestBody);
          return stringify(json);
        case "cbor": {
          const cbor = requestSerialiser.serialiser(requestBody);
          let uint8Array = serialiseCbor(cbor);
          return uint8Array.buffer.slice(
            uint8Array.byteOffset,
            uint8Array.byteOffset + uint8Array.byteLength,
          ) as ArrayBuffer;
        }
        case "other": {
          return requestSerialiser.serialiser(requestBody);
        }
      }
    })();
    const acceptHeader = (() => {
      switch (responseDeserialiser.type) {
        case "json": return "application/json";
        case "cbor": return "application/cbor";
      }
    })();
    let httpResponse: Response;
    let requestHeaders: [string, string][] = [...headers, ["Content-Type", contentTypeHeader], ["Accept", acceptHeader]];
    try {
      httpResponse = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: payload,
      });
    } catch (error: any) {
      return err({ type: "NetworkError", message: error.message || String(error), requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload) });
    }

    let bodyBytes: Uint8Array;
    try {
      bodyBytes = new Uint8Array(await httpResponse.arrayBuffer());
    } catch (error: any) {
      return err({ type: "NetworkError", message: `Failed to read response body as bytes: ${error.message || String(error)}`, requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload) });
    }
    if (!httpResponse.ok) {
      return err({
        type: "HttpError",
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        body: DecodedErrorBody.decode(bodyBytes),
        requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload),
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
            requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload),
            type: "DeserialisationError",
          });
        }
        const possibleJson = parse(bodyText).orElse((origParsingError) => {
            // Let's split into multiple lines, drop empty lines and try to parse every line separately.
            let lines = bodyText.split("\n").map(line => line.trim()).filter(line => line.length > 0);
            let result: Json[] = [];
            let loopParsingError = null;
            while(lines.length > 0 && loopParsingError === null) {
              let line = lines.shift()!;
              let possibleJson = parse(line);
              possibleJson.match(
                (json) => result.push(json),
                (err) => loopParsingError = err
              );
            }
            if (result.length > 0) {
              if(loopParsingError !== null) {
                return err({
                  body: DecodedErrorBody.fromJson(result.length === 1 ? result[0] : result, bodyBytes),
                  decodingError: loopParsingError,
                  message: `Failed to parse the whole response body as JSON stream. Successfully parsed ${result.length} JSON line(s) before error: ${loopParsingError}`,
                  requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload),
                  type: "DeserialisationError",
                } as HttpEndpointError);
              } else {
                return ok(result as Json);
              }
            }
            return err({
              body: DecodedErrorBody.fromText(bodyText, bodyBytes),
              decodingError: origParsingError,
              message: `Failed to parse response body as JSON`,
              requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload),
              type: "DeserialisationError",
            } as HttpEndpointError)
          }
        );
        return possibleJson.andThen((json) => responseDeserialiser.deserialiser(json).mapErr((error) => ({
            body: DecodedErrorBody.fromJson(json, bodyBytes),
            decodingError: error,
            message: `Failed to deserialise JSON response`,
            requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload),
            type: "DeserialisationError",
          } as HttpEndpointError)),
        );
      }
      case "cbor": {
        let possibleCbor = deserialiseCbor(bodyBytes);
        return possibleCbor.match(
          (cbor) => responseDeserialiser.deserialiser(cbor).mapErr((error) => ({
            body: DecodedErrorBody.fromCbor(cbor, bodyBytes),
            decodingError: error,
            message: `Failed to deserialise CBOR response`,
            requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload),
            type: "DeserialisationError",
          })),
          (error) => err({
            body: DecodedErrorBody.fromBytes(bodyBytes),
            decodingError: error,
            message: `Failed to parse response body as CBOR`,
            requestInfo: mkRequestInfo(url, "POST", requestHeaders, payload),
            type: "DeserialisationError",
          })
        );
      }
    }
  }
}

export type TextSerialiser<T> = (value: T) => string;

// TODO: add URL path and query serialiser
export const mkGetEndpoint = <Req, Res>(baseUrl: Url, pathSerialiser: TextSerialiser<Req>, responseDeserialiser: ResponseDeserialiser<Res>) => {
  const normalisedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return async (req: Req, headers: [string, string][] = []): Promise<Result<Res, HttpEndpointError>> => {
    const acceptHeader = (() => {
      switch (responseDeserialiser.type) {
        case "json": return "application/json";
        case "cbor": return "application/cbor";
      }
    })();

    let httpResponse: Response;
    let normalisedPath = (() => {
      const path = pathSerialiser(req);
      return path.startsWith("/") ? path.slice(1) : path;
    })();
    let fullUrl = `${normalisedBaseUrl}/${normalisedPath}`;
    let requestHeaders: [string, string][] = [...headers, ["Accept", acceptHeader]];
    try {
      httpResponse = await fetch(fullUrl, {
        method: "GET",
        headers: requestHeaders,
      });
    } catch (error: any) {
      return err({ type: "NetworkError", message: error.message || String(error), requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders) });
    }

    let bodyBytes: Uint8Array;
    try {
      bodyBytes = new Uint8Array(await httpResponse.arrayBuffer());
    } catch (error: any) {
      return err({ type: "NetworkError", message: `Failed to read response body as bytes: ${error.message || String(error)}`, requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders) });
    }

    if (!httpResponse.ok) {
      return err({
        body: DecodedErrorBody.decode(bodyBytes),
        requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders),
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        type: "HttpError",
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
            requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders),
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
              requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders),
              type: "DeserialisationError",
            })),
          (error) =>
            err({
              body: DecodedErrorBody.fromText(bodyText, bodyBytes),
              decodingError: error,
              message: `Failed to parse response body as JSON`,
              requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders),
              type: "DeserialisationError",
            })
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
              requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders),
              type: "DeserialisationError",
            })),
          (error) =>
            err({
              body: DecodedErrorBody.fromBytes(bodyBytes),
              decodingError: error,
              message: `Failed to parse response body as CBOR`,
              requestInfo: mkRequestInfo(fullUrl, "GET", requestHeaders),
              type: "DeserialisationError",
            })
        );
      }
    }
  };
};

export const mkGetStaticEndpoint = <Res>(baseUrl: Url, path: string, responseDeserialiser: ResponseDeserialiser<Res>) => {
  const endpoint = mkGetEndpoint(
    baseUrl,
    () => path,
    responseDeserialiser
  );
  return () => endpoint(null);
}
