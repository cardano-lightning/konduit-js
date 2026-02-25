import type { Tagged } from "type-fest";
import { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { json2TxHashCodec, TxCborBytes, TxHash, unsafeTxCborBytes } from "../cardano/tx";
import { ValidDate } from "../time/absolute";
import { ChannelTag, json2ChannelTagCodec } from "./core";
import type { AdaptorEd25519VerificationKey } from "../adaptorClient/adaptorInfo";
import { json2AdaptorEd25519VerificationKeyCodec } from "../adaptorClient/adaptorInfo";
import { Milliseconds } from "../time/duration";
import { Lovelace } from "../cardano";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import * as codec from "@konduit/codec";
import * as uint8Array from "@konduit/codec/uint8Array";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2Ed25519VerificationKeyCodec } from "../cardano/keys";
import { json2MillisecondsCodec } from "../time/duration";
import { json2LovelaceCodec } from "../cardano";
import { json2ValidDateCodec } from "../time/absolute";
import type { BlockNo, TxOutRef } from "../cardano/ledger";
import { json2BlockNoCodec, json2TxOutRefCodec } from "../cardano/ledger";
import { NonNegativeBigInt } from "@konduit/codec/integers/big";
import type { ZeroToNine } from "@konduit/codec/integers/smallish";
import { unwrapOrPanic } from "../neverthrow";

export type TxBase = {
  txCbor: TxCborBytes | null;
  txHash: TxHash;
};

export type OpenTx = TxBase & {
  adaptor: AdaptorEd25519VerificationKey;
  adaptorApproved: boolean;
  amount: Lovelace;
  created: ValidDate;
  closePeriod: Milliseconds;
  consumer: Ed25519VerificationKey;
  lastSubmitted: ValidDate | null;
  tag: ChannelTag;
  type: "OpenTx";
};

export const json2OpenTxCodec: JsonCodec<OpenTx> = codec.rmap(
  jsonCodecs.objectOf({
    adaptor: json2AdaptorEd25519VerificationKeyCodec,
    amount: json2LovelaceCodec,
    channel_tag: json2ChannelTagCodec,
    close_period: json2MillisecondsCodec,
    consumer: json2Ed25519VerificationKeyCodec,
    last_submitted: jsonCodecs.nullable(json2ValidDateCodec),
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: json2TxHashCodec,
    type: jsonCodecs.constant("OpenTx" as const),
  }),
  (r) => {
    return {
      adaptor: r.adaptor,
      amount: r.amount,
      closePeriod: r.close_period,
      consumer: r.consumer,
      lastSubmitted: r.last_submitted,
      tag: r.channel_tag,
      txCbor: r.tx_cbor,
      txHash: r.tx_hash,
      type: "OpenTx",
    } as OpenTx;
  },
  (openTx: OpenTx) => {
    return {
      adaptor: openTx.adaptor,
      amount: openTx.amount,
      channel_tag: openTx.tag,
      close_period: openTx.closePeriod,
      consumer: openTx.consumer,
      last_submitted: openTx.lastSubmitted,
      tx_cbor: openTx.txCbor,
      tx_hash: openTx.txHash,
      type: "OpenTx" as const,
    };
  },
);

export type AddTx = TxBase & {
  type: "AddTx";
  adaptorApproved: boolean;
  amount: Lovelace;
  lastSubmitted: ValidDate | null;
};

export const isAddTx = (tx: ConsumerTx): tx is AddTx => {
  return tx.type === "AddTx";
}

export const json2AddTxCodec: JsonCodec<AddTx> = codec.rmap(
  jsonCodecs.objectOf({
    amount: json2LovelaceCodec,
    last_submitted: jsonCodecs.nullable(json2ValidDateCodec),
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: json2TxHashCodec,
    type: jsonCodecs.constant("AddTx" as const),
  }),
  (r) => {
    return {
      amount: r.amount,
      lastSubmitted: r.last_submitted,
      txCbor: r.tx_cbor,
      txHash: r.tx_hash,
      type: "AddTx",
    } as AddTx;
  },
  (addTx: AddTx) => {
    return {
      amount: addTx.amount,
      last_submitted: addTx.lastSubmitted,
      tx_block_no: jsonCodecs.nullable(json2BlockNoCodec),
      tx_cbor: addTx.txCbor,
      tx_hash: addTx.txHash,
      type: "AddTx" as const,
    };
  },
);

