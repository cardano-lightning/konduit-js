import { type Path as TaggedPath, type CommandError, type CliArg, type CliArgs, execCli, execCliJsonTyped } from './exec.js';
import {
  type TxHex,
  type Wallet,
} from "./cardano.js";

import * as nodeOs from "node:os";
import * as nodeFs from "node:fs";
import * as path from "node:path";
import { err, ok, Result, ResultAsync } from 'neverthrow';
import * as codec from '@konduit/codec';
import * as jsonCodecs from '@konduit/codec/json/codecs';
import * as uint8Array from "@konduit/codec/uint8Array";
import { type JsonDeserialiser } from '@konduit/codec/json/codecs';
import { stringify, type Json } from '@konduit/codec/json';
import type { JsonError } from '@konduit/codec/json/codecs';
import { fromSafePromiseResultFn, toAsync } from '@konduit/konduit-consumer/neverthrow';
import type { Milliseconds } from '@konduit/konduit-consumer/time/duration';
import type { Tagged } from 'type-fest';
import {
  AddressBech32,
  AssetId,
  AssetName,
  Era,
  NetworkMagicNumber,
  PositiveCoin,
  ScriptHash,
  TxCborBytes,
  TxIdHex,
  TxIx,
  TxOutRefHex,
  Value,
  type TxId,
} from '@konduit/konduit-consumer/cardano';
import { valueRecords2ValueCodec, type ValueRecord } from '@konduit/konduit-consumer/cardano/connectorClient';
import { PositiveBigInt } from '@konduit/codec/integers/big';

export type TxEnvelope = {
  tx: TxCborBytes;
  description: string;
  era: Era;
};

export namespace TxEnvelope {
  export const jsonCodec: jsonCodecs.JsonCodec<TxEnvelope> = (() => {
    const txEraTag2EraStr: codec.Codec<string, string, string> = {
      deserialise: (str: string): Result<string, string> => {
        const match = str.match(/^Tx (\w+)Era$/);
        if (match) {
          return ok(match[1]);
        }
        return err(`Invalid tx era tag: ${str}`);
      },
      serialise: (eraStr: string): string => `Tx ${eraStr}Era`,
    };
    return codec.rmap(jsonCodecs.objectOf({
        cborHex: codec.rmap(
          uint8Array.jsonCodec,
          TxCborBytes.unsafeFromBytes,
          (txCborBytes) => txCborBytes
        ),
        description: jsonCodecs.json2StringCodec,
        type: codec.pipe(
          jsonCodecs.json2StringCodec,
          codec.pipe(
            txEraTag2EraStr,
            Era.stringCodec,
          )
        )
      }),
      (json) => ({
        tx: json.cborHex,
        description: json.description,
        era: json.type,
      }),
      (txEnvelope) => ({
        cborHex: txEnvelope.tx,
        description: txEnvelope.description,
        type: txEnvelope.era,
      })
    );
  })();
}

export const execCardanoCli = (args: CliArgs, debug: boolean = false): Result<string, CommandError> => {
  return execCli('cardano-cli', args, debug);
}

export const execCardanoCliJsonTyped = <T>(args: CliArgs, deserialiser: JsonDeserialiser<T>, debug: boolean = false): Result<T, CommandError | JsonError> => {
  return execCliJsonTyped('cardano-cli', args, deserialiser, debug);
}

export type Path = string;

const mkJson2ValueRecordDeserialiser = (scriptHash: ScriptHash): JsonDeserialiser<ValueRecord[]> => {
  const json2ValueEntriesDeserialiser: JsonDeserialiser<[AssetId, PositiveCoin][]> = codec.pipeDeserialisers(
    jsonCodecs.dictOf(PositiveCoin.jsonCodec).deserialise,
    (innerObj: { [assetNameHex: string]: PositiveCoin }) => {
      const tokens: Result<[AssetId, PositiveCoin], JsonError>[] = Object.entries(innerObj)
        .map(([assetNameHex, positiveCoin]: [string, PositiveCoin]) =>
          AssetName.jsonCodec.deserialise(assetNameHex).map((assetName: AssetName) => {
            const assetId = [scriptHash, assetName];
            return [assetId, positiveCoin] as [AssetId, PositiveCoin]
          })
        );
      return Result.combineWithAllErrors(tokens);
    }
  );
  return codec.rmapDeserialiser(
    json2ValueEntriesDeserialiser,
    (entries: [AssetId, PositiveCoin][]) => entries.map(([unit, quantity]) => ({ unit, quantity } as ValueRecord))
  );
}

