import { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import {
  mkGetEndpoint,
  mkPostEndpoint,
  RequestSerialiser,
  ResponseDeserialiser,
} from "./http";
import { Address, address2AddressBech32Iso, AddressBech32, Network, NetworkMagicNumber } from "./cardano/addressses";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2TxHashCodec, Lovelace, TxCborBytes } from "./cardano";
import { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { json2BigIntThroughStringCodec, json2BooleanCodec, json2StringCodec, nullable } from "@konduit/codec/json/codecs";
import type { JsonError } from "@konduit/codec/json/codecs";
export type { SquashResponse } from "./adaptorClient/squash";
import { type PositiveBigInt } from "@konduit/codec/integers/big";

export type BlockfrostAddressInfo = {
  address: AddressBech32;
  lovelace: Lovelace;
  otherAssets: {
    unit: string;
    quantity: PositiveBigInt;
  }[];
  type: string;
};

// const json2BigIntThroughStringCodec = codec.pipe(
//   json2StringCodec, {
//     deserialise: (str: string) => {
//       try {
//         return ok(BigInt(str));
//       } catch (e) {
//         return err(`Invalid BigInt string: ${str}`);
//       }
//     },
//     serialise: (bigInt: bigint) => bigInt.toString(),
//   }
// );

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
