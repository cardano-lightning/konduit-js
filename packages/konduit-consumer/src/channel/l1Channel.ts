import type { Tagged } from "type-fest";
import { type Result } from "neverthrow";
import { Ed25519VerificationKey } from "@konduit/cardano-keys";
import { TxCborBytes, TxHash, TxOut, unsafeTxCborBytes } from "../cardano/tx";
import { POSIXMilliseconds, ValidDate } from "../time/absolute";
import { ChannelTag, json2ChannelTagCodec } from "./core";
import type { AdaptorEd25519VerificationKey } from "../adaptorClient/adaptorInfo";
import { json2AdaptorEd25519VerificationKeyCodec } from "../adaptorClient/adaptorInfo";
import { Days, Hours, Milliseconds, Minutes, Seconds } from "../time/duration";
import { Lovelace } from "../cardano";
import type { JsonCodec } from "@konduit/codec/json/codecs";
import * as codec from "@konduit/codec";
import * as uint8Array from "@konduit/codec/uint8Array";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { json2Ed25519VerificationKeyCodec } from "../cardano/keys";
import { json2MillisecondsCodec } from "../time/duration";
import { json2ValidDateCodec } from "../time/absolute";
import type { BlockNo, TxIx, TxOutRef } from "../cardano/ledger";
import { json2BlockNoCodec, json2TxOutRefCodec } from "../cardano/ledger";
import { NonNegativeBigInt } from "@konduit/codec/integers/big";
import type { ZeroToNine } from "@konduit/codec/integers/smallish";
import { unwrapOrPanic } from "../neverthrow";
import { mkJson2PollingInfoCodec, PollingInfo } from "../polling";


// We use four categories of tx maturity to optimize a bit the syncing
// strategy and not overhelm the backend.
//
// In order to avoid querying the backend for the current tip we
// express the thresholds in terms of time duration.
// We do not have to be crazy precise here as we do the re-sync
// at some point anyway.
export type TxAge = Milliseconds;

// All together we have 4 thresholds on the chain
// * form 0 to highly - "HighlyVolatile"
// * from highly to volatile - "Volatile"
// * from volatile to volatility threshold - "BarelyVolatile"
// * above volatility threshold - "NonVolatile"
export type ThresholdsSpec = Tagged<{
  HighlyVolatileLimit: TxAge;
  VolatileLimit: TxAge;
  VoalatilityLimit: TxAge;
}, "ThresholdsSpec">;

export namespace ThresholdsSpec {
  export const fromLimits = (
    highlyVolatileLimit: Minutes,
    volatileLimit: Minutes,
    volatilityLimit: Days,
  ): ThresholdsSpec => {
    return {
      HighlyVolatileLimit: Milliseconds.fromSeconds(Seconds.fromMinutes(highlyVolatileLimit)),
      VolatileLimit: Milliseconds.fromSeconds(Seconds.fromMinutes(volatileLimit)),
      VoalatilityLimit: Milliseconds.fromSeconds(
        Seconds.fromMinutes(
          Minutes.fromHours(
            Hours.fromDays(volatilityLimit)
          )
        )
      ),
    } as ThresholdsSpec;
  }
}

export type TxMaturity = "OffChain" | "HighlyVolatile" | "Volatile" | "BarelyVolatile" | "NonVolatile";
export namespace TxMaturity {
  export const OFFCHAIN = "OffChain" as TxMaturity;
  export const fromTimestamps = (
    syncingTime: POSIXMilliseconds,
    txBlockTimestamp: POSIXMilliseconds | null,
    thresholdsSpec: ThresholdsSpec,
  ): TxMaturity => {
    if (txBlockTimestamp == null) return "OffChain";
    const age = Milliseconds.fromDiffTime(syncingTime, txBlockTimestamp);
    if (Milliseconds.ord.isLessThan(age, thresholdsSpec.HighlyVolatileLimit)) return "HighlyVolatile";
    if (Milliseconds.ord.isLessThan(age, thresholdsSpec.VolatileLimit)) return "Volatile";
    if (Milliseconds.ord.isLessThan(age, thresholdsSpec.VoalatilityLimit)) return "BarelyVolatile";
    return "NonVolatile";
  }
}