const json2ValueRecordsDeserialiser: JsonDeserialiser<ValueRecord[]> = codec.pipeDeserialisers(
  jsonCodecs.json2ObjectCodec.deserialise,
  (obj: { [key: string]: Json }): Result<ValueRecord[], JsonError> => {
    const step = ([unit, quantityOrInnerObj]: [string, Json]): Result<ValueRecord[], JsonError> => {
      if (unit === "lovelace") {
        return PositiveCoin.jsonCodec.deserialise(quantityOrInnerObj).map(quantity => [{unit: "lovelace", quantity}]);
      }
      return ScriptHash.jsonCodec.deserialise(unit).andThen((scriptHash: ScriptHash) =>
        mkJson2ValueRecordDeserialiser(scriptHash)(quantityOrInnerObj)
      );
    };
    const results: Result<ValueRecord[], JsonError>[] = Object.entries(obj).map(step);
    return Result.combineWithAllErrors(results).map(recordsArrays => recordsArrays.flat());
  }
);

const json2ValueDeserialiser: JsonDeserialiser<Value> = codec.pipeDeserialisers(
  json2ValueRecordsDeserialiser,
  valueRecords2ValueCodec.deserialise
);

export type TxOut = {
  address: AddressBech32;
  datum: string | null;
  datumhash: string | null;
  inlineDatum: string | null;
  inlineDatumRaw: string | null;
  referenceScript: string | null;
  value: Value;
};

export namespace TxOut {
  /**
   * `referenceScript` comes in two shapes:
   *
   *   - a hex string — cardano-cli < 10 printed the script bytes directly,
   *   - a JSON object — cardano-cli >= 10 prints
   *     `{"script": {"cborHex": "…"}, "description": "…", "type": "PlutusScriptV3"}`.
   *
   * We normalise both to the script's cbor hex.
   */
  export const referenceScriptDeserialiser: jsonCodecs.JsonDeserialiser<string | null> = (json) => {
    if (json === null) return ok(null);
    if (typeof json === "string") return ok(json);
    if (typeof json === "object" && !Array.isArray(json)) {
      const script = (json as Record<string, unknown>).script;
      if (typeof script === "object" && script !== null && !Array.isArray(script)) {
        const cborHex = (script as Record<string, unknown>).cborHex;
        if (typeof cborHex === "string") return ok(cborHex);
      }
    }
    return err(`Expected a reference script (hex string or script object), got: ${stringify(json)}`);
  };

  export const jsonDeserialiser: JsonDeserialiser<TxOut> = (() => {
    const optStr = jsonCodecs.nullableDeserialiser(jsonCodecs.json2StringCodec.deserialise);
    return jsonCodecs.objectOfDeserialiser({
      address: codec.pipeDeserialisers(
        jsonCodecs.json2StringCodec.deserialise,
        AddressBech32.fromString
      ),
      datum: optStr,
      datumhash: optStr,
      inlineDatum: optStr,
      inlineDatumRaw: optStr,
      referenceScript: referenceScriptDeserialiser,
      value: json2ValueDeserialiser,
    });
  })();
}

export type UtxoMap = Tagged<Map<TxOutRefHex, TxOut>, 'UtxoMap'>;

export namespace UtxoMap {
  export const jsonDeserialiser: JsonDeserialiser<UtxoMap> = codec.pipeDeserialisers(
    jsonCodecs.dictOfDeserialiser(TxOut.jsonDeserialiser),
    (obj: { [txOutRefHex: string]: TxOut }): Result<UtxoMap, JsonError> => {
      const entries: Result<[TxOutRefHex, TxOut], JsonError>[] = Object.entries(obj)
        .map(([txOutRefHex, txOut]) =>
          TxOutRefHex.fromString(txOutRefHex).map((txOutRef: TxOutRefHex) => [txOutRef, txOut] as [TxOutRefHex, TxOut])
        );
      const result: Result<Map<TxOutRefHex, TxOut>, JsonError> = Result.combineWithAllErrors(entries).map((entriesArray: [TxOutRefHex, TxOut][]) => {
        const utxoMap = new Map<TxOutRefHex, TxOut>();
        for (const [txOutRef, txOut] of entriesArray) {
          utxoMap.set(txOutRef, txOut);
        }
        return utxoMap;
      });
      return result as Result<UtxoMap, JsonError>;
    }
  );
  export const toUtxos = (utxoMap: UtxoMap): Utxo[] => {
    const result: Utxo[] = [];
    utxoMap.forEach((txOut, txOutRef) => {
      result.push({
        txOutRef,
        txOut,
      });
    });
    return result;
  }
}

