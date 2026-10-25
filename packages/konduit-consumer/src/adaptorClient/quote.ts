import type { JsonCodec } from "@konduit/codec/json/codecs";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2MillisatoshiCodec, type Millisatoshi } from "../bitcoin/asset";
import { json2PayeePubKeyCodec, type PayeePubKey } from "../bitcoin/bolt11";
import type { Json } from "@konduit/codec/json";
import { json2IndexCodec, type Index } from "../channel/squash";
import { Lovelace } from "../cardano";
import { json2MillisecondsCodec, type Milliseconds } from "../time/duration";
import type { InvoiceString } from "@konduit/bln/invoice/bolt11";

// We use the naming convention from the server
export type QuoteBody =
  | { amount: Millisatoshi; payee: PayeePubKey }
  | InvoiceString // Contains "raw" bolt11 string

export const json2QuoteBodySerialiser = (body: QuoteBody): Json => {
  if (typeof body === "string") return { "Bolt11": body };
  return {
    "Simple": {
      amount_msat: json2MillisatoshiCodec.serialise(body.amount),
      payee: json2PayeePubKeyCodec.serialise(body.payee)
    }
  };
};

export type Quote = {
  // Next channel index
  readonly index: Index;
  // Total (invoice + routing fees) expressed in Lovelace.
  readonly amount: Lovelace;
  readonly relativeTimeout: Milliseconds;
  // Routing fee alone.
  readonly routingFee: Millisatoshi;
};
export namespace Quote {
  export const min = (quote1: Quote, quote2: Quote): Quote => {
    if (quote1.amount < quote2.amount) {
      return quote1;
    } else {
      return quote2;
    }
  }
}

export const json2QuoteCodec: JsonCodec<Quote> = codec.rmap(
  jsonCodecs.objectOf({
    index: json2IndexCodec,
    amount: Lovelace.jsonCodec,
    relative_timeout: json2MillisecondsCodec,
    routing_fee: json2MillisatoshiCodec,
  }),
  (obj) => ({
    index: obj.index,
    amount: obj.amount,
    relativeTimeout: obj.relative_timeout,
    routingFee: obj.routing_fee,
  }),
  (quoteResponse) => ({
    index: quoteResponse.index,
    amount: quoteResponse.amount,
    relative_timeout: quoteResponse.relativeTimeout,
    routing_fee: quoteResponse.routingFee,
  }),
)


