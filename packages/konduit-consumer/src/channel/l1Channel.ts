import type { Tagged } from "type-fest";
import type { Result } from "neverthrow";
import { VKey } from "@konduit/cardano-keys";
import { TxCbor, TxHash } from "../cardano/tx";
import { POSIXSeconds, ValidDate } from "../time/absolute";
import { ChannelTag } from "./core";
import { AdaptorVKey } from "../adaptorClient/adaptorInfo";
import { Milliseconds, Seconds } from "../time/duration";
import { Lovelace } from "../cardano";

export type TxBase = {
  // Useful for debugging
  txCbor: TxCbor | null;
  txHash: TxHash;
};

export type OpenTx = TxBase & {
  tag: ChannelTag;
  type: "OpenTx";
  consumer: VKey;
  adaptor: AdaptorVKey;
  closePeriod: Milliseconds;
  amount: Lovelace;
  submitted: ValidDate | null;
};

export type AddTx = TxBase & {
  type: "AddTx";
  amount: Lovelace;
  submitted: ValidDate | null;
};

export type SubTx = TxBase & {
  type: "SubTx";
  amount: Lovelace;
  blockSlotTime: ValidDate;
};

export type CloseTx = TxBase & {
  type: "CloseTx";
  submitted: ValidDate | null;
};

export type TxBuilder = {
  buildOpenTx: (
    tag: ChannelTag,
    consumer: ConsumerVKey,
    adaptor: AdaptorVKey,
    closePeriod: Milliseconds,
    amount: Lovelace,
  ) => Promise<Result<TxCbor, string>>;

  buildAddTx: (
    tag: ChannelTag,
    amount: Lovelace,
  ) => Promise<Result<TxCbor, string>>;

  buildCloseTx: (
    tag: ChannelTag,
    consumer: ConsumerVKey,
  ) => Promise<Result<TxCbor, string>>;
};

export type IntermediateTx = AddTx | SubTx;

export type ConsumerTx = OpenTx | AddTx | CloseTx;

export type AnyChannelTx = OpenTx | AddTx | SubTx | CloseTx;

const txCreationTime = (tx: AnyChannelTx): ValidDate => {
  if (tx.type == "OpenTx" || tx.type == "AddTx" || tx.type == "CloseTx") {
    return tx.submitted!;
  }
  return tx.blockSlotTime;
}

const isTxVolatile = (tx: AnyChannelTx, txVolatilityTreshold: TxVolatilityThreshold): boolean => {
  const created = txCreationTime(tx);
  let now = POSIXSeconds.now();
  let submittedTime = POSIXSeconds.fromValidDate(created);
  let elapsed = now - submittedTime;
  return elapsed < txVolatilityTreshold;
}

export type TxVolatilityThreshold = Tagged<Seconds, "TxVolatilityThreshold">;

export type ConsumerVKey = Tagged<VKey, "ConsumerVKey">;

export class L1Channel {
  public readonly volatilityTreshold: TxVolatilityThreshold;
  private _openTx: OpenTx;
  private _intermediateTxs: IntermediateTx[] = [];
  private _closeTx: CloseTx | null;

  private constructor(
    openTx: OpenTx,
    intermediateTxs: IntermediateTx[] = [],
    closeTx: CloseTx | null = null,
    // txs: AnyChannelTx[],
    volatilityTreshold: TxVolatilityThreshold,
  ) {
    this._openTx = openTx;
    this._intermediateTxs = intermediateTxs;
    this._closeTx = closeTx;
    this.volatilityTreshold = volatilityTreshold;
  }

  public static create(
    openTx: OpenTx,
    volatilityTreshold: TxVolatilityThreshold = Seconds.fromDigits(5) as TxVolatilityThreshold,
  ) {
    return new L1Channel(
      openTx,
      [],
      null,
      volatilityTreshold,
    );
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

  get txs (): AnyChannelTx[] {
    let txs: AnyChannelTx[] = [this._openTx];
    txs = txs.concat(this._intermediateTxs);
    if (this._closeTx != null) {
      txs.push(this._closeTx);
    }
    return txs;
  }

  get volatileTxs (): ConsumerTx[] {
    return this.txs.filter(tx => isTxVolatile(tx, this.volatilityTreshold)) as ConsumerTx[];
  }

  get unconfirmedTxs (): ConsumerTx[] {
    return this.txs.filter(tx => isTxVolatile(tx, this.volatilityTreshold)) as ConsumerTx[];
  }

  get unsubmittedTxs (): ConsumerTx[] {
    return this.txs.filter(tx => txCreationTime(tx) == null) as ConsumerTx[];
  }

}
