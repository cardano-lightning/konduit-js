import type { Tagged } from "type-fest";
import type { Result } from "neverthrow";
import { VKey } from "@konduit/cardano-keys";
import { TxCbor, TxHash } from "../cardano/tx";
import { POSIXSeconds, ValidDate } from "../time/absolute";
import { ChannelTag } from "./core";
import { AdaptorVKey } from "../adaptor/adaptorInfo";
import { Milliseconds, Seconds } from "../time/duration";
import { Lovelace } from "../cardano";

export type TxBase = {
  // Useful for debugging
  txCbor: TxCbor;
  txHash: TxHash;
  submitted: ValidDate | null;
};

export type OpenTx = TxBase & {
  tag: ChannelTag;
  type: "OpenTx";
  consumer: VKey;
  adaptor: AdaptorVKey;
  closePeriod: Milliseconds;
  amount: Lovelace;
};

export type CloseTx = TxBase & {
  type: "CloseTx";
};

export type TxBuilder = {
  buildOpenTx: (
    tag: ChannelTag,
    consumer: ConsumerVKey,
    adaptor: AdaptorVKey,
    closePeriod: Milliseconds,
    amount: Lovelace,
  ) => Promise<Result<TxCbor, string>>;

  buildCloseTx: (
    tag: ChannelTag,
    consumer: ConsumerVKey,
  ) => Promise<Result<TxCbor, string>>;
};


export type ChannelTx = OpenTx | CloseTx;

const isTxVolatile = (tx: ChannelTx, txVolatilityTreshold: TxVolatilityThreshold, closeVolatilityTreshold: CloseVolatilityThreshold): boolean => {
  if (tx.submitted == null) {
    return true;
  }
  let now = POSIXSeconds.now();
  let submittedTime = POSIXSeconds.fromValidDate(tx.submitted);
  let elapsed = now - submittedTime;
  if (tx.type == "CloseTx") {
    return elapsed < closeVolatilityTreshold;
  } else {
    return elapsed < txVolatilityTreshold;
  }
}

export type TxVolatilityThreshold = Tagged<Seconds, "TxVolatilityThreshold">;

export type CloseVolatilityThreshold = Tagged<TxVolatilityThreshold, "CloseVolatilityThreshold">;

export type ConsumerVKey = Tagged<VKey, "ConsumerVKey">;

export class L1Channel {
  public readonly volatilityTreshold: TxVolatilityThreshold;
  public readonly closeVolatilityThreshold: CloseVolatilityThreshold;
  private _txs: ChannelTx[];

  constructor(
    txs: ChannelTx[],
    volatilityTreshold: TxVolatilityThreshold,
    closeVolatilityThreshold: CloseVolatilityThreshold,
  ) {
    this._txs = txs;
    this.volatilityTreshold = volatilityTreshold;
    this.closeVolatilityThreshold = closeVolatilityThreshold;
  }

  // public static open(
  //   connector: L1Channel,
  //   tag: ChannelTag;
  //   // consumer: VKey;
  //   // adaptor: AdaptorVKey;
  //   // adaptorUrl: AdaptorUrl;
  //   // closePeriod: number;
  //   // amount: number;
  //   

  get txs () { return this._txs; }

  get volatileTxs () {
    return this._txs.filter(tx => isTxVolatile(tx, this.volatilityTreshold, this.closeVolatilityThreshold));
  }

  get confirmedTxs () {
    return this._txs.filter(tx => !isTxVolatile(tx, this.volatilityTreshold, this.closeVolatilityThreshold));
  }

  get unsubmittedTxs () {
    return this._txs.filter(tx => tx.submitted == null);
  }

  get isFullyConfirmed () {
    return this.volatileTxs.length === 0;
  }

  get isFullySubmitted () {
    return this.txs.every(tx => tx.submitted != null);
  }
}
