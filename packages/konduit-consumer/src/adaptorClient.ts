import type { Tagged } from "type-fest";
import { Result } from "neverthrow";
import { ok } from "neverthrow";
import { AdaptorInfo, json2AdaptorInfoCodec } from "./adaptorClient/adaptorInfo";
import type { HttpEndpointError } from "./http";
import {
  mkGetStaticEndpoint,
  mkPostEndpoint,
  RequestSerialiser,
  ResponseDeserialiser,
} from "./http";
import { hexString2KeyTagCodec, KeyTag, type ChannelTag } from "./channel/core";
import type { Cheque, Squash } from "./channel/squash";
import { cbor2SquashCodec } from "./channel/squash";
import type { ConsumerEd25519VerificationKey } from "./channel/l1Channel";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2StringCodec, type JsonCodec } from "@konduit/codec/json/codecs";
import { json2QuoteBodySerialiser, json2QuoteCodec, type Quote, type QuoteBody } from "./adaptorClient/quote";
import { json2SquashResponseDeserialiser, type SquashResponse } from "./adaptorClient/squash";
export type { SquashResponse } from "./adaptorClient/squash";
import {
  json2PayBodyCodec,
  json2PayResponseDeserialiser,
  type PayBody,
  type PayResponse,
} from "./adaptorClient/pay";
import type { Invoice } from "./bitcoin/bolt11";

export { AdaptorInfo } from "./adaptorClient/adaptorInfo";

export type AdaptorUrl = Tagged<string, "AdaptorUrl">;

export const json2AdaptorUrlCodec = codec.pipe(
  json2StringCodec,
  {
    deserialise: (s: string) => ok(s as AdaptorUrl),
    serialise: (url: AdaptorUrl) => url as string,
  }
);

const mkInfoEndpoint = (baseUrl: AdaptorUrl) => mkGetStaticEndpoint(
  baseUrl,
  "/info",
  ResponseDeserialiser.fromJsonDeserialiser(json2AdaptorInfoCodec.deserialise)
);

export type AdaptorFullInfo = Tagged<[AdaptorUrl, AdaptorInfo], "AdaptorFullInfo">;
export namespace AdaptorFullInfo {
  export const fromString = async (url: string): Promise<Result<AdaptorFullInfo, HttpEndpointError>> => {
    const normalisedUrl = url.endsWith("/") ? (url.slice(0, -1) as AdaptorUrl) : (url as AdaptorUrl);
    const infoEndpoint = mkInfoEndpoint(normalisedUrl);
    const possibleAdaptorInfo = await infoEndpoint();
    return possibleAdaptorInfo.map((adaptorInfo) => [normalisedUrl, adaptorInfo] as AdaptorFullInfo);
  };
}

const mkQuoteEndpoint = (baseUrl: AdaptorUrl) => mkPostEndpoint(
  `${baseUrl}/ch/quote`,
  RequestSerialiser.fromJsonSerialiser(json2QuoteBodySerialiser),
  ResponseDeserialiser.fromJsonDeserialiser(json2QuoteCodec.deserialise)
);

export type AdaptorClient = {
  adaptorUrl: AdaptorUrl;
  info: () => Promise<Result<AdaptorInfo, HttpEndpointError>>;
  chSquash: (keyTag: KeyTag, squash: Squash) => Promise<Result<SquashResponse, HttpEndpointError>>;
  chQuote: (keyTag: KeyTag, quoteBody: QuoteBody) => Promise<Result<Quote, HttpEndpointError>>;
  chPay: (keyTag: KeyTag, cheque: Cheque, invoice: Invoice) => Promise<Result<PayResponse, HttpEndpointError>>;
};

export const json2AdaptorClientCodec: JsonCodec<AdaptorClient> = codec.rmap(
  jsonCodecs.objectOf({
    adaptor_url: json2AdaptorUrlCodec,
    type: jsonCodecs.constant("AdaptorClient" as const),
  }),
  (r) => {
    const client = mkAdaptorClient(r.adaptor_url);
    return client;
  },
  (client: AdaptorClient) => {
    return {
      adaptor_url: client.adaptorUrl,
      type: "AdaptorClient" as const,
    };
  },
);

export const mkAdaptorClient = (baseUrl: AdaptorUrl): AdaptorClient => {
  const mkKonduitHeader = (keyTag: KeyTag): [string, string] => ["KONDUIT", hexString2KeyTagCodec.serialise(keyTag)];

  const chSquashEndpoint = mkPostEndpoint(
    `${baseUrl}/ch/squash`,
    RequestSerialiser.fromCborSerialiser(cbor2SquashCodec.serialise),
    ResponseDeserialiser.fromJsonDeserialiser(json2SquashResponseDeserialiser)
  );

  const chPayEndpoint = mkPostEndpoint(
    `${baseUrl}/ch/pay`,
    RequestSerialiser.fromJsonSerialiser(json2PayBodyCodec.serialise),
    ResponseDeserialiser.fromJsonDeserialiser(json2PayResponseDeserialiser)
  );

  return {
    adaptorUrl: baseUrl,
    info: mkInfoEndpoint(baseUrl),
    chSquash: async (keyTag: KeyTag, squash: Squash) => {
      return chSquashEndpoint(squash, [mkKonduitHeader(keyTag)]);
    },
    chQuote: async (keyTag: KeyTag, quoteBody: QuoteBody) => {
      const quoteEndpoint = mkQuoteEndpoint(baseUrl);
      return quoteEndpoint(quoteBody, [mkKonduitHeader(keyTag)]);
    },
    chPay: async (keyTag: KeyTag, cheque: Cheque, invoice: Invoice) => {
      const body: PayBody = {
        chequeBody: cheque.body,
        signature: cheque.signature,
        invoice,
      };
      return chPayEndpoint(body, [mkKonduitHeader(keyTag)]);
    },
  };
}

// Make client version scoped to a specific channel.
export const mkAdaptorChannelClient = (adaptorUrl: AdaptorUrl, consumerEd25519VerificationKey: ConsumerEd25519VerificationKey, channelTag: ChannelTag) => {
  const keyTag = KeyTag.fromKeyAndTag(consumerEd25519VerificationKey, channelTag);
  const adaptorClient = mkAdaptorClient(adaptorUrl);
  return {
    adaptorUrl: adaptorUrl,
    keyTag: keyTag,
    chSquash: (squash: Squash) => adaptorClient.chSquash(keyTag, squash),
    chQuote: (quoteBody: QuoteBody) => adaptorClient.chQuote(keyTag, quoteBody),
    chPay: (cheque: Cheque, invoice: Invoice) => adaptorClient.chPay(keyTag, cheque, invoice),
    info: () => adaptorClient.info(),
  }
}