export type SyncingFrequency = Milliseconds;

// At a given point in time we want to decide whether
// to sync a channel thread or not. It is enough to
// judge the thread based on the head(s) of the transaction
// queues.
export type TxSyncingSpec = {
  "OffChain": SyncingFrequency;
  "HighlyVolatile": SyncingFrequency;
  "Volatile": SyncingFrequency;
  "BarelyVolatile": SyncingFrequency;
  // "NonVolatile" tx's are not synced at all.
};
export namespace TxSyncingSpec {
  export const fromFrequencies = (
    offChain: Seconds,
    highlyVolatile: Minutes,
    volatile: Minutes,
    barelyVolatile: Hours,
  ): TxSyncingSpec => {
    return {
      "OffChain": Milliseconds.fromSeconds(offChain),
      "HighlyVolatile": Milliseconds.fromSeconds(Seconds.fromMinutes(highlyVolatile)),
      "Volatile": Milliseconds.fromSeconds(Seconds.fromMinutes(volatile)),
      "BarelyVolatile": Milliseconds.fromSeconds(Seconds.fromMinutes(Minutes.fromHours(barelyVolatile))),
    } as TxSyncingSpec;
  }
  export const shouldTxBeSynced = (
    now: POSIXMilliseconds,
    lastSync: POSIXMilliseconds | null,
    maturity: TxMaturity,
    syncingSpec: TxSyncingSpec
  ): boolean => {
    if (maturity === "NonVolatile") return false;
    const frequency = syncingSpec[maturity];
    if (lastSync == null) return true;
    const timeSinceLastSync = Milliseconds.fromDiffTime(now, lastSync);
    return Milliseconds.ord.isGreaterThanOrEqual(timeSinceLastSync, frequency);
  }
}

export type TxBase = {
  txCbor: TxCborBytes | null;
  txHash: TxHash;
  txIx: TxIx;
};

export namespace TxBase {
  // FIXME: This is just a stub!
  export const hasExpired = (_tx: TxBase) => {
    return false;
  }

  export const getChannelOutputRef = (tx: TxBase) => {
    return { txId: tx.txHash, txIx: tx.txIx } as TxOutRef;
  }
}

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
    amount: Lovelace.jsonCodec,
    channel_tag: json2ChannelTagCodec,
    close_period: json2MillisecondsCodec,
    consumer: json2Ed25519VerificationKeyCodec,
    last_submitted: jsonCodecs.nullable(json2ValidDateCodec),
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: TxHash.jsonCodec,
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
    amount: Lovelace.jsonCodec,
    last_submitted: jsonCodecs.nullable(json2ValidDateCodec),
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: TxHash.jsonCodec,
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
  type: "CloseTx";
  lastSubmitted: ValidDate | null;
};