export type Utxo = { txOutRef: TxOutRefHex; txOut: TxOut };

export type Tip = {
  block: PositiveBigInt,
  epoch: PositiveBigInt,
  era: string;
  hash: string;
  slot: PositiveBigInt,
  slotInEpoch: PositiveBigInt,
  slotsToEpochEnd: PositiveBigInt,
  syncProgress: number;
};

/**
 * `cardano-cli` prints `syncProgress` as a *string* (e.g. `"24.42"`), but
 * other tools print it as a number. Accept both.
 */
const json2NumberLikeCodec: jsonCodecs.JsonCodec<number> = {
  deserialise: (json: Json): Result<number, JsonError> => {
    if (typeof json === "number") return ok(json);
    if (typeof json === "string") {
      const parsed = Number(json);
      if (Number.isNaN(parsed)) return err(`Invalid number string: ${json}`);
      return ok(parsed);
    }
    return err(`Expected number but got: ${stringify(json)}`);
  },
  serialise: (value: number) => value,
};

export namespace Tip {
  export const jsonDeserialiser: JsonDeserialiser<Tip> = jsonCodecs.objectOfDeserialiser({
    block: PositiveBigInt.jsonCodec.deserialise,
    epoch: PositiveBigInt.jsonCodec.deserialise,
    era: jsonCodecs.json2StringCodec.deserialise,
    hash: jsonCodecs.json2StringCodec.deserialise,
    slot: PositiveBigInt.jsonCodec.deserialise,
    slotInEpoch: PositiveBigInt.jsonCodec.deserialise,
    slotsToEpochEnd: PositiveBigInt.jsonCodec.deserialise,
    syncProgress: json2NumberLikeCodec.deserialise,
  });
}

const setNetworkArg = (args: CliArgs, networkMagicNumber?: NetworkMagicNumber): void => {
  if (networkMagicNumber) {
    if(networkMagicNumber !== NetworkMagicNumber.MAINNET) {
      args.push(["--testnet-magic", networkMagicNumber]);
    } else {
      args.push("--mainnet");
    }
  }
}

/** The magic number `getTip` used before it learned to take a network. */
const PREVIEWNET_MAGIC: NetworkMagicNumber = NetworkMagicNumber.fromPositiveBigInt(
  PositiveBigInt.fromDigits(1, 0, 9, 7, 9, 1, 1, 0, 6, 3),
);

export type TipError =
  | { type: "TipQueryFailed"; error: CommandError | JsonError }
  | { type: "NodeNotSynchronised"; syncProgress: number };

/**
 * Query the tip of the chain.
 *
 * Fails with {@link TipError} instead of throwing: a node that is not
 * synchronised (or not reachable at all) is an ordinary, expected outcome
 * for a caller that polls the chain, not a programming error.
 */
export const getTip = (
  debug: boolean = false,
  networkMagicNumber?: NetworkMagicNumber,
): Result<Tip, TipError> => {
  const args: CliArgs = [
    "query", "tip",
    "--output-json",
  ];
  setNetworkArg(args, networkMagicNumber ?? PREVIEWNET_MAGIC);
  return execCardanoCliJsonTyped(
    args,
    Tip.jsonDeserialiser,
    debug,
  )
    .mapErr((error): TipError => ({ type: "TipQueryFailed", error }))
    .andThen((tip): Result<Tip, TipError> => {
      const syncProgress = typeof tip.syncProgress === 'string' ? parseFloat(tip.syncProgress) : tip.syncProgress;
      if (syncProgress < 1) {
        return err<never, TipError>({ type: "NodeNotSynchronised", syncProgress });
      }
      return ok(tip);
    });
};

