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
import {
  Address,
  AddressBech32,
  DatumHash,
  Lovelace,
  PlutusData,
  PositiveCoin,
  TxCborBytes,
  TxHash,
} from "../cardano";
import { BlockDepth, PlutusVersion, PublicNetwork, SlotNo } from "./ledger";
import {
  ScriptHash,
  TransactionUnspentOutput,
  TxIx,
  type TxOutRef,
  TxInput,
  TxOut,
  type TxOutInfo,
  DatumOption,
  InlineDatum,
  ReferenceScript,
} from "./tx";
import { HexString } from "@konduit/codec/hexString";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import { POSIXMilliseconds } from "../time/absolute";
import { Value, AssetId, AssetName, ValueEntry } from "./assets";
import type { JsonError } from "@konduit/codec/json/codecs";
import type { Codec } from "@konduit/codec";

export type ConnectorUrl = string;

export const json2AssetTagCodec: JsonCodec<"lovelace" | AssetId> = (() => {
  const json2hashAndTokenCodec: JsonCodec<[Uint8Array, Uint8Array]> = codec.rmap(
    uint8Array.jsonCodec,
    // split into 28 bytes and the rest
    (jsonBytes: Uint8Array) =>
      [jsonBytes.slice(0, 28), jsonBytes.slice(28)] as [
        Uint8Array,
        Uint8Array,
      ],
    ([policyBytes, nameBytes]: [Uint8Array, Uint8Array]) =>
      new Uint8Array([...policyBytes, ...nameBytes]),
  );
  const uint8Array2ScriptHashCodec: Codec<Uint8Array, ScriptHash, JsonError> = {
    deserialise: ScriptHash.fromBytes,
    serialise: (scriptHash) => scriptHash as Uint8Array,
  };
  const uint8Array2AssetNameCodec: Codec<Uint8Array, AssetName, JsonError> = {
    deserialise: AssetName.fromBytes,
    serialise: (assetName) => assetName as Uint8Array,
  };
  const uint8ArrayTupleToAssetIdCodec: Codec<
    [Uint8Array, Uint8Array],
    AssetId,
    JsonError
  > = codec.tupleOf(uint8Array2ScriptHashCodec, uint8Array2AssetNameCodec);

  const json2AssetIdCodec: JsonCodec<AssetId> = codec.pipe(
    json2hashAndTokenCodec,
    uint8ArrayTupleToAssetIdCodec,
  );

  return jsonCodecs.altJsonCodecs(
    [jsonCodecs.constant("lovelace" as const), json2AssetIdCodec],
    (serConst, serAssetId) => (value: AssetId | "lovelace") => {
      if (value === "lovelace") return serConst(value);
      return serAssetId(value);
    },
  );
})();

export type ValueRecord = {
  unit: AssetId | "lovelace";
  quantity: PositiveCoin;
};

export namespace ValueRecord {
  export const jsonCodec: JsonCodec<ValueRecord> = jsonCodecs.objectOf({
    unit: json2AssetTagCodec,
    quantity: codec.pipe(
      json2BigIntThroughStringCodec,
      {
        deserialise: (bigInt) =>
          PositiveBigInt.fromBigInt(bigInt).andThen(
            PositiveCoin.fromPositiveBigInt,
          ),
        serialise: (positiveCoin: PositiveCoin) => positiveCoin,
      },
    ),
  });
}

