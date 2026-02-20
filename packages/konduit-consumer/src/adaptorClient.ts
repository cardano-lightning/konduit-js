import type { Tagged } from "type-fest";
import { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import { AdaptorInfo, json2AdaptorInfoCodec } from "./adaptorClient/adaptorInfo";
import type { HttpEndpointError } from "./http";
import {
  mkGetEndpoint,
  mkGetStaticEndpoint,
  mkPostEndpoint,
  RequestSerialiser,
  ResponseDeserialiser,
} from "./http";
import { hexString2KeyTagCodec, KeyTag, type ChannelTag } from "./channel/core";
import type { Cheque, Squash } from "./channel/squash";
import { cbor2SquashCodec } from "./channel/squash";
import type { ConsumerEd25519VerificationKey } from "./channel/l1Channel";
import { Address, address2AddressBech32Iso, AddressBech32, Network, NetworkMagicNumber } from "./cardano/addressses";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2TxHashCodec, Lovelace, TxCborBytes } from "./cardano";
import { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { json2BooleanCodec, json2StringCodec, nullable, type JsonCodec } from "@konduit/codec/json/codecs";
import type { JsonError } from "@konduit/codec/json/codecs";
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

const json2BigIntThroughStringCodec = codec.pipe(
  json2StringCodec, {
    deserialise: (str: string) => {
      try {
        return ok(BigInt(str));
      } catch (e) {
        return err(`Invalid BigInt string: ${str}`);
      }
    },
    serialise: (bigInt: bigint) => bigInt.toString(),
  }
);


export type BlockfrostAddressInfo = {
  address: AddressBech32;
  lovelace: Lovelace;
  otherAssets: {
    unit: string;
    quantity: bigint;
  }[];
  type: string;
};

export const blockfrostAddressInfoCodec = (() => {
  const apiResponseCodec = jsonCodecs.objectOf({
    address: json2StringCodec,
    amount: jsonCodecs.arrayOf(jsonCodecs.objectOf({
      unit: json2StringCodec,
      quantity: json2BigIntThroughStringCodec,
    })),
    stake_address: nullable(json2StringCodec),
    type: json2StringCodec,
    script: json2BooleanCodec,
  });
  return codec.pipe(
    apiResponseCodec, {
      deserialise: (apiResponse) => {
        const lovelaceAmount = apiResponse.amount.find((asset) => asset.unit === "lovelace")?.quantity ?? BigInt(0);
        const otherAssets = apiResponse.amount.filter((asset) => asset.unit !== "lovelace");
        return Result.combine([
          AddressBech32.fromString(apiResponse.address).mapErr((e) => `Invalid address: ${e}`),
          Lovelace.fromBigInt(lovelaceAmount).mapErr((e) => `Invalid lovelace amount: ${e}`),
        ]).map(([address, lovelace]) => ({
          address,
          lovelace,
          otherAssets,
          type: apiResponse.type,
        } as BlockfrostAddressInfo));
      },
      // Serialisation part is not needed but the current
      // codec composition utilities are provided only for
      // the full codecs.
      serialise: (info: BlockfrostAddressInfo) => {
        const address = address2AddressBech32Iso.from(info.address);
        const amount = [
          { unit: "lovelace", quantity: info.lovelace },
          ...info.otherAssets,
        ];
        return {
          address: info.address,
          amount,
          stake_address: "",
          type: info.type,
          script: address.paymentCredential.type == "ScriptHash",
        }
      }
    }
  );
})();

export const mkBlockfrostClient = (projectId: string) => { // WalletBackendBase => {
  const possibleNetworkInfo:Result<[NetworkMagicNumber, string], JsonError> = (() => {
    if(projectId.includes("preprod")) {
      return ok([NetworkMagicNumber.PREPROD, "preprod"]);
    } else if(projectId.includes("mainnet")) {
      return ok([NetworkMagicNumber.MAINNET, "mainnet"]);
    } else if(projectId.includes("preview")) {
      return ok([NetworkMagicNumber.PREVIEW, "preview"]);
    }
    return err("Cannot determine network magic number from project ID") as Result<[NetworkMagicNumber, string], JsonError>;
  })();

  return possibleNetworkInfo.map(([networkMagicNumber, env]) => {
    const baseUrl = `https://cardano-${env}.blockfrost.io/api/v0`;
    const defaultHeaders: [string, string][] = [["project_id", projectId]];
    const network = env === "mainnet" ? Network.MAINNET : Network.TESTNET;

    const addressEndpoint = mkGetEndpoint<AddressBech32, BlockfrostAddressInfo>(
      baseUrl,
      (addr) => `/addresses/${addr}`,
      ResponseDeserialiser.fromJsonDeserialiser(blockfrostAddressInfoCodec.deserialise)
    );

    const submitEndpoint = mkPostEndpoint(
      `${baseUrl}/tx/submit`,
      RequestSerialiser.fromOtherSerialiser("application/cbor", (data: ArrayBuffer) => data),
      ResponseDeserialiser.fromJsonDeserialiser(json2TxHashCodec.deserialise)
    );

    return {
      getBalance: async (vKey: Ed25519VerificationKey) => {
        const addressBech32 = AddressBech32.fromAddress(Address.fromEd25519VerificationKeys(network, vKey));
        return addressEndpoint(addressBech32, defaultHeaders);
      },
      getAddressInfo: async (address: AddressBech32) => {
        return addressEndpoint(address, defaultHeaders);
      },
      networkMagicNumber,
      projectId,
      submitTx: async (txCbor: TxCborBytes) => {
        const txCborBuffer = new ArrayBuffer(txCbor.byteLength);
        new Uint8Array(txCborBuffer).set(txCbor);
        return submitEndpoint(txCborBuffer, defaultHeaders);
      },
    };
  });
};
