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
import { Address, AddressBech32, DatumHash, Lovelace, PlutusData, PositiveCoin, TxCborBytes, TxHash } from "../cardano";
import { BlockDepth, NetworkMagicNumber, PlutusVersion, SlotNo } from "./ledger";
import { TxIx, type TxOutRef } from "./tx";
import { HexString } from "@konduit/codec/hexString";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import { json2POSIXMillisecondsCodec, type POSIXMilliseconds } from "../time/absolute";

export type ValueRecord = {
  unit: string;
  quantity: PositiveCoin;
};
export namespace ValueRecord {
  export const jsonCodec: JsonCodec<ValueRecord> = jsonCodecs.objectOf({
    unit: json2StringCodec,
    quantity: codec.pipe(
      json2BigIntThroughStringCodec, {
        deserialise: (bigInt) => PositiveBigInt.fromBigInt(bigInt).andThen(PositiveCoin.fromPositiveBigInt),
        serialise: (positiveCoin: PositiveCoin) => positiveCoin,
      }),
  });
}
export type TxInRecord = {
  address: Address
  datum_hash: DatumHash | null;
  datum_inline: PlutusData | null;
  output_index: TxIx;
  reference_script_hash: string | null;
  transaction_id: TxHash,
  value: ValueRecord[];
};
export namespace TxInRecord {
  export const jsonCodec: JsonCodec<TxInRecord> = jsonCodecs.objectOf({
    address: Address.jsonCodec,
    datum_hash: jsonCodecs.nullable(DatumHash.jsonCodec),
    datum_inline: jsonCodecs.nullable(PlutusData.jsonCodec),
    output_index: TxIx.jsonCodec,
    reference_script_hash: jsonCodecs.nullable(json2StringCodec),
    transaction_id: TxHash.jsonCodec,
    value: jsonCodecs.arrayOf(ValueRecord.jsonCodec),
  });
}
export type TxOutRecord = {
  address: Address
  datum_hash: DatumHash | null;
  datum_inline: PlutusData | null;
  consumed_by_tx: TxHash | null;
  reference_script_hash: string | null;
  value: ValueRecord[];
};
export namespace TxOutRecord {
  export const jsonCodec: JsonCodec<TxOutRecord> = jsonCodecs.objectOf({
    address: Address.jsonCodec,
    consumed_by_tx: jsonCodecs.nullable(TxHash.jsonCodec),
    datum_hash: jsonCodecs.nullable(DatumHash.jsonCodec),
    datum_inline: jsonCodecs.nullable(PlutusData.jsonCodec),
    reference_script_hash: jsonCodecs.nullable(json2StringCodec),
    value: jsonCodecs.arrayOf(ValueRecord.jsonCodec),
  });
}
export type TxRecord = {
  id: TxHash;
  depth: BlockDepth;
  inputs: TxInRecord[];
  invalid_before: SlotNo | null;
  invalid_after: SlotNo | null;
  outputs: TxOutRecord[];
  timestamp: POSIXMilliseconds;
};
export const json2TxRecordCodec: JsonCodec<TxRecord> = (() => {
  return jsonCodecs.objectOf({
    depth: BlockDepth.jsonCodec,
    id: TxHash.jsonCodec,
    inputs: jsonCodecs.arrayOf(TxInRecord.jsonCodec),
    invalid_before: jsonCodecs.nullable(SlotNo.jsonCodec),
    invalid_after: jsonCodecs.nullable(SlotNo.jsonCodec),
    outputs: jsonCodecs.arrayOf(TxOutRecord.jsonCodec),
    timestamp: json2POSIXMillisecondsCodec,
  });
})();

export type UtxoRecord = {
  address: Address;
  consumed_by: TxHash | null;
  datum_hash: DatumHash | null;
  datum_inline: PlutusData | null;
  output_index: TxIx;
  reference_script: string | null;
  reference_script_hash: string | null;
  reference_script_version: PlutusVersion | null;
  transaction_id: TxHash;
  value: ValueRecord[];
};
export namespace UtxoRecord {
  export const jsonCodec: JsonCodec<UtxoRecord> = jsonCodecs.objectOf({
    address: Address.jsonCodec,
    consumed_by: jsonCodecs.nullable(TxHash.jsonCodec),
    datum_hash: jsonCodecs.nullable(DatumHash.jsonCodec),
    datum_inline: jsonCodecs.nullable(PlutusData.jsonCodec),
    output_index: TxIx.jsonCodec,
    reference_script: jsonCodecs.nullable(json2StringCodec),
    reference_script_hash: jsonCodecs.nullable(json2StringCodec),
    // export type PlutusVersion = Tagged<"V1" | "V2" | "V3", "PlutusVersion">;
    reference_script_version: jsonCodecs.nullable(PlutusVersion.jsonCodec),
    transaction_id: TxHash.jsonCodec,
    value: jsonCodecs.arrayOf(ValueRecord.jsonCodec),
  });
}

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
      jsonCodecs.arrayOf(UtxoRecord.jsonCodec).deserialise
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
  (txRecord: TxRecord): Result<[TxOutRecord, TxIx] | null, "MultipleMatchingOutputs"> => {
    // We should extract the utxo and its index
    const matchingOutputs = txRecord.outputs.map((output, index) => ({ output, index })).filter(({ output }) => output.address === address);
    if (matchingOutputs.length === 0) {
      return ok(null);
    } else if (matchingOutputs.length === 1) {
      const { output, index } = matchingOutputs[0]!;
      const pair = [output, index] as [TxOutRecord, TxIx];
      return ok(pair);
    } else {
      return err("MultipleMatchingOutputs");
    }
}

// Given a transaction output reference:
// * If present on chain we create for it a initial thread entry
// pairing it with the transaction that created it.
// * Then recursively we follow the chain of transactions consuming it,
// creating for each of them a thread entry pairing the transaction and
// an output produced by it which we follow.
export type ThreadEntry = [TxRecord, TxIx | null];
export type Thread = ThreadEntry[];
export const foldOnChainThread = async <E>(
  getTransaction: GetTransaction,
  utxo: TxOutRef,
  extractContinuation: (txRecord: TxRecord) => Result<[TxOutRecord, TxIx] | null, E>
): Promise<Result<Thread, HttpEndpointError | "TxOutRefNotFound" | "InitiaTxIxInvalid" | E >> => {
  const go = async (
    consumedBy: TxHash,
    acc: Thread
  ): Promise<Result<Thread, HttpEndpointError | "TxOutRefNotFound" | "InitiaTxIxInvalid" | E >> => {
    const txRecordResult = await getTransaction(consumedBy);
    return txRecordResult.match(
      async (txRecord) => {
        return extractContinuation(txRecord).match(
          async (continuationInfo: [TxOutRecord, TxIx] | null) => {
            const newEntry: ThreadEntry = [txRecord, continuationInfo ? continuationInfo[1] : null];
            const newAcc = [...acc, newEntry];
            if (continuationInfo === null || continuationInfo[0].consumed_by_tx === null) {
              return ok(newAcc);
            } else {
              const continuationOutput = continuationInfo[0];
              const nextConsumedBy = continuationOutput.consumed_by_tx;
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
      const headEntry:[TxRecord, TxIx] = [txRecord, utxo.txIx];
      const consumedBy = utxoInfo.consumed_by_tx;
      if(consumedBy === null) {
        return ok([headEntry]);
      }
      return go(consumedBy, [headEntry]);
    },
    async (error) => err(error)
  );
}

