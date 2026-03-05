export type ConnectorUrl = string;

import * as uint8Array from "@konduit/codec/uint8Array";
import { err, ok, Result } from "neverthrow";
import type { HttpEndpointError } from "../http";
import {
  mkGetEndpoint,
  mkPostEndpoint,
  mkGetStaticEndpoint,
  RequestSerialiser,
  ResponseDeserialiser,
} from "../http";
import * as codec from "@konduit/codec";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import {
  json2BigIntThroughStringCodec,
  json2StringCodec,
  type JsonCodec,
} from "@konduit/codec/json/codecs";
import { Address, AddressBech32, Lovelace, NetworkMagicNumber, TxCborBytes, TxHash } from "../cardano";
import { TxIx, type TxOutRef } from "./ledger";
import { HexString } from "@konduit/codec/hexString";

// In the context of transaction utxo query
// we are receiving utxos without tx id as
// it is redundant and known in the context.
export type TxOutRecord = {
  // transaction_id: TxHash,
  address: Address
  output_index: TxIx;
  consumed_by_tx: TxHash | null;
};

export const json2TxUtxoCodec: JsonCodec<TxOutRecord> = jsonCodecs.objectOf({
  // transaction_id: TxHash.jsonCodec,
  address: Address.jsonCodec,
  output_index: TxIx.jsonCodec,
  consumed_by_tx: jsonCodecs.nullable(TxHash.jsonCodec),
});

export type TxRecord = {
  outputs: TxOutRecord[];
};

export const json2TxRecordCodec: JsonCodec<TxRecord> = jsonCodecs.objectOf({
  outputs: jsonCodecs.arrayOf(json2TxUtxoCodec),
});

// In the context of transaction utxo query
// we are receiving utxos without tx id as
// it is redundant and known in the context.
export type UtxoRecord = {
  transaction_id: TxHash,
  output_index: TxIx;
  address: Address
};

export const json2UtxoCodec: JsonCodec<UtxoRecord> = jsonCodecs.objectOf({
  transaction_id: TxHash.jsonCodec,
  output_index: TxIx.jsonCodec,
  address: Address.jsonCodec,
});

export type GetTransaction = (txHash: TxHash) => Promise<Result<TxRecord, HttpEndpointError>>;

export type ConnectorClient = {
  baseUrl: ConnectorUrl;
  balance: (address: Address) => Promise<Result<Lovelace, HttpEndpointError>>;
  health: () => Promise<Result<"ok", HttpEndpointError>>;
  network: () => Promise<Result<NetworkMagicNumber, HttpEndpointError>>;
  submit: (txCbor: TxCborBytes) => Promise<Result<TxHash, HttpEndpointError>>;
  transaction: GetTransaction;
  utxosAt: (
    address: Address
  ) => Promise<Result<UtxoRecord[], HttpEndpointError>>;
}

