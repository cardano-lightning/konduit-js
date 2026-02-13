import { ok, Result } from "neverthrow";
import type { Tagged } from "type-fest";
import { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { json2TxHashCodec, TxCborBytes, TxHash, unsafeTxCborBytes } from "../cardano/tx";
import { ValidDate } from "../time/absolute";
import { ChannelTag, json2ChannelTagCodec } from "./core";
import { AdaptorEd25519VerificationKey, json2AdaptorEd25519VerificationKeyCodec } from "../adaptorClient/adaptorInfo";
import { Milliseconds } from "../time/duration";
import { Lovelace } from "../cardano";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import * as codec from "@konduit/codec";
import * as uint8Array from "@konduit/codec/uint8Array";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2Ed25519VerificationKeyCodec } from "../cardano/keys";
import { json2MillisecondsCodec } from "../time/duration";
import { json2LovelaceCodec } from "../cardano";
import { json2ValidDateCodec } from "../time/absolute";
import { BlockNo, json2BlockNoCodec } from "../cardano/ledger";
import { NonNegativeBigInt } from "@konduit/codec/integers/big";
import { ZeroToNine } from "@konduit/codec/integers/smallish";
import { unwrapOrPanic } from "../neverthrow";

export type TxBase = {
  txBlockNo: BlockNo | null;
  txCbor: TxCborBytes | null;
  txHash: TxHash;
};

export type OpenTx = TxBase & {
  adaptor: AdaptorEd25519VerificationKey;
  adaptorApproved: boolean;
  amount: Lovelace;
  closePeriod: Milliseconds;
  consumer: Ed25519VerificationKey;
  submitted: ValidDate;
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
    submitted: jsonCodecs.nullable(json2ValidDateCodec),
    tx_block_no: jsonCodecs.nullable(json2BlockNoCodec),
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
      submitted: r.submitted,
      tag: r.channel_tag,
      txBlockNo: r.tx_block_no,
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
      submitted: openTx.submitted,
      tx_block_no: openTx.txBlockNo,
      tx_cbor: openTx.txCbor,
      tx_hash: openTx.txHash,
    };
  },
);

export type AddTx = TxBase & {
  type: "AddTx";
  adaptorApproved: boolean;
  amount: Lovelace;
  submitted: ValidDate | null;
};

export type SubTx = TxBase & {
  type: "SubTx";
  amount: Lovelace;
  blockSlotTime: ValidDate;
};

export type CloseTx = TxBase & {
  adaptorApproved: boolean;
  type: "CloseTx";
  submitted: ValidDate | null;
};

export const json2AddTxCodec: JsonCodec<AddTx> = codec.rmap(
  jsonCodecs.objectOf({
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: json2TxHashCodec,
    type: jsonCodecs.constant("AddTx" as const),
    amount: json2LovelaceCodec,
    submitted: jsonCodecs.nullable(json2ValidDateCodec),
  }),
  (r) => {
    return {
      type: "AddTx",
      txCbor: r.tx_cbor,
      txHash: r.tx_hash,
      amount: r.amount,
      submitted: r.submitted,
    } as AddTx;
  },
  (addTx: AddTx) => {
    return {
      tx_block_no: jsonCodecs.nullable(json2BlockNoCodec),
      tx_cbor: addTx.txCbor,
      tx_hash: addTx.txHash,
      type: "AddTx" as const,
      amount: addTx.amount,
      submitted: addTx.submitted,
    };
  },
);

export const json2SubTxCodec: JsonCodec<SubTx> = codec.rmap(
  jsonCodecs.objectOf({
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: json2TxHashCodec,
    type: jsonCodecs.constant("SubTx" as const),
    amount: json2LovelaceCodec,
    block_slot_time: json2ValidDateCodec,
  }),
  (r) => {
    return {
      type: "SubTx",
      txCbor: r.tx_cbor,
      txHash: r.tx_hash,
      amount: r.amount,
      blockSlotTime: r.block_slot_time,
    } as SubTx;
  },
  (subTx: SubTx) => {
    return {
      tx_cbor: subTx.txCbor,
      tx_hash: subTx.txHash,
      type: "SubTx" as const,
      amount: subTx.amount,
      block_slot_time: subTx.blockSlotTime,
    };
  },
);

export const json2CloseTxCodec: JsonCodec<CloseTx> = codec.rmap(
  jsonCodecs.objectOf({
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: json2TxHashCodec,
    type: jsonCodecs.constant("CloseTx" as const),
    submitted: jsonCodecs.nullable(json2ValidDateCodec),
  }),
  (r) => {
    return {
      type: "CloseTx",
      txCbor: r.tx_cbor,
      txHash: r.tx_hash,
      submitted: r.submitted,
    } as CloseTx;
  },
  (closeTx: CloseTx) => {
    return {
      tx_cbor: closeTx.txCbor,
      tx_hash: closeTx.txHash,
      type: "CloseTx" as const,
      submitted: closeTx.submitted,
    };
  },
);