export const json2CloseTxCodec: JsonCodec<CloseTx> = codec.rmap(
  jsonCodecs.objectOf({
    last_submitted: jsonCodecs.nullable(json2ValidDateCodec),
    tx_cbor: jsonCodecs.nullable(codec.rmap(uint8Array.jsonCodec, unsafeTxCborBytes, (bytes) => bytes)),
    tx_hash: TxHash.jsonCodec,
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

export type AnyChannelTx = ConsumerTx | SubTx;

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

export type TxVoalatilityLimit = Tagged<NonNegativeBigInt, "BlockDepth">;
export namespace TxVoalatilityLimit {
  // Setting up larger thresholds then 2160 makes little sense.
  export const fromDigits = (n0: 0 | 1 | 2, n1?: ZeroToNine, n2?: ZeroToNine, n3?: ZeroToNine): TxVoalatilityLimit => {
    return NonNegativeBigInt.fromDigits(n0, n1, n2, n3) as TxVoalatilityLimit;
  }
}

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

// Tx history contains all the transaction including the ones
// which were not successfully submitted or were rolled back.
// This is required to handle nicely re-openings etc.
//
// Invariants which should be preserved:
// - First transaction is always OpenTx.
// - Subsequent opennings should preserve the original openning params.
// - The logical order of non-failed transactions should be preserved.
//
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

export type UtxoState =
  | "NotFound"
  | "Unspent"
  | { spendingTransaction: TxHash; outputs: TxOut }

export type GetUtxoState = (txOutRef: TxOutRef) => Promise<Result<UtxoState, string>>;

export class L1Channel {
  private readonly TX_MATURITY_THRESHOLD_SPEC = ThresholdsSpec.fromLimits(
    // below: highly-volatile
    Minutes.fromDigits(3),
    // below: volatile
    Minutes.fromDigits(1, 5),
    // below: barely-volatile, above: non-volatile
    // When tx is non-volatile we do not enforce syncing at all.
    // On the channel level we will have additional threshold
    // which will enforce syncing anyway to sync other party
    // activity.
    Days.fromDigits(3), // barely-volatile - above that we do not enforce
                        // resyncing based on the tx itself. We w
  );

  private readonly SYNCING_FREQUENCY_SPEC: TxSyncingSpec = TxSyncingSpec.fromFrequencies(
    // In essence we request syncing of off-chain txs at every possible opportunity.
    Seconds.fromDigits(2, 0), // off-chain
    // after that we slow down gradually...
    Minutes.fromDigits(3), // highly-volatile
    Minutes.fromDigits(1, 5), // volatile
    Hours.fromDigits(3), // barely-volatile
  );

  // TODO: Switch to something like:
  // `ConsumerTxId` - then the tx is present in the history
  // `TxDetails` - for all the other transactions:
  // * submitted by adaptor
  // * submitted by consumer but from a different device
  private _onChainThread: PollingInfo<ChannelTxOut[]>;

  // Full history of consumer created transactions, including unsubmitted and unconfirmed ones.
  private _txHistory: ConsumerTxHistory;

  // FIXME: We should clone here
  public get onChainThread(): PollingInfo<ChannelTxOut[]> {
    return this._onChainThread;
  }

  // Return a UTxO which we should query
  // given the tx and syncing history and the predefined
  // sync frequency thresholds.
  public getChannelUtxoToQuery = (now: POSIXMilliseconds): TxOutRef | null => {
    const possibleUtxoWithMaturity = (
      (): { lastSyncedAt: ValidDate | null; maturity: TxMaturity; utxo: TxOutRef } | null => {

      const lastSuccessfulSync = this._onChainThread.lastSuccessfulFetch;
      // If we do not have any indexed transactions
      // let's try to see if there is submitted opening transction
      // which requires syncing.
      if(lastSuccessfulSync == null || lastSuccessfulSync.value.length == 0) {
        const submittedTxs = this._txHistory.filter(tx => tx.lastSubmitted != null);
        // No submitted txs so nothing to sync
        if(submittedTxs.length == 0)
          return null;
        const lastSubmittedTx = submittedTxs[submittedTxs.length - 1]!;
        // FIXME:
        // We should probably apply some threshold here. Maybe along those lines:
        // * Let's assume that the settlement happend at the edge of validity interval
        // * Let's assume that it happend on a fork which is different from the connector
        // which we are querying
        // * In such a case transaction could still show up at some point.
        // * The probability so the synchronization time should decrease probably
        // according to our `SYNCING_FREQUENCY_SPEC`
        // * Maybe that actual logic should be incorporated into the syncer itself
        // OR NOT:
        // * We can all the time fallback to null so the default
        // * syncing fallback will kick in eventually as well ;-)
        if(TxBase.hasExpired(lastSubmittedTx)) {
          return null;
        }
        return {
          lastSyncedAt: lastSuccessfulSync ? lastSuccessfulSync.fetchedAt : null,
          maturity: TxMaturity.OFFCHAIN,
          utxo: TxBase.getChannelOutputRef(lastSubmittedTx)
        }
      }
      const lastOnChainUTxo = lastSuccessfulSync.value[lastSuccessfulSync.value.length - 1]!;
      const maturity = TxMaturity.fromTimestamps(
        POSIXMilliseconds.fromValidDate(lastSuccessfulSync.fetchedAt),
        POSIXMilliseconds.fromValidDate(lastOnChainUTxo.blockTimestamp),
        this.TX_MATURITY_THRESHOLD_SPEC
      );
      return {
        lastSyncedAt: lastSuccessfulSync.fetchedAt,
        maturity,
        utxo: lastOnChainUTxo.txOutRef,
      };
    })();

    if(possibleUtxoWithMaturity == null) return null;
    const { lastSyncedAt, maturity, utxo } = possibleUtxoWithMaturity;
    const shouldSync = TxSyncingSpec.shouldTxBeSynced(
      now,
      lastSyncedAt?POSIXMilliseconds.fromValidDate(lastSyncedAt):null,
      maturity,
      this.SYNCING_FREQUENCY_SPEC
    );
    if(!shouldSync) return null;
    return utxo;
  }

  constructor(
    txHistory: ConsumerTxHistory,
    onChainThread?: PollingInfo<ChannelTxOut[]>,
  ) {
    this._txHistory = txHistory;
    this._onChainThread = onChainThread ?? new PollingInfo<ChannelTxOut[]>(null);
  }

  public static open(
    openTx: OpenTx,
  ) {
    let txHistory = ConsumerTxHistory.unafeFromArray([openTx]);
    return new L1Channel(txHistory);
  }


  public get txHistory(): ConsumerTxHistory {
    return ConsumerTxHistory.clone(this._txHistory);
  }

  // // FIXME: We do not account yet the upper tx validity interval
  // // Transactions which are not present on the chain yet.
  // // Either not submitted or not found by the connector.
  // public get offchainValidTxs(): ConsumerTx[] {
  //   return this._txHistory.filter(tx => {
  //     if (tx.txHash == null) return true;
  //     const foundOnChain = this._onChainThread.find(onChainTx =>
  //       TxHash.ord.areEqual(onChainTx.txOutRef.txId, tx.txHash!)
  //     )
  //     return !foundOnChain;
  //   });
  // }


  get openTx(): OpenTx {
    return this._txHistory.slice().reverse().find((tx): tx is OpenTx => tx.type === "OpenTx")!;
  }

  get consumerVerificationKey(): ConsumerEd25519VerificationKey {
    return this.openTx.consumer as ConsumerEd25519VerificationKey;
  }

  get channelTag(): ChannelTag {
    return this.openTx.tag;
  }

  get totalSubmittedCapacity(): Lovelace {
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

  // FIXME: This is not true.
  get totalOnChainCapacity(): Lovelace {
    return this.totalSubmittedCapacity;
  }

  get totalApprovedCapacity(): Lovelace {
    return this.totalSubmittedCapacity;
  }

  // FIXME: These 3 methods are only exposed temporarily
  // till we move the whole transaciton building and submission
  // logic here.
  // The logic in here should be more restrictive:
  // * We should allow closing if there are no pending transactions.
  public canClose = (): boolean => {
    const lastTx = this._txHistory[this._txHistory.length - 1]!;
    return lastTx.type !== "CloseTx";
  }

  public closeSubmitted = (closeTx: CloseTx) => {
    this._txHistory = ConsumerTxHistory.unafeFromArray([...this._txHistory, closeTx]);
  }

  public isLastTxOnChain = (): boolean => {
    const lastTx = this._txHistory[this._txHistory.length - 1]!;
    const onChainTxs =  this._onChainThread.lastSuccessfulFetch?.value || []
    return onChainTxs.some(onChainTx => TxHash.ord.areEqual(onChainTx.txOutRef.txId, lastTx.txHash!)) ?? false;
  }
}

export const json2L1ChannelCodec: JsonCodec<L1Channel> = (() => {
  const json2L1ChannelRecordCodec = jsonCodecs.objectOf({
    on_chain_thread: mkJson2PollingInfoCodec(jsonCodecs.arrayOf(json2ChannelTxOutCodec)),
    tx_history: jsonCodecs.arrayOf(json2ConsumerTxCodec),
  });

  return codec.rmap(
    json2L1ChannelRecordCodec,
    (r) => {
      return new L1Channel(
        ConsumerTxHistory.unafeFromArray(r.tx_history),
        r.on_chain_thread,
      );
    },
    (channel: L1Channel) => {
      return {
        on_chain_thread: channel.onChainThread,
        tx_history: channel.txHistory,
      };
    }
  );
})();