export const json2ValueCodec: JsonCodec<Value> = codec.pipe(
  jsonCodecs.arrayOf(ValueRecord.jsonCodec),
  {
    deserialise: (valueRecords: ValueRecord[]) => {
      let lovelace = Lovelace.zero;
      //export type ValueEntry = [AssetId, PositiveCoin];
      const assets: ValueEntry[] = [];
      let error: { lovelace: Lovelace; err: string } | null = null;
      for (const record of valueRecords) {
        if (record.unit === "lovelace") {
          Lovelace.fromBigInt(record.quantity as bigint).match(
            (l) => (lovelace = l),
            (e) => (error = { lovelace, err: e }),
          );
        } else {
          assets.push([record.unit, record.quantity]);
        }
      }
      if (error) {
        return err(error);
      }
      return Value.load(lovelace, assets);
    },
    serialise: (value: Value) => {
      const valueRecords: ValueRecord[] = [];
      if (Lovelace.ord.isGreaterThan(value.lovelace, Lovelace.zero)) {
        valueRecords.push({
          unit: "lovelace",
          quantity: (value.lovelace as bigint) as PositiveCoin,
        });
      }
      for (const [assetId, quantity] of value.assets) {
        valueRecords.push({
          unit: assetId,
          quantity,
        });
      }
      return valueRecords;
    },
  },
);

export type TxInRecord = {
  address: Address;
  datum_hash: DatumHash | null;
  datum_inline: PlutusData | null;
  output_index: TxIx;
  reference_script_hash: string | null;
  transaction_id: TxHash;
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
  address: Address;
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
    timestamp: POSIXMilliseconds.jsonCodec,
  });
})();

export type UtxoRecord = {
  address: Address;
  consumed_by: TxHash | null;
  datum_hash: DatumHash | null;
  datum_inline: PlutusData | null;
  output_index: TxIx;
  reference_script: ReferenceScript | null;
  reference_script_hash: ScriptHash | null;
  reference_script_version: PlutusVersion | null;
  transaction_id: TxHash;
  value: Value;
};
export namespace UtxoRecord {
  export const jsonCodec: JsonCodec<UtxoRecord> = jsonCodecs.objectOf({
    address: Address.jsonCodec,
    consumed_by: jsonCodecs.nullable(TxHash.jsonCodec),
    datum_hash: jsonCodecs.nullable(DatumHash.jsonCodec),
    datum_inline: jsonCodecs.nullable(PlutusData.jsonCodec),
    output_index: TxIx.jsonCodec,
    reference_script: jsonCodecs.nullable(ReferenceScript.jsonCodec),
    reference_script_hash: jsonCodecs.nullable(ScriptHash.jsonCodec),
    reference_script_version: jsonCodecs.nullable(PlutusVersion.jsonCodec),
    transaction_id: TxHash.jsonCodec,
    value: json2ValueCodec,
  });
}

export type OutputWithInfo = {
  txInTxOut: TransactionUnspentOutput;
  txInfo: TxOutInfo;
};
export namespace OutputWithInfo {
  export const utxoRecord2OutputWithInfoCodec: Codec<
    UtxoRecord,
    OutputWithInfo,
    JsonError
  > = {
    deserialise: (u: UtxoRecord) => {
      const input: TxInput = TxInput.fromComponents(
        u.transaction_id,
        u.output_index,
      );

      const datumOption: DatumOption | null =
        u.datum_inline !== null
          ? ({ plutusData: u.datum_inline } as InlineDatum)
          : u.datum_hash !== null
          ? (u.datum_hash as DatumHash)
          : null;

      const output: TxOut = {
        address: u.address,
        value: u.value,
        datumOption,
        scriptRef: u.reference_script,
      } as TxOut;

      const txInTxOut: TransactionUnspentOutput = { input, output };

      const referenceScript =
        u.reference_script_hash !== null &&
        u.reference_script_version !== null
          ? {
              hash: u.reference_script_hash,
              version: u.reference_script_version,
            }
          : null;

      const txInfo: TxOutInfo = {
        consumedBy: u.consumed_by,
        referenceScript,
      };

      return ok({ txInTxOut, txInfo }) as Result<OutputWithInfo, JsonError>;
    },
    serialise: ({ txInTxOut, txInfo }: OutputWithInfo) => {
      const {
        input: [txId, txIx],
        output,
      } = txInTxOut;
      const { address, value, datum, scriptRef } = (() => {
        if ("datumOption" in output) {
          return {
            address: output.address,
            value: output.value,
            datum: output.datumOption,
            scriptRef: output.scriptRef,
          };
        }
        // Alonzo case:
        return {
          address: output.address,
          value: output.value,
          datum: output.datumHash,
          scriptRef: null,
        };
      })();
      const { consumedBy, referenceScript } = txInfo;
      return {
        address,
        consumed_by: consumedBy,
        datum_hash: datum instanceof Uint8Array ? datum : null,
        datum_inline:
          datum && typeof datum == "object" && "plutusData" in datum
            ? datum.plutusData
            : null,
        output_index: txIx,
        reference_script: scriptRef,
        reference_script_hash:
          referenceScript !== null ? referenceScript.hash : null,
        reference_script_version:
          referenceScript !== null ? referenceScript.version : null,
        transaction_id: txId,
        value,
      };
    },
  };
}