export const queryUtxosByAddress = (address: AddressBech32, networkMagicNumber?: NetworkMagicNumber, debug: boolean = false): Result<UtxoMap, CommandError | JsonError> => {
  const args: CliArgs = [
    "query", "utxo",
    ["--address", address],
    "--output-json"
  ];
  setNetworkArg(args, networkMagicNumber);
  return execCardanoCliJsonTyped(
    args,
    UtxoMap.jsonDeserialiser,
    debug,
  );
};

export type TxIdParseError = {
  type: "TxIdParseError";
  reason: "notHexOrJson" | "notJsonObject" | "missingTxHashField" | "invalidTxHash";
  /** The (truncated) output we could not interpret. */
  output: string;
};

const truncateOutput = (output: string, maxLength: number = 200): string =>
  output.length <= maxLength ? output : `${output.slice(0, maxLength)}…`;

/**
 * Parse the stdout of `cardano-cli conway transaction txid`.
 *
 * `cardano-cli` prints the **bare hex** transaction id in text mode (the
 * default) — that is what every version with the command does, from
 * 8.13.0.0 up to and including 11.x. Since 10.3.0.0 the command also accepts
 * `--output-json`, in which case it prints `{"txhash": "<hex>"}`.
 *
 * We deliberately do *not* pass `--output-json`: cardano-cli versions older
 * than 10.3.0.0 reject unknown options, so the flag would break them. This
 * parser therefore accepts both shapes.
 */
export const txIdFromTxIdOutput = (raw: string): Result<TxIdHex, TxIdParseError> => {
  const trimmed = raw.trim();

  // Bare hex — the default text output of every cardano-cli that has the command.
  const bare = TxIdHex.fromString(trimmed);
  if (bare.isOk()) return ok(bare.value);

  // JSON envelope — cardano-cli >= 10.3.0.0 with `--output-json`.
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return err({ type: "TxIdParseError", reason: "notHexOrJson", output: truncateOutput(trimmed) });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return err({ type: "TxIdParseError", reason: "notJsonObject", output: truncateOutput(trimmed) });
  }
  const txHash = (parsed as Record<string, unknown>).txhash;
  if (typeof txHash !== "string") {
    return err({ type: "TxIdParseError", reason: "missingTxHashField", output: truncateOutput(trimmed) });
  }
  const fromJson = TxIdHex.fromString(txHash);
  if (fromJson.isErr()) {
    return err({ type: "TxIdParseError", reason: "invalidTxHash", output: truncateOutput(trimmed) });
  }
  return ok(fromJson.value);
};

export const getTxIdFromTxFile = (
  txFilePath: Path,
  debug = false
): Result<TxIdHex, CommandError | TxIdParseError> => {
  return execCardanoCli(
    [
      "conway", "transaction", "txid",
      ["--tx-file", txFilePath],
    ],
    debug,
  ).andThen(txIdFromTxIdOutput);
};

export const getTxIdFromTxBodyFile = (
  txBodyFilePath: Path,
  debug = false
): Result<TxIdHex, CommandError | TxIdParseError> => {
  return execCardanoCli(
    [
      "conway", "transaction", "txid",
      ["--tx-body-file", txBodyFilePath],
    ],
    debug,
  ).andThen(txIdFromTxIdOutput);
};