export const mkConnectorClient = (connectorUrl: ConnectorUrl): ConnectorClient => {
  const base =
    connectorUrl.endsWith("/") ? connectorUrl.slice(0, -1) : connectorUrl;
  const balanceEndpoint = mkGetEndpoint(
    base,
    (address: Address) => {
      const addressBech32 = AddressBech32.fromAddress(address);
      return `/balance/${encodeURIComponent(addressBech32)}`;
    },
    ResponseDeserialiser.fromJsonDeserialiser(
      codec.rmap(
        jsonCodecs.objectOf({
          lovelace: codec.pipe(
            json2BigIntThroughStringCodec,
            Lovelace.bigIntCodec,
          ),
        }),
        (balanceResponse) => balanceResponse.lovelace,
        (lovelace: Lovelace) => ({ lovelace })
      ).deserialise
    )
  );
  const healthEndpoint = mkGetStaticEndpoint(
    base,
    "/health",
    ResponseDeserialiser.fromJsonDeserialiser(
      codec.rmap(
        jsonCodecs.objectOf({
          status: jsonCodecs.constant("ok"),
        }),
        (_healthResponse) => "ok" as const,
        (healthStatus: "ok") => ({ status: healthStatus })
      ).deserialise
    )
  );
  const networkEndpoint = mkGetStaticEndpoint(
    base,
    "/network",
    ResponseDeserialiser.fromJsonDeserialiser(
      codec.pipeDeserialisers(
        jsonCodecs.objectOf({
          network: json2StringCodec
        }).deserialise,
        (networkResponse) => {
          switch (networkResponse.network) {
            case "mainnet":
              return ok(NetworkMagicNumber.MAINNET);
            case "preprod":
              return ok(NetworkMagicNumber.PREPROD);
            case "preview":
              return ok(NetworkMagicNumber.PREVIEW);
            default:
              return err(`Unknown network: ${networkResponse.network}`);
          }
        }
      )
    )
  );
  const submitEndpoint = mkPostEndpoint(
    `${base}/submit`,
    RequestSerialiser.fromOtherSerialiser(
      "application/cbor",
      (bytes: TxCborBytes) => uint8Array.toArrayBuffer(bytes)
    ),
    ResponseDeserialiser.fromJsonDeserialiser(
      codec.rmap(
        jsonCodecs.objectOf({
          tx_id: TxHash.jsonCodec,
        }),
        (submitResponse) => submitResponse.tx_id,
        (txId: TxHash) => ({ tx_id: txId })
      ).deserialise
    )
  );
  const transactionEndpoint = mkGetEndpoint(
    base,
    (txHash: TxHash) =>
      `/transaction/${encodeURIComponent(HexString.fromUint8Array(txHash))}`,
    ResponseDeserialiser.fromJsonDeserialiser(json2TxRecordCodec.deserialise)
  );
  const utxosAtEndpoint = mkGetEndpoint(
    base,
    (address: Address) => {
      const addressBech32 = AddressBech32.fromAddress(address);
      return `/utxos_at/${encodeURIComponent(addressBech32)}`;
    },
    ResponseDeserialiser.fromJsonDeserialiser(
      jsonCodecs.arrayOf(json2UtxoCodec).deserialise
    )
  );

  return {
    baseUrl: base,
    balance: balanceEndpoint,
    health: () => healthEndpoint(),
    network: networkEndpoint,
    submit: submitEndpoint,
    transaction: transactionEndpoint,
    utxosAt: utxosAtEndpoint,
  };
};

export const mkAddressBasedContinuationExtractor =
  (address: Address) =>
  (txRecord: TxRecord): Result<TxOutRecord | null, "MultipleMatchingOutputs"> => {
    const matchingOutputs = txRecord.outputs.filter((output) => output.address === address);
    if(matchingOutputs.length === 0) {
      return ok(null);
    } else if (matchingOutputs.length === 1) {
      return ok(matchingOutputs[0]!);
    } else {
      return err("MultipleMatchingOutputs");
    }
}

// Consuming utxo and the continuation.
// The last entry can have null continuation.
// The other should have non-null continuation.
export type ThreadEntry = [TxRecord, TxOutRecord | null];
export type Thread = ThreadEntry[];
export const foldOnChainThread = async <E>(
  getTransaction: GetTransaction,
  utxo: TxOutRef,
  extractContinuation: (txRecord: TxRecord) => Result<TxOutRecord | null, E>
): Promise<Result<Thread, HttpEndpointError | "TxOutRefNotFound" | "InitiaTxIxInvalid" | E >> => {
  const go = async (
    consumedBy: TxHash,
    acc: Thread
  ): Promise<Result<Thread, HttpEndpointError | "TxOutRefNotFound" | "InitiaTxIxInvalid" | E >> => {
    const txRecordResult = await getTransaction(consumedBy);
    return txRecordResult.match(
      async (txRecord) => {
        return extractContinuation(txRecord).match(
          async (continuation) => {
            const newEntry: ThreadEntry = [txRecord, continuation];
            const newAcc = [...acc, newEntry];
            if (continuation === null) {
              return ok(newAcc);
            } else {
              const nextConsumedBy = continuation.consumed_by_tx;
              if (nextConsumedBy === null) {
                return ok(newAcc);
              }
              return go(nextConsumedBy, newAcc);
            }
          },
          async (error) => err(error)
        );
      },
      async (error) => err(error)
    );
  }
  const possibleTxRecord = await getTransaction(utxo.txId);
  return possibleTxRecord.match(
    async (txRecord) => {
      if(txRecord.outputs.length <= utxo.txIx) return err("InitiaTxIxInvalid");
      const utxoInfo = txRecord.outputs[utxo.txIx]!;
      const consumedBy = utxoInfo.consumed_by_tx;
      if(consumedBy === null) {
        return ok([]);
      }
      return go(consumedBy, []);
    },
    async (error) => err(error)
  );
}

