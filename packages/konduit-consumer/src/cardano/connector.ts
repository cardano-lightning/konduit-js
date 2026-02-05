/* A tiny wrappings around the wasm which provides some more typing */

import * as wasm from "../../wasm/konduit_wasm.js";
export type { CardanoConnector as WasmCardanoConnector, TransactionReadyForSigning } from "../../wasm/konduit_wasm.js";
export { LogLevel } from "../../wasm/konduit_wasm.js";
import { extractPrvScalar, SKey, type Ed25519PrvScalar, type VKey } from "@konduit/cardano-keys";
import { err, ok, Result } from "neverthrow";
import { Lovelace, NetworkMagicNumber, TxHash } from "../cardano";
import { stringifyAsyncThrowable } from "@konduit/codec/neverthrow";
import type { JsonError } from "@konduit/codec/json/codecs";
import { PositiveBigInt } from "@konduit/codec/integers/big";
import type { Milliseconds } from "../time/duration";
import { ChannelTag } from "../channel/core";
import { ConsumerVKey } from "../channel/l1Channel";
import { AdaptorVKey } from "../adaptor/adaptorInfo";

export const enableLogs = (level: wasm.LogLevel): void => {
  wasm.enableLogs(level);
};

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
    const possibleConnector = await stringifyAsyncThrowable(() => wasm.CardanoConnector.new(backendUrl, httpTimeout));
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
    consumer: ConsumerVKey,
    adaptor: AdaptorVKey,
    closePeriod: Milliseconds,
    amount: Lovelace,
  ): Promise<Result<wasm.TransactionReadyForSigning, string>> {
    try {
      const tx = await wasm.open(
        this.connector,
        tag as Uint8Array,
        consumer.getKey(),
        adaptor.getKey(),
        BigInt(closePeriod),
        amount,
      );
      return ok(tx);
    } catch (error) {
      return err(error);
    }
  };

  async buildCloseTx(
    tag: ChannelTag,
    consumer: ConsumerVKey,
  ): Promise<Result<wasm.TransactionReadyForSigning, string>> {
    return stringifyAsyncThrowable(async () => await wasm.close(
      this.connector,
      tag,
      consumer.getKey()
    ));
  }

  // Wallet API:
  async signAndSubmit(
    transaction: wasm.TransactionReadyForSigning,
    sKey: SKey,
  ): Promise<Result<TxHash, string>> {
    const keyScalar: Ed25519PrvScalar = extractPrvScalar(sKey.getKey());
    const possibleTxHashBytes = await stringifyAsyncThrowable(async () => this.connector.signAndSubmit(transaction, keyScalar));
    return possibleTxHashBytes.andThen(
      (txHashBytes) => TxHash.fromBytes(txHashBytes),
    );
  }

  async balance(vkey: VKey): Promise<Result<Lovelace, JsonError>> {
    const result = await stringifyAsyncThrowable(async () => {
       return await this.connector.balance(vkey.getKey());
    });
    return result.andThen((balance: bigint) => {
      return Lovelace.fromBigInt(balance);
    });
  }
}