export const getTxId = (txHex: TxHex, tmpDir: Path | null = null): Result<TxIdHex, CommandError | TxIdParseError> => {
  const rootTmpDir = tmpDir || `${nodeOs.tmpdir()}`;
  const txTmpDir = `${rootTmpDir}/txid-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  nodeFs.mkdirSync(txTmpDir, { recursive: true });
  const txFilePath = `${txTmpDir}/tx.json`;
  const txJson = {
    type: "Tx ConwayEra",
    description: "Ledger Cddl Format",
    cborHex: txHex,
  };
  nodeFs.writeFileSync(txFilePath, JSON.stringify(txJson));
  return getTxIdFromTxFile(txFilePath);
};

export type TimeoutError = {
  type: "TimeoutError";
  message: string;
  timeout: Milliseconds;
};

export type WaitForUtxoError = CommandError | JsonError | TimeoutError | TxIdParseError;

export const waitForUtxo: (
  txOutRef: TxOutRefHex,
  debug?: boolean,
  delayMs?: number,
  timeoutMs?: number,
) => ResultAsync<TxOut, WaitForUtxoError> = fromSafePromiseResultFn(async (txOutRef, debug = false, delayMs = 1000, timeoutMs = 200_000,) => {
  const startTime = Date.now();
  const loop = async (): Promise<Result<TxOut, WaitForUtxoError>> => {
    if(Date.now() - startTime < timeoutMs) {
      return execCardanoCliJsonTyped(
        [
          "conway", "query", "utxo",
          ["--tx-in", txOutRef],
          "--output-json",
        ],
        UtxoMap.jsonDeserialiser,
        debug,
      ).match(
        async (utxos) => {
          const entries = UtxoMap.toUtxos(utxos).filter(utxo => utxo.txOutRef === txOutRef);
          if (entries.length === 1) {
            return ok(entries[0]!.txOut);
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return loop();
        },
        async e => err(e)
      );
    }
    return err({
      type: "TimeoutError",
      message: `Utxo ${txOutRef} did not appear within ${timeoutMs}ms`,
      timeout: timeoutMs,
    } as TimeoutError);
  }
  return loop();
});

const flattenTxId = (txId: TxId | TxIdHex): TxId => {
  if (typeof txId === 'string') {
    return TxIdHex.toTxId(txId);
  } else {
    return txId;
  }
}

// This function assumes that there is no other consumer of a given
// transaction output #0 as it awaits for that particular UTxO.
export const waitForTx = (
  // Either uint8array or hex string
  txIdOrTxIdRef: TxId | TxIdHex,
  debug = false,
  delayMs = 1000,
  timeoutMs = 200_000,
): ResultAsync<null, WaitForUtxoError> => {
  const txId = flattenTxId(txIdOrTxIdRef);
  if(debug) console.log(`[cardanoCli] wait-for-tx: txid=${txId} timeoutMs=${timeoutMs}`);
  const txOutRef = TxOutRefHex.fromTxOutRef({ txId, txIx: TxIx.fromDigits(0) });
  const start = Date.now();
  return waitForUtxo(txOutRef, debug, delayMs, timeoutMs)
    .map((): null => {
      if(debug) console.log(`[cardanoCli] wait-for-tx-confirmed: txid=${txId} elapsedMs=${Date.now() - start}`);
      return null;
    })
    .mapErr((err) => {
      if(debug) console.error(`[cardanoCli] wait-for-tx-timeout: txid=${txId} elapsedMs=${Date.now() - start} err=${String(err)}`);
      return err;
    });
};

export const signTxEnvelope = function (
  skeyFile: string,
  txEnvelope: TxEnvelope,
  debug = false,
  tmpDir: Path | null = null, // When null we will use system temp dir
): Result<TxEnvelope, jsonCodecs.JsonError | CommandError | string> {
  const txTmpDir = tmpDir || `${nodeOs.tmpdir()}`;
  const txEnvelopeJson = jsonCodecs.mkStringifier(TxEnvelope.jsonCodec)(txEnvelope);
  const unsignedTxFile = `${txTmpDir}/unsigned.tx.json`;
  const signedTxFile = `${txTmpDir}/sined.tx.json`;
  nodeFs.writeFileSync(unsignedTxFile, txEnvelopeJson);
  return execCardanoCli(
    [
      "conway", "transaction", "sign",
      ["--tx-file", unsignedTxFile],
      ["--signing-key-file", skeyFile],
      ["--out-file", signedTxFile],
    ],
    debug,
  )
    .andThen(() => {
      const signedTxJsonStr = nodeFs.readFileSync(signedTxFile, "utf8");
      return jsonCodecs.mkParser(TxEnvelope.jsonCodec)(signedTxJsonStr);
    });
};

export const signTx = function (
  skeyFile: string,
  txHex: TxHex,
  tmpDir: Path | null = null, // When null we will use system temp dir
  debug = false,
): Result<TxHex, CommandError | JsonError> {
  return getTxId(txHex).andThen(txIdHex => {
    // Create temp directory for transaction signing
    const rootTmpDir = tmpDir || `${nodeOs.tmpdir()}`;
    const txTmpDir = `${rootTmpDir}/tx-${txIdHex}`;
    nodeFs.mkdirSync(txTmpDir, { recursive: true });

    // Prepare transaction body for signing
    const txBodyJson = {
      type: "Unwitnessed Tx ConwayEra",
      description: "Ledger Cddl Format",
      cborHex: txHex,
    };
    const txBodyFile = `${txTmpDir}/tx.body.json`;
    const txSignedFile = `${txTmpDir}/tx.signed.json`;
    nodeFs.writeFileSync(txBodyFile, JSON.stringify(txBodyJson));

    // Sign the transaction
    return execCardanoCli(
      [
        "conway", "transaction", "sign",
        ["--tx-body-file", txBodyFile],
        ["--signing-key-file", skeyFile],
        ["--out-file", txSignedFile],
      ],
      debug,
    ).map(() => {
      const signedTxJsonStr = nodeFs.readFileSync(txSignedFile, "utf8");
      const signedTxJson = JSON.parse(signedTxJsonStr);
      const signedTxHex: TxHex = signedTxJson.cborHex;
      return signedTxHex;
    });
  });
};

export type TxEnvelopeFile = Tagged<Path, 'TxEnvelopeFile'>;

const persistFailedTx = (txFile: Path, label: string): void => {
  const TX_DIAG_DIR = process.env.ROOT_DIR || process.cwd();
  try {
    nodeFs.mkdirSync(TX_DIAG_DIR, { recursive: true });
    const ts = Date.now();
    const dest = `${TX_DIAG_DIR}/${label}-${ts}-${path.basename(txFile)}`;
    nodeFs.copyFileSync(txFile, dest);
    console.error(`[cardanoCli] persisted failed tx-body to ${dest}`);
  } catch (e) {
    console.error(`[cardanoCli] could not persist failed tx: ${String(e)}`);
  }
};

export const submitTxFromEnvelopeFile = (
  txFile: Path,
  debug = false,
  intervalMs = 1_000,
  timeoutMs = 180_000,
): ResultAsync<TxIdHex, WaitForUtxoError> => {
  if(debug) console.log(`[cardanoCli] submitTxFromEnvelopeFile: txFile=${txFile}`);
  return toAsync(execCardanoCli(
    [
      "conway", "transaction", "submit",
      ["--tx-file", txFile],
    ],
    debug,
  ))
    .andThen(() => toAsync(getTxIdFromTxFile(txFile, debug)))
    .andThen((txId) => {
      if(debug) console.log(`[cardanoCli] submit-ok: txid=${txId} file=${txFile}`);
      return waitForTx(txId, debug, intervalMs, timeoutMs).map(() => txId);
    })
    .mapErr((err) => {
      if(debug) {
        console.error(`[cardanoCli] submit-fail: file=${txFile} err=${String(err)}`);
        persistFailedTx(txFile, "submit-fail");
      }
      return err;
    });
};

export const submitTxEnvelope = (
  txEnvelope: TxEnvelope,
  debug = false,
  tmpDir: Path | null = null,
  intervalMs = 1_000,
  timeoutMs = 180_000,
): ResultAsync<TxIdHex, WaitForUtxoError> => {
  const txEnvelopeJson = jsonCodecs.mkStringifier(TxEnvelope.jsonCodec)(txEnvelope);
  const rootTmpDir = tmpDir || `${nodeOs.tmpdir()}`;
  const txTmpDir = `${rootTmpDir}/tx-submit-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  nodeFs.mkdirSync(txTmpDir, { recursive: true });
  const txEnvelopeFile = `${txTmpDir}/tx.json`;
  nodeFs.writeFileSync(txEnvelopeFile, txEnvelopeJson);
  return submitTxFromEnvelopeFile(txEnvelopeFile, debug, intervalMs, timeoutMs);
}

