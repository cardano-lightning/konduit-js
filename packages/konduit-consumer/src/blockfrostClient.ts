import * as neverthrow from "neverthrow";
import { err, ok, Result } from "neverthrow";
import {
  mkGetEndpoint,
  mkPostEndpoint,
  RequestSerialiser,
  ResponseDeserialiser,
  type HttpEndpointError,
} from "./http";
import {
  Address,
  address2AddressBech32Iso,
  AddressBech32,
  BlockHash,
  Network,
  NetworkMagicNumber,
  TxIx,
  Value,
} from "./cardano";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { TxHash, Lovelace, TxCborBytes } from "./cardano";
import { Ed25519VerificationKey } from "@konduit/cardano-keys";
import {
  json2BigIntThroughStringCodec,
  json2BooleanCodec,
  json2StringCodec,
  nullable,
  type JsonCodec,
} from "@konduit/codec/json/codecs";
import type { JsonDeserialiser } from "@konduit/codec/json/codecs";
export type { SquashResponse } from "./adaptorClient/squash";
import { type PositiveBigInt } from "@konduit/codec/integers/big";
import { DatumHash, DatumOption, InlineDatum, PlutusData, ScriptHash, TransactionUnspentOutput, TxInput } from "./cardano/tx";
import {
  json2ValueCodec,
} from "./cardano/connectorClient";
import { json2CborCodec } from "@konduit/codec/cbor/codecs/sync";
import type { Cbor } from "@konduit/codec/cbor/core";
import { HexString } from "@konduit/codec/hexString";

export type BlockfrostAddressInfo = {
  address: AddressBech32;
  lovelace: Lovelace;
  otherAssets: {
    unit: string;
    quantity: PositiveBigInt;
  }[];
  type: string;
};

export const blockfrostAddressInfoCodec = (() => {
  const apiResponseCodec = jsonCodecs.objectOf({
    address: json2StringCodec,
    amount: jsonCodecs.arrayOf(
      jsonCodecs.objectOf({
        unit: json2StringCodec,
        quantity: json2BigIntThroughStringCodec,
      }),
    ),
    stake_address: nullable(json2StringCodec),
    type: json2StringCodec,
    script: json2BooleanCodec,
  });
  return codec.pipe(apiResponseCodec, {
    deserialise: (apiResponse) => {
      const lovelaceAmount =
        apiResponse.amount.find((asset) => asset.unit === "lovelace")
          ?.quantity ?? BigInt(0);
      const otherAssets = apiResponse.amount.filter(
        (asset) => asset.unit !== "lovelace",
      );
      return Result.combine([
        AddressBech32.fromString(apiResponse.address).mapErr(
          (e) => `Invalid address: ${e}`,
        ),
        Lovelace.fromBigInt(lovelaceAmount).mapErr(
          (e) => `Invalid lovelace amount: ${e}`,
        ),
      ]).map(
        ([address, lovelace]) =>
          ({
            address,
            lovelace,
            otherAssets,
            type: apiResponse.type,
          } as BlockfrostAddressInfo),
      );
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
      };
    },
  });
})();

export type UtxoRecord = {
  address: Address;
  tx_hash: TxHash;
  output_index: TxIx;
  amount: Value;
  block: BlockHash;
  data_hash: DatumHash | null;
  inline_datum: PlutusData | null;
  reference_script_hash: ScriptHash | null;
};

export namespace UtxoRecord {
  export const jsonCodec: JsonCodec<UtxoRecord> = jsonCodecs.objectOf({
    address: Address.jsonCodec,
    tx_hash: TxHash.jsonCodec,
    output_index: TxIx.jsonCodec,
    amount: json2ValueCodec,
    block: BlockHash.jsonCodec,
    data_hash: jsonCodecs.nullable(DatumHash.jsonCodec),
    inline_datum: jsonCodecs.nullable(PlutusData.jsonCodec),
    reference_script_hash: jsonCodecs.nullable(ScriptHash.jsonCodec),
  });

  export const toTransactionUnspentOutput = (utxo: UtxoRecord): TransactionUnspentOutput => {
    const datumOption: DatumOption | null =
      utxo.inline_datum !== null
        ? ({ plutusData: utxo.inline_datum } as InlineDatum)
        : utxo.data_hash !== null
        ? (utxo.data_hash as DatumHash)
        : null;
    return {
      input: TxInput.fromComponents(utxo.tx_hash, utxo.output_index),
      output: {
        address: utxo.address,
        value: utxo.amount,
        datumOption,
        // FIXME: THIS IS A BUG -> We should use the above endpoint the handle this
        scriptRef: null
      },
    };
  }
  export const json2TransactionUnspentOutputDeserialiser: JsonDeserialiser<TransactionUnspentOutput> = codec.rmapDeserialiser(
    UtxoRecord.jsonCodec.deserialise,
    (utxoRecord) => UtxoRecord.toTransactionUnspentOutput(utxoRecord),
  );
}

