import type { JsonCodec } from "@konduit/codec/json/codecs";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2MillisatoshiCodec, type Millisatoshi } from "../bitcoin/asset";
import { json2PayeePubKeyCodec, type InvoiceString, type PayeePubKey } from "../bitcoin/bolt11";
import type { Json } from "@konduit/codec/json";
import { json2IndexCodec, type Index } from "../channel/squash";
import { json2LovelaceCodec, type Lovelace } from "../cardano";
import { json2MillisecondsCodec, type Milliseconds } from "../time/duration";

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
  readonly index: Index;
  readonly amount: Lovelace;
  readonly relativeTimeout: Milliseconds;
  readonly routingFee: Millisatoshi;
};

export const json2QuoteCodec: JsonCodec<Quote> = codec.rmap(
  jsonCodecs.objectOf({
    index: json2IndexCodec,
    amount: json2LovelaceCodec,
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