export const submitTx = (
  txHex: TxHex,
  era: "conway" | "babbage" | "dijkstra" = "conway",
  tmpDir: Path | null = null,
  intervalMs = 1_000,
  timeoutMs = 180_000,
  debug = true,
): ResultAsync<TxIdHex, WaitForUtxoError> => {
  return toAsync(getTxId(txHex))
    .andThen((txIdHex) => {
      // Create temp directory for transaction submission
      const rootTmpDir = tmpDir || `${nodeOs.tmpdir()}`;
      const txTmpDir = `${rootTmpDir}/tx-submit-${txIdHex}`;
      nodeFs.mkdirSync(txTmpDir, { recursive: true });
      const txTag = (() => {
        switch (era) {
          case "conway":
            return "Tx ConwayEra";
          case "babbage":
            return "Tx BabbageEra";
          case "dijkstra":
            return "Tx DijkstraEra";
        }
      })();
      // Prepare transaction body for submission
      const txEnvelope = {
        type: txTag,
        description: "Ledger Cddl Format",
        cborHex: txHex,
      };
      const txEnvelopeFile = `${txTmpDir}/tx.json`;
      nodeFs.writeFileSync(txEnvelopeFile, JSON.stringify(txEnvelope));
      return submitTxFromEnvelopeFile(txEnvelopeFile, debug, intervalMs, timeoutMs);
  });
}