// Used only for presentation. We do not store any extra info with it.
// We can deduce the amount from the difference in the locked channel
// funds.
export type SubTx = TxBase & {
  type: "SubTx";
  amount: Lovelace;
};

export type CloseTx = TxBase & {
  adaptorApproved: boolean;
  type: "CloseTx";
  lastSubmitted: ValidDate | null;
};

export const json2CloseTxCodec: JsonCodec<CloseTx> = codec.rmap(
  jsonCodecs.objectOf({
    last_submitted: jsonCodecs.nullable(json2ValidDateCodec),
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: json2TxHashCodec,
    type: jsonCodecs.constant("CloseTx" as const),
  }),
  (r) => {
    return {
      lastSubmitted: r.last_submitted,
      txCbor: r.tx_cbor,
      txHash: r.tx_hash,
      type: "CloseTx",
    } as CloseTx;
  },
  (closeTx: CloseTx) => {
    return {
      last_submitted: closeTx.lastSubmitted,
      tx_cbor: closeTx.txCbor,
      tx_hash: closeTx.txHash,
      type: "CloseTx" as const,
    };
  },
);

export type ConsumerTx = OpenTx | AddTx | CloseTx;

export const json2ConsumerTxCodec: JsonCodec<ConsumerTx> = jsonCodecs.altJsonCodecs(
  [json2OpenTxCodec, json2AddTxCodec, json2CloseTxCodec],
  (serOpen, serAdd, serClose) => (tx: ConsumerTx) => {
    switch (tx.type) {
      case "OpenTx":
        return serOpen(tx);
      case "AddTx":
        return serAdd(tx);
      case "CloseTx":
        return serClose(tx);
    }
  },
);

export type TxVolatilityThreshold = Tagged<NonNegativeBigInt, "BlockDepth">;
export namespace TxVolatilityThreshold {
  // Setting up larger thresholds then 2160 makes little sense.
  export const fromDigits = (n0: 0 | 1 | 2, n1?: ZeroToNine, n2?: ZeroToNine, n3?: ZeroToNine): TxVolatilityThreshold => {
    return NonNegativeBigInt.fromDigits(n0, n1, n2, n3) as TxVolatilityThreshold;
  }
}
const json2TxVolatilityThresholdCodec: JsonCodec<TxVolatilityThreshold> = codec.rmap(
  jsonCodecs.json2BigIntCodec,
  (bigInt) => bigInt as TxVolatilityThreshold,
  (threshold) => threshold
);

export type ConsumerEd25519VerificationKey = Tagged<Ed25519VerificationKey, "ConsumerEd25519VerificationKey">;

// This structure together with the current tip/timestamp
// could give as an outlook on the tx confirmation progress.
export type ChannelTxOut = {
  txOutRef: TxOutRef;
  blockNo: BlockNo;
  blockTimestamp: ValidDate;
};

export const json2ChannelTxOutCodec: JsonCodec<ChannelTxOut> = codec.rmap(
  jsonCodecs.objectOf({
    tx_out_ref: json2TxOutRefCodec,
    block_no: json2BlockNoCodec,
    block_timestamp: json2ValidDateCodec,
  }),
  (r) => {
    return {
      txOutRef: r.tx_out_ref,
      blockNo: r.block_no,
      blockTimestamp: r.block_timestamp,
    } as ChannelTxOut;
  },
  (txOut: ChannelTxOut) => {
    return {
      tx_out_ref: txOut.txOutRef,
      block_no: txOut.blockNo,
      block_timestamp: txOut.blockTimestamp,
    };
  },
);