export const mkScriptCborEndpoint = (baseUrl: string, projectId: string): (scriptHash: ScriptHash) => Promise<neverthrow.Result<Cbor, HttpEndpointError>> => {
  const jsonCodec: JsonCodec<Cbor> = codec.rmap(
    jsonCodecs.objectOf({
      cbor: json2CborCodec,
    }),
    (response) => response.cbor,
    (cbor) => ({ cbor }),
  );
  const endpoint = mkGetEndpoint<ScriptHash, Cbor>(
    baseUrl,
    (scriptHash) => `/scripts/${scriptHash}/cbor`,
    ResponseDeserialiser.fromJsonDeserialiser(jsonCodec.deserialise),
  );
  return (scriptHash: ScriptHash): Promise<neverthrow.Result<Cbor, HttpEndpointError>> => {
    const defaultHeaders: [string, string][] = [["project_id", projectId]];
    return endpoint(scriptHash, defaultHeaders);
  };
};

export type BlockfrostClient = {
  getBalance: (vKey: Ed25519VerificationKey) => Promise<neverthrow.Result<BlockfrostAddressInfo, HttpEndpointError>>;
  getAddressInfo: (address: AddressBech32) => Promise<neverthrow.Result<BlockfrostAddressInfo, HttpEndpointError>>;
  utxosAt: (address: AddressBech32) => Promise<neverthrow.Result<TransactionUnspentOutput[], HttpEndpointError>>;
  submitTx: (txCbor: TxCborBytes) => Promise<neverthrow.Result<TxHash, HttpEndpointError>>;
  networkMagicNumber: NetworkMagicNumber;
  projectId: string;
};

export const mkBlockfrostClient = (projectId: string): neverthrow.Result<BlockfrostClient, string> => {
  const possibleNetworkInfo: neverthrow.Result<[NetworkMagicNumber, string], string> =
    (() => {
      if (projectId.includes("preprod")) {
        return ok([NetworkMagicNumber.PREPROD, "preprod"]);
      } else if (projectId.includes("mainnet")) {
        return ok([NetworkMagicNumber.MAINNET, "mainnet"]);
      } else if (projectId.includes("preview")) {
        return ok([NetworkMagicNumber.PREVIEW, "preview"]);
      }
      return (err(
        "Cannot determine network magic number from project ID",
      ));
    })();

  return possibleNetworkInfo.map(([networkMagicNumber, env]) => {
    const baseUrl = `https://cardano-${env}.blockfrost.io/api/v0`;
    const defaultHeaders: [string, string][] = [["project_id", projectId]];
    const network = env === "mainnet" ? Network.MAINNET : Network.TESTNET;

    const addressEndpoint = mkGetEndpoint<AddressBech32, BlockfrostAddressInfo>(
      baseUrl,
      (addr) => `/addresses/${addr}`,
      ResponseDeserialiser.fromJsonDeserialiser(
        blockfrostAddressInfoCodec.deserialise,
      ),
    );

    const utxosAtEndpoint = mkGetEndpoint<AddressBech32, TransactionUnspentOutput[]>(
      baseUrl,
      (addr) => `/addresses/${addr}/utxos?count=100&page=1&order=asc`,
      ResponseDeserialiser.fromJsonDeserialiser(
        jsonCodecs.arrayOfDeserialiser(UtxoRecord.json2TransactionUnspentOutputDeserialiser)
      )
    );

    const submitEndpoint = mkPostEndpoint(
      `${baseUrl}/tx/submit`,
      RequestSerialiser.fromOtherSerialiser(
        "application/cbor",
        (data: ArrayBuffer) => {
          console.debug("TRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR");
          console.debug("TRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR");
          console.debug("TRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR");
          console.debug(HexString.fromUint8Array(new Uint8Array(data)));
          return data;
        }
      ),
      ResponseDeserialiser.fromJsonDeserialiser(
        (txHash) => {
          console.debug("TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT");
          console.debug("TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT");
          console.debug("TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT");
          console.debug(`Received tx hash from submit endpoint: ${txHash}`);
          return TxHash.jsonCodec.deserialise(txHash);
        }
      )
    );

    return {
      getBalance: async (vKey: Ed25519VerificationKey) => {
        const addressBech32 = AddressBech32.fromAddress(
          Address.fromEd25519VerificationKeys(network, vKey),
        );
        return addressEndpoint(addressBech32, defaultHeaders);
      },
      getAddressInfo: async (address: AddressBech32) => {
        return addressEndpoint(address, defaultHeaders);
      },
      utxosAt: async (address: AddressBech32) => {
        return utxosAtEndpoint(address, defaultHeaders);
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