export type InsufficientFundsError = {
  type: "InsufficientFunds";
  requiredLovelace: bigint;
  availableLovelace: bigint;
};

/**
 * Select enough UTxOs (largest first) to cover `amountLovelace`.
 *
 * Returns {@link InsufficientFundsError} when the wallet cannot cover the
 * amount — the caller decides whether that is fatal.
 */
export const selectUtxos = (
  amountLovelace: number,
  utxoMap: UtxoMap,
): Result<
  {
    selectedUtxos: UtxoMap;
    totalLovelace: number;
  },
  InsufficientFundsError
> => {
  const amountLovelaceBig = BigInt(amountLovelace);
  const sortedUtxos = [...utxoMap.entries()].sort(
    ([_aKey, a], [_bKey, b]) => {
      const aL = a.value.lovelace as unknown as bigint;
      const bL = b.value.lovelace as unknown as bigint;
      if (bL > aL) return 1;
      if (bL < aL) return -1;
      return 0;
    },
  );
  const selectedUtxos: UtxoMap = new Map<TxOutRefHex, TxOut>() as UtxoMap;
  let totalLovelaceBig = 0n;
  for (const [txOutRef, utxo] of sortedUtxos) {
    selectedUtxos.set(txOutRef, utxo);
    totalLovelaceBig += utxo.value.lovelace as unknown as bigint;
    if (totalLovelaceBig >= amountLovelaceBig) {
      break;
    }
  }
  if (totalLovelaceBig < amountLovelaceBig) {
    return err({
      type: "InsufficientFunds",
      requiredLovelace: amountLovelaceBig,
      availableLovelace: totalLovelaceBig,
    });
  }
  return ok({ selectedUtxos, totalLovelace: Number(totalLovelaceBig) });
};

const MAX_TRANSFER_RECIPIENTS = 60;
export type Recipient = {
  amount: number;
  address: AddressBech32
};

export type TransferFundsError =
  | { type: "TooManyRecipients"; max: number; requested: number }
  | InsufficientFundsError
  | { type: "UtxoQueryFailed"; error: CommandError | JsonError }
  | { type: "CommandFailed"; step: "build" | "sign"; error: CommandError }
  | { type: "SubmitFailed"; error: WaitForUtxoError };

/**
 * Move `recipients` out of the wallet at `walletAddress`.
 *
 * The transaction is only submitted once it has been built *and* signed, and
 * every failure is reported through {@link TransferFundsError} — including
 * *which* step failed. The returned transaction id is the one the node
 * confirmed, so a successful result always means the funds moved.
 */