export type GetTransaction = (
  txHash: TxHash,
) => Promise<Result<TxRecord, HttpEndpointError>>;
export type ConnectorClient = {
  baseUrl: ConnectorUrl;
  balance: (address: Address) => Promise<Result<Lovelace, HttpEndpointError>>;
  health: () => Promise<Result<"ok", HttpEndpointError>>;
  network: () => Promise<Result<PublicNetwork, HttpEndpointError>>;
  submit: (txCbor: TxCborBytes) => Promise<Result<TxHash, HttpEndpointError>>;
  transaction: GetTransaction;
  utxosAt: (
    address: Address,
  ) => Promise<
    Result<
      { out: TransactionUnspentOutput; info: TxOutInfo }[],
      HttpEndpointError
    >
  >;
};

export const mkConnectorClient = (
  connectorUrl: ConnectorUrl,
): ConnectorClient => {
  const base =
    connectorUrl.endsWith("/") ? connectorUrl.slice(0, -1) : connectorUrl;
  const balanceEndpoint = mkGetEndpoint(
    base,
    (address: Address) => {
      const addressBech32 = AddressBech32.fromAddress(address);
      return `/balance/${encodeURIComponent(addressBech32)}`;
    },
    ResponseDeserialiser.fromJsonDeserialiser(
      codec
        .rmap(
          jsonCodecs.objectOf({
            lovelace: codec.pipe(
              json2BigIntThroughStringCodec,
              Lovelace.bigIntCodec,
            ),
          }),
          (balanceResponse) => balanceResponse.lovelace,
          (lovelace: Lovelace) => ({ lovelace }),
        )
        .deserialise,
    ),
  );
  const healthEndpoint = mkGetStaticEndpoint(
    base,
    "/health",
    ResponseDeserialiser.fromJsonDeserialiser(
      codec
        .rmap(
          jsonCodecs.objectOf({
            status: jsonCodecs.constant("ok"),
          }),
          (_healthResponse) => "ok" as const,
          (healthStatus: "ok") => ({ status: healthStatus }),
        )
        .deserialise,
    ),
  );
  const networkEndpoint = mkGetStaticEndpoint(
    base,
    "/network",
    ResponseDeserialiser.fromJsonDeserialiser(
      codec.pipeDeserialisers(
        jsonCodecs
          .objectOf({
            network: json2StringCodec,
          })
          .deserialise,
        (networkResponse) => {
          switch (networkResponse.network) {
            case "mainnet":
              return ok("Mainnet" as PublicNetwork);
            case "preprod":
              return ok("Preprod" as PublicNetwork);
            case "preview":
              return ok("Preview" as PublicNetwork);
            default:
              return err(`Unknown network: ${networkResponse.network}`);
          }
        },
      ),
    ),
  );
  const submitEndpoint = mkPostEndpoint(
    `${base}/submit`,
    RequestSerialiser.fromJsonSerialiser(
      (data: TxCborBytes) => {
        return jsonCodecs.objectOf({
          transaction: uint8Array.jsonCodec
        }).serialise({ transaction: data })
      }
    ),
    ResponseDeserialiser.fromJsonDeserialiser(
      codec
        .rmap(
          jsonCodecs.objectOf({
            transaction_id: TxHash.jsonCodec,
          }),
          (submitResponse) => submitResponse.transaction_id,
          (transaction_id: TxHash) => ({ transaction_id })
        )
        .deserialise,
    ),
  );
  const transactionEndpoint = mkGetEndpoint(
    base,
    (txHash: TxHash) =>
      `/transaction/${encodeURIComponent(HexString.fromUint8Array(txHash))}`,
    ResponseDeserialiser.fromJsonDeserialiser(json2TxRecordCodec.deserialise),
  );
  const utxosAtEndpoint = mkGetEndpoint(
    base,
    (address: Address) => {
      const addressBech32 = AddressBech32.fromAddress(address);
      return `/utxos_at/${encodeURIComponent(addressBech32)}`;
    },
    ResponseDeserialiser.fromJsonDeserialiser(
      jsonCodecs
        .arrayOf(
          codec.pipe(
            UtxoRecord.jsonCodec,
            OutputWithInfo.utxoRecord2OutputWithInfoCodec,
          ),
        )
        .deserialise,
    ),
  );
  let _network: PublicNetwork | null = null;
  return {
    baseUrl: base,
    balance: balanceEndpoint,
    health: healthEndpoint,
    network: async () => {
      if (_network !== null) return ok(_network);
      const result = await networkEndpoint();
      result.map((network) => (_network = network));
      return result;
    },
    submit: submitEndpoint,
    transaction: transactionEndpoint,
    utxosAt: async (address: Address) => {
      const res = await utxosAtEndpoint(address);
      return res.map((arr) =>
        arr.map(({ txInTxOut, txInfo }) => ({ out: txInTxOut, info: txInfo })),
      );
    },
  };
};

