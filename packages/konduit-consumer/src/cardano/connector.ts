/* A tiny wrappings around the wasm which provides some more typing */

import * as wasm from "../../wasm/konduit_wasm.js";
export type { CardanoConnector as WasmCardanoConnector, TransactionReadyForSigning } from "../../wasm/konduit_wasm.js";
export { LogLevel } from "../../wasm/konduit_wasm.js";
import { Ed25519PrivateKey } from "@konduit/cardano-keys/rfc8032";
import { type Ed25519VerificationKey } from "@konduit/cardano-keys";
import { err, ok, Result } from "neverthrow";
import { Lovelace, NetworkMagicNumber, TxCborBytes, TxHash } from "../cardano";
import { stringifyAsyncThrowable } from "@konduit/codec/neverthrow";
import type { JsonError } from "@konduit/codec/json/codecs";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import type { Milliseconds } from "../time/duration";
import { ChannelTag } from "../channel/core";
import { ConsumerEd25519VerificationKey } from "../channel/l1Channel";
import { AdaptorEd25519VerificationKey } from "../adaptorClient/adaptorInfo";
import { JsonAsyncCodec } from "@konduit/codec/json/async";

export const enableLogs = (level: wasm.LogLevel): void => {
  wasm.enableLogs(level);
};

// A tiny wrapper around wasm data structure which does the safe type casting
export type Transaction = {
  toCbor: () => TxCborBytes;
  txHash: () => TxHash;
  // This MUTATES THE transaction.
  sign: (ed25519PrivateKey: Ed25519PrivateKey) => Result<Transaction, string>;
  _inner: wasm.TransactionReadyForSigning,
};

// export const mkCbor2NonEmptySetCodec = <T>(itemCodec: CborCodec<T>): CborCodec<NonEmptySet<T>> => {
// 
// // transaction_witness_set = 
// //   { ? 0 : nonempty_set<vkeywitness>      
// //   , ? 1 : nonempty_set<native_script>    
// //   , ? 2 : nonempty_set<bootstrap_witness>
// //   , ? 3 : nonempty_set<plutus_v1_script> 
// //   , ? 4 : nonempty_set<plutus_data>      
// //   , ? 5 : redeemers                       
// //   , ? 6 : nonempty_set<plutus_v2_script> 
// //   , ? 7 : nonempty_set<plutus_v3_script> 
// //   }
// 
// export type TransactionWitnessSetRecord = [
//   vkeyWitnesses: NonEmptySet<Ed25519VerificationKeyWitness> | null;
//   // nativeScripts: NonEmptySet<wasm.NativeScript> | null;
//   // bootstrapWitnesses: NonEmptySet<wasm.BootstrapWitness> | null;
//   // plutusV1Scripts: NonEmptySet<wasm.PlutusV1Script> | null;
//   // plutusData: NonEmptySet<wasm.PlutusData> | null;
//   // redeemers: wasm.Redeemers | null;
//   // plutusV2Scripts: NonEmptySet<wasm.PlutusV2Script> | null;
//   // plutusV3Scripts: NonEmptySet<wasm.PlutusV3Script> | null;
// ];

// // Let's build step by step as we debug stuff
// // a full transaction record type which nearly maps
// // to the Cbor structure:
// // transaction = [transaction_body, transaction_witness_set, bool, auxiliary_data/ nil]/
// // export type TransactionRecord = [
// //   TxBodyCborBytes, // transaction_body
// //   TxWitnessSets, // transaction_witness_set
// //   boolean, // is_valid
// //   Cbor, //
// // ];
// // 

export const mkTransaction = (txReadyForSigning: wasm.TransactionReadyForSigning): Transaction => {
  return {
    toCbor: () => txReadyForSigning.toCbor() as TxCborBytes,
    txHash: () => {
      let txHashBytes = txReadyForSigning.getId();
      return TxHash.fromBytes(txHashBytes).match(
        (txHash: Uint8Array) => txHash as TxHash,
        (error: string) => {
          throw new Error(`Panic: tx hash returned from WASM has not passed validation: ${error}`);
        }
      );
    },
    sign: (ed25519PrivateKey: Ed25519PrivateKey) => {
      try {
        const signedTx = txReadyForSigning.sign(ed25519PrivateKey.secret);
        return ok(mkTransaction(signedTx));
      } catch (error) {
        return err(`Failed to sign transaction: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    _inner: txReadyForSigning,
  };
}

export class Connector {
  public readonly networkMagicNumber: NetworkMagicNumber;

  private connector: wasm.CardanoConnector;
  private readonly _backendUrl: string;

  private constructor(connector: wasm.CardanoConnector, backendUrl: string, networkMagicNumber: NetworkMagicNumber) {
    this.connector = connector;
    this._backendUrl = backendUrl;
    this.networkMagicNumber = networkMagicNumber;
  }

  static async new(backendUrl: string, httpTimeout?: Milliseconds): Promise<Result<Connector, string>> {
    const timeout = httpTimeout != null? BigInt(httpTimeout) : null;
    console.debug("CALLING WASM");
    const possibleConnector = await stringifyAsyncThrowable(() => wasm.CardanoConnector.new(backendUrl, timeout));
    console.debug("CREATED");
    return possibleConnector.andThen((connector: wasm.CardanoConnector) => {
      return PositiveBigInt.fromBigInt(connector.network_magic_number).match(
        (positive) => {
          let networkMagicNumber = NetworkMagicNumber.fromPositiveBigInt(positive);
          return ok(new Connector(connector, backendUrl, networkMagicNumber));
        },
        () => {
          return err(`Invalid network magic number: ${connector.network_magic_number}`);
        }
      );
    });
  }

  public get backendUrl(): string {
    return this._backendUrl;
  }

  // Tx builder API
  async buildOpenTx(
    tag: ChannelTag,
    consumer: ConsumerEd25519VerificationKey,
    adaptor: AdaptorEd25519VerificationKey,
    closePeriod: Milliseconds,
    amount: Lovelace,
  ): Promise<Result<Transaction, string>> {
    try {
      const tx = await wasm.open(
        this.connector,
        tag as Uint8Array,
        consumer.key,
        adaptor.key,
        BigInt(closePeriod),
        amount,
      );
      return ok(mkTransaction(tx));
    } catch (error) {
      return err(error);
    }
  };

  async buildCloseTx(
    tag: ChannelTag,
    consumer: ConsumerEd25519VerificationKey,
  ): Promise<Result<wasm.TransactionReadyForSigning, string>> {
    return stringifyAsyncThrowable(async () => await wasm.close(
      this.connector,
      tag,
      consumer.key
    ));
  }

  // Wallet API:
  async submit(
    transaction: wasm.TransactionReadyForSigning,
  ): Promise<Result<TxHash, string>> {
    const possibleTxHashBytes = await stringifyAsyncThrowable(async () => this.connector.submit(transaction));
    return possibleTxHashBytes.andThen(
      (txHashBytes) => TxHash.fromBytes(txHashBytes),
    );
  }

  async balance(vkey: Ed25519VerificationKey): Promise<Result<Lovelace, JsonError>> {
    const result = await stringifyAsyncThrowable(async () => {
       return await this.connector.balance(vkey.key);
    });
    return result.andThen((balance: bigint) => {
      return Lovelace.fromBigInt(balance);
    });
  }
}
export const json2ConnectorAsyncCodec: JsonAsyncCodec<Connector> = {
  deserialise: async (backendUrl: string) => Connector.new(backendUrl),
  serialise: (connector: Connector) => connector.backendUrl,
};
