import { Result } from "neverthrow";
import type { HttpEndpointError } from "../http";
import {
  mkPostEndpoint,
  RequestSerialiser,
  ResponseDeserialiser,
} from "../http";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2StringCodec, type JsonDeserialiser, type JsonError } from "@konduit/codec/json/codecs";
import { json2MillisatoshiCodec, type Millisatoshi } from "./asset";
import { stringify } from "@konduit/codec/json";
import * as codec from "@konduit/codec";
import * as uint8Array from "@konduit/codec/uint8Array";
import { string2NumberCodec } from "@konduit/codec/urlquery/codecs/sync";
import { int2NonNegativeIntCodec, NonNegativeInt, number2IntCodec } from "@konduit/codec/integers/smallish";
import { decodedInvoice2InvoiceDeserialiser, type Invoice } from "./bolt11";
import { bolt11 } from "@konduit/bln";

export type LndConfig = {
  baseUrl: string;
  macaroon: string;
};

export type AddInvoiceResponse = {
  addIndex: NonNegativeInt;
  paymentAddr: Uint8Array;
  invoice: Invoice;
  rHash: Uint8Array;
}

const json2AddInvoiceResponseDeserialiser: JsonDeserialiser<AddInvoiceResponse> = codec.pipeDeserialisers(
  jsonCodecs.objectOf({
    add_index: codec.pipe(
      codec.pipe(json2StringCodec, string2NumberCodec),
      codec.pipe(number2IntCodec, int2NonNegativeIntCodec)
    ),
    payment_addr: uint8Array.json2Uint8ArrayThroughBase64Codec,
    payment_request: json2StringCodec,
    r_hash: uint8Array.json2Uint8ArrayThroughBase64Codec,
  }).deserialise,
  (obj) => {
    return bolt11.parse(obj.payment_request).mapErr((err) => err as JsonError).andThen(decodedInvoice2InvoiceDeserialiser).map(
      (invoice: Invoice) => {
        return {
          addIndex: obj.add_index,
          paymentAddr: obj.payment_addr,
          invoice,
          rHash: obj.r_hash,
        } as AddInvoiceResponse;
      }
    );
  }
)


export type LndClient = {
  addLndInvoice: (msat: Millisatoshi, memo: string) => Promise<Result<AddInvoiceResponse, HttpEndpointError>>;
};

export const mkLndClient = (config: LndConfig): LndClient => {
  const addInvoiceEndpoint = mkPostEndpoint(
    `${config.baseUrl}/v1/invoices`,
    RequestSerialiser.fromJsonSerialiser((body: { amount: Millisatoshi; memo: string }) => ({
      value_msat: json2MillisatoshiCodec.serialise(body.amount),
      memo: body.memo,
    })),
    ResponseDeserialiser.fromJsonDeserialiser(json2AddInvoiceResponseDeserialiser)
  );

  return {
    addLndInvoice: async (msat: Millisatoshi, memo: string) => {
      return await addInvoiceEndpoint(
        { amount: msat, memo },
        [["Grpc-Metadata-macaroon", config.macaroon]]
      );
    },
  };
}