export type IntermediateTx = AddTx | SubTx;

export type ConsumerTx = OpenTx | AddTx | CloseTx;

export type AnyChannelTx = OpenTx | AddTx | SubTx | CloseTx;

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


export const json2L1ChannelCodec: JsonCodec<L1Channel> = (() => {
  const json2IntermediateTxCodec: JsonCodec<IntermediateTx> = jsonCodecs.altJsonCodecs(
    [json2AddTxCodec, json2SubTxCodec],
    (serAdd, serSub) => (tx: IntermediateTx) => {
      switch (tx.type) {
        case "AddTx":
          return serAdd(tx);
        case "SubTx":
          return serSub(tx);
      }
    },
  );

  const json2L1ChannelRecordCodec = jsonCodecs.objectOf({
    open_tx: json2OpenTxCodec,
    intermediate_txs: jsonCodecs.arrayOf(json2IntermediateTxCodec),
    close_tx: jsonCodecs.nullable(json2CloseTxCodec),
    volatility_treshold: json2TxVolatilityThresholdCodec,
  });

  return codec.rmap(
    json2L1ChannelRecordCodec,
    (r) => {
      return new L1Channel(
        r.open_tx,
        r.intermediate_txs,
        r.close_tx,
        r.volatility_treshold,
      );
    },
    (channel: L1Channel) => {
      return {
        open_tx: channel.openTx,
        intermediate_txs: channel.intermediateTxs,
        close_tx: channel.closeTx,
        volatility_treshold: channel.volatilityTreshold,
      };
    },
  );
})();

export type ConsumerEd25519VerificationKey = Tagged<Ed25519VerificationKey, "ConsumerEd25519VerificationKey">;

export class L1Channel {
  public readonly volatilityTreshold: TxVolatilityThreshold;
  private _openTx: OpenTx;
  private _intermediateTxs: IntermediateTx[] = [];
  private _closeTx: CloseTx | null;

  constructor(
    openTx: OpenTx,
    intermediateTxs: IntermediateTx[] = [],
    closeTx: CloseTx | null = null,
    volatilityTreshold: TxVolatilityThreshold,
  ) {
    this._openTx = openTx;
    this._intermediateTxs = intermediateTxs;
    this._closeTx = closeTx;
    this.volatilityTreshold = volatilityTreshold;
  }

  public static create(
    openTx: OpenTx,
    volatilityTreshold: TxVolatilityThreshold = TxVolatilityThreshold.fromDigits(2, 1, 6, 0)
  ) {
    return new L1Channel(
      openTx,
      [],
      null,
      volatilityTreshold,
    );
  }

  get isClosed(): boolean {
    return this._closeTx != null;
  }

  getTotalChannelFunds(adaptorApprovedOnly: boolean = true): Lovelace {
    const result = (() => {
      let go = (acc: Lovelace, txs: IntermediateTx[]): Result<Lovelace, JsonError> => {
        if (txs.length === 0) {
          return ok(acc);
        } else {
          const [tx, ...rest] = txs;
          switch (tx.type) {
            case "AddTx":
              if(adaptorApprovedOnly && !tx.adaptorApproved) {
                return go(acc, rest);
              }
              return Lovelace.add(acc, tx.amount).andThen((newAcc) => go(newAcc, rest));
            default:
              return go(acc, rest);
          }
        }
      };
      return go(this.openTx.amount, this._intermediateTxs);
    })();
    return unwrapOrPanic(result, "Invalid channel state - getFunds computation failed)");
  }

  get consumerVerificationKey(): ConsumerEd25519VerificationKey {
    return this.openTx.consumer as ConsumerEd25519VerificationKey;
  }

  get channelTag(): ChannelTag {
    return this.openTx.tag;
  }

  get openTx(): OpenTx {
    return this._openTx;
  }

  get closeTx(): CloseTx | null {
    return this._closeTx;
  }

  get intermediateTxs(): IntermediateTx[] {
    return Array.from(this._intermediateTxs);
  }

  get txs (): AnyChannelTx[] {
    let txs: AnyChannelTx[] = [this._openTx];
    txs = txs.concat(this._intermediateTxs);
    if (this._closeTx != null) {
      txs.push(this._closeTx);
    }
    return txs;
  }

  get unsubmittedTxs (): ConsumerTx[] {
    return this.txs.filter(tx => tx.txHash == null) as ConsumerTx[];
  }

  get submittedButUnindexed (): ConsumerTx[] {
    return this.txs.filter(tx => tx.txHash != null && tx.txBlockNo == null) as ConsumerTx[];
  }
}
