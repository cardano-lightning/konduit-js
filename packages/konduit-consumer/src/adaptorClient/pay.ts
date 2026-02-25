import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2Ed25519SignatureCodec } from "../cardano/keys";
import { json2ChequeBodyCodec, type ChequeBody } from "../channel/squash";
import { json2StringCodec, type JsonError } from "@konduit/codec/json/codecs";
import type { Ed25519Signature } from "@konduit/cardano-keys";
import { decodedInvoice2InvoiceDeserialiser, type Invoice } from "../bitcoin/bolt11";
import { bolt11 } from "@konduit/bln";
import { json2SquashResponseDeserialiser, type SquashResponse } from "./squash";

export type PayBody = {
  chequeBody: ChequeBody;
  signature: Ed25519Signature;
  invoice: Invoice;
};

const json2PayBodyDeserialiser: jsonCodecs.JsonDeserialiser<PayBody> = (() => {
  const resRecordDeserialise = jsonCodecs.objectOf({
    cheque_body: json2ChequeBodyCodec,
    signature: json2Ed25519SignatureCodec,
    invoice: json2StringCodec,
  }).deserialise;

  return codec.pipeDeserialisers(
    resRecordDeserialise,
    (j) => bolt11.parse(j.invoice).mapErr((error) => error as JsonError).andThen(decodedInvoice2InvoiceDeserialiser).map((invoice) => {
          return {
            chequeBody: j.cheque_body,
            signature: j.signature,
            invoice,
          } as PayBody;
    })
  );
})();
const json2PayBodySerialiser = (body: PayBody) => {
  return {
    cheque_body: json2ChequeBodyCodec.serialise(body.chequeBody),
    signature: json2Ed25519SignatureCodec.serialise(body.signature),
    invoice: body.invoice.raw,
  };
};
export const json2PayBodyCodec: jsonCodecs.JsonCodec<PayBody> = {
  serialise: json2PayBodySerialiser,
  deserialise: json2PayBodyDeserialiser,
};

export type PayResponse = SquashResponse;

export const json2PayResponseDeserialiser: jsonCodecs.JsonDeserialiser<PayResponse> = json2SquashResponseDeserialiser;