export async function transferFunds(
  walletAddress: AddressBech32,
  walletSkeyFile: Path,
  recipients: Recipient[],
  tmpDir: Path | null = null,
  networkMagicNumber?: NetworkMagicNumber,
  debug = false,
): Promise<Result<TxIdHex, TransferFundsError>> {
  if (recipients.length > MAX_TRANSFER_RECIPIENTS) {
    return err({
      type: "TooManyRecipients",
      max: MAX_TRANSFER_RECIPIENTS,
      requested: recipients.length,
    });
  }

  let walletTmpDir: Path;
  if (tmpDir) {
    walletTmpDir = tmpDir;
    nodeFs.mkdirSync(walletTmpDir, { recursive: true });
  } else {
    walletTmpDir = `${nodeOs.tmpdir()}/split-utxos-${Date.now()}-${Math.floor(
      Math.random() * 1000000,
    )}`;
    nodeFs.mkdirSync(walletTmpDir, { recursive: true });
  }

  const socketPath = process.env.CARDANO_NODE_SOCKET_PATH;
  const appendSocketPathArg = (args: CliArgs): void => {
    if (socketPath) {
      args.push(["--socket-path", socketPath]);
    }
  };

  const queryArgs: CliArgs = [
    "conway", "query", "utxo",
    ["--address", walletAddress],
    "--output-json",
  ];
  setNetworkArg(queryArgs, networkMagicNumber);
  appendSocketPathArg(queryArgs);

  const initialUtxoMap = await execCardanoCliJsonTyped(
    queryArgs,
    UtxoMap.jsonDeserialiser,
    debug,
  );
  if (initialUtxoMap.isErr()) {
    return err({ type: "UtxoQueryFailed", error: initialUtxoMap.error });
  }

  const totalSplit = recipients.reduce((sum, r) => sum + r.amount, 0);
  const selectedUtxos = selectUtxos(totalSplit, initialUtxoMap.value);
  if (selectedUtxos.isErr()) {
    return err(selectedUtxos.error);
  }

  const unsigedTxFile = `${walletTmpDir}/split.body.json`;
  const buildArgs: CliArgs = [
    "conway", "transaction", "build",
    ...Array.from(selectedUtxos.value.selectedUtxos.keys()).map((txOutRef) => ["--tx-in", txOutRef] as CliArg),
    ...recipients.map((recipient) => ["--tx-out", `${recipient.address}+${recipient.amount}`] as CliArg),
    ["--change-address", walletAddress],
    ["--out-file", unsigedTxFile],
  ];
  setNetworkArg(buildArgs, networkMagicNumber);
  appendSocketPathArg(buildArgs);
  const build = execCardanoCli(buildArgs, debug);
  if (build.isErr()) {
    return err({ type: "CommandFailed", step: "build", error: build.error });
  }

  const signedTxFile = `${walletTmpDir}/split.tx.json`;

  const sign = execCardanoCli(
    [
      "conway", "transaction", "sign",
      ["--signing-key-file", walletSkeyFile],
      ["--tx-body-file", unsigedTxFile],
      ["--out-file", signedTxFile],
    ],
    debug,
  );
  if (sign.isErr()) {
    return err({ type: "CommandFailed", step: "sign", error: sign.error });
  }

  if(debug) console.log(`[cardanoCli] transferFunds: built unsigned tx, recipients=${recipients.length} totalLovelace=${totalSplit}`);
  const submitted = await submitTxFromEnvelopeFile(signedTxFile, debug);
  if (submitted.isErr()) {
    return err({ type: "SubmitFailed", error: submitted.error });
  }
  return ok(submitted.value);
}

export type CreateWalletError =
  | { type: "CommandFailed"; step: "key-gen" | "address-build"; error: CommandError }
  | { type: "AddressParseFailed"; address: string; error: JsonError };

// | Generate a fresh payment-only wallet on the given network and return its
// address plus the path to its signing key. The wallet files are written under
// `tmpDir` (or a fresh system temp dir if not provided) — callers that need
// cleanup are responsible for removing it.
export const createWallet = (
  networkMagicNumber: NetworkMagicNumber,
  tmpDir: Path | null = null,
  debug = false,
): Result<Wallet, CreateWalletError> => {
  const walletTmpDir =
    tmpDir ?? `${nodeOs.tmpdir()}/wallet-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  nodeFs.mkdirSync(walletTmpDir, { recursive: true });

  const vkeyFile = `${walletTmpDir}/wallet.vkey`;
  const skeyFile = `${walletTmpDir}/wallet.skey`;
  const addrFile = `${walletTmpDir}/wallet.addr`;

  return execCardanoCli(
    [
      "conway", "address", "key-gen",
      ["--verification-key-file", vkeyFile],
      ["--signing-key-file", skeyFile],
    ],
    debug,
  )
    .mapErr((error): CreateWalletError => ({ type: "CommandFailed", step: "key-gen", error }))
    .andThen(() => {
      const buildArgs: CliArgs = [
        "conway", "address", "build",
        ["--payment-verification-key-file", vkeyFile],
        ["--out-file", addrFile],
      ];
      setNetworkArg(buildArgs, networkMagicNumber);

      return execCardanoCli(buildArgs, debug)
        .mapErr((error): CreateWalletError => ({ type: "CommandFailed", step: "address-build", error }));
    })
    .andThen(() => {
      const addrStr = nodeFs.readFileSync(addrFile, "utf8").trim();
      return AddressBech32.fromString(addrStr)
        .mapErr((error): CreateWalletError => ({ type: "AddressParseFailed", address: addrStr, error }))
        .map((addr): Wallet => ({ addr, skeyFile: skeyFile as TaggedPath }));
    });
};