export const mkAddressBasedContinuationExtractor =
  (address: Address) =>
  (
    txRecord: TxRecord,
  ): Result<[TxOutRecord, TxIx] | null, "MultipleMatchingOutputs"> => {
    const matchingOutputs = txRecord.outputs
      .map((output, index) => ({ output, index }))
      .filter(({ output }) => output.address === address);
    if (matchingOutputs.length === 0) {
      return ok(null);
    } else if (matchingOutputs.length === 1) {
      const { output, index } = matchingOutputs[0]!;
      const pair = [output, index] as [TxOutRecord, TxIx];
      return ok(pair);
    } else {
      return err("MultipleMatchingOutputs");
    }
  };

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
  extractContinuation: (
    txRecord: TxRecord,
  ) => Result<[TxOutRecord, TxIx] | null, E>,
): Promise<
  Result<Thread, HttpEndpointError | "TxOutRefNotFound" | "InitiaTxIxInvalid" | E>
> => {
  const go = async (
    consumedBy: TxHash,
    acc: Thread,
  ): Promise<
    Result<
      Thread,
      HttpEndpointError | "TxOutRefNotFound" | "InitiaTxIxInvalid" | E
    >
  > => {
    const txRecordResult = await getTransaction(consumedBy);
    return txRecordResult.match(
      async (txRecord) => {
        return extractContinuation(txRecord).match(
          async (continuationInfo: [TxOutRecord, TxIx] | null) => {
            const newEntry: ThreadEntry = [
              txRecord,
              continuationInfo ? continuationInfo[1] : null,
            ];
            const newAcc = [...acc, newEntry];
            if (
              continuationInfo === null ||
              continuationInfo[0].consumed_by_tx === null
            ) {
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
          async (error) => err(error),
        );
      },
      async (error) => err(error),
    );
  };
  const possibleTxRecord = await getTransaction(utxo.txId);
  return possibleTxRecord.match(
    async (txRecord) => {
      if (txRecord.outputs.length <= utxo.txIx)
        return err("InitiaTxIxInvalid");
      const utxoInfo = txRecord.outputs[utxo.txIx]!;
      const headEntry: [TxRecord, TxIx] = [txRecord, utxo.txIx];
      const consumedBy = utxoInfo.consumed_by_tx;
      if (consumedBy === null) {
        return ok([headEntry]);
      }
      return go(consumedBy, [headEntry]);
    },
    async (error) => err(error),
  );
};