// Invariants which should be preserved:
// - First transaction is always OpenTx.
// - Subsequent opennings should preserve the original openning params.
// - The logical order of non-failed transactions should be preserved.
// TODO:
// * Implement operations which preserve and check these invariants.
// * Implement smart constructors.
export type ConsumerTxHistory = Tagged<ConsumerTx[], "ConsumerTxHistory">;
export namespace ConsumerTxHistory {
  export const unafeFromArray = (txs: ConsumerTx[]): ConsumerTxHistory => {
    return txs as ConsumerTxHistory;
  }
  export const clone = (history: ConsumerTxHistory): ConsumerTxHistory => {
    return Array.from(history) as ConsumerTxHistory;
  }
}

export class L1Channel {
  public readonly volatilityTreshold: TxVolatilityThreshold;
  // TODO: This is a stub which is not synced with the actual chain
  // but helps to model a realistic tx re-submission and confirmation
  // flow.
  private _onChainThread: ChannelTxOut[] = [];

  // Full history of consumer created transactions, including unsubmitted and unconfirmed ones.
  private _txHistory: ConsumerTxHistory;

  constructor(
    txHistory: ConsumerTxHistory,
    onChainThread: ChannelTxOut[] = [],
    volatilityTreshold: TxVolatilityThreshold,
  ) {
    this._txHistory = txHistory;
    this._onChainThread = onChainThread;
    this.volatilityTreshold = volatilityTreshold;
  }

  public static open(
    openTx: OpenTx,
    onChainThread: ChannelTxOut[] = [],
    volatilityTreshold: TxVolatilityThreshold = TxVolatilityThreshold.fromDigits(2, 1, 6, 0)
  ) {
    let txHistory = ConsumerTxHistory.unafeFromArray([openTx]);
    return new L1Channel(
      txHistory,
      onChainThread,
      volatilityTreshold,
    );
  }

  public get txHistory(): ConsumerTxHistory {
    return ConsumerTxHistory.clone(this._txHistory);
  }

  public get onChainThread(): ChannelTxOut[] {
    return Array.from(this._onChainThread);
  }

  get openTx(): OpenTx {
    return this._txHistory.slice().reverse().find((tx): tx is OpenTx => tx.type === "OpenTx")!;
  }

  get consumerVerificationKey(): ConsumerEd25519VerificationKey {
    return this.openTx.consumer as ConsumerEd25519VerificationKey;
  }

  get channelTag(): ChannelTag {
    return this.openTx.tag;
  }

  get totalChannelFunds(): Lovelace {
    const total:bigint = this._txHistory.slice(1).reduce(
      (acc, tx) => {
        if(isAddTx(tx)) return (acc + tx.amount as bigint);
        return acc;
      },
      this.openTx.amount as bigint,
    );
    return unwrapOrPanic(
      Lovelace.fromBigInt(total),
      "Panic: total channel funds are negative or exceed total Lovelace supply"
    );
  }
}

  // get unsubmittedTxs (): ConsumerTx[] {
  //   return this.txs.filter(tx => tx.txHash == null) as ConsumerTx[];
  // }
  // get submittedButUnindexed (): ConsumerTx[] {
  //   return this.txs.filter(tx => tx.txHash != null && tx.txBlockNo == null) as ConsumerTx[];
  // }

export const json2L1ChannelCodec: JsonCodec<L1Channel> = (() => {
  const json2L1ChannelRecordCodec = jsonCodecs.objectOf({
    on_chain_thread: jsonCodecs.arrayOf(json2ChannelTxOutCodec),
    tx_history: jsonCodecs.arrayOf(json2ConsumerTxCodec),
    volatility_treshold: json2TxVolatilityThresholdCodec,
  });

  return codec.rmap(
    json2L1ChannelRecordCodec,
    (r) => {
      return new L1Channel(
        ConsumerTxHistory.unafeFromArray(r.tx_history),
        r.on_chain_thread,
        r.volatility_treshold,
      );
    },
    (channel: L1Channel) => {
      return {
        on_chain_thread: channel.onChainThread,
        tx_history: channel.txHistory,
        volatility_treshold: channel.volatilityTreshold,
      };
    }
  );
})();

