import type { JsonError } from "@konduit/codec/json/codecs";
import * as jsonAsyncCodecs from "@konduit/codec/json/async";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as asyncCodec from "@konduit/codec/async";
import { type Wallet as WalletBase, type AnyWallet, BlockfrostWallet, CardanoConnectorWallet, json2AnyWalletAsyncCodec, type WalletBackendBase } from "./wallets/embedded";
import { err, ok, Result } from "neverthrow";
import { Ed25519PrivateKey, Mnemonic } from "@konduit/cardano-keys";
import { AdaptorFullInfo, Quote } from "./adaptorClient";
import { type AnyChannelTx, Channel, ChannelTag, type ChequeIssuingError, type CloseTx, type ConfirmedPayment, type ConsumerEd25519VerificationKey, json2ChannelCodec, type OpenTx, type PendingPayment } from "./channel";
import { Milliseconds, Seconds } from "./time/duration";
import { json2Ed25519PrivateKeyCodec, Lovelace } from "./cardano";
import { Connector, json2ConnectorAsyncCodec } from "./cardano/connector";
import { promiseToResultAsync, resultAsyncToPromise } from "./neverthrow";
import { ValidDate } from "./time/absolute";
import type { DeserialisationError, HttpEndpointError, HttpError } from "./http";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";
import { Squash, SquashBody } from "./channel/squash";
import type { InvoiceString } from "@konduit/bln/invoice/bolt11";
import type { Invoice } from "./bitcoin/bolt11";
import { TxIx } from "./cardano/ledger";

type ConsumerEvent<T> = CustomEvent<T>;

export type ConsumerEvents = {
  // Emitted when channel tx was submitted to the chain
  "channel-tx-submitted": { channel: Channel; };
  // Emitted when channel tx was confirmed on the chain.
  // This doesn't mean the channel is operational.
  "channel-tx-on-chain": { channel: Channel; tx: AnyChannelTx }
  // Emitted when channel tx has been rolled back from the chain.
  "channel-tx-rolled-back": { channel: Channel; tx: AnyChannelTx }
  // Emitted when channel was squashed and synced with adaptor.
  // Channel is operational.
  // TODO: Probably we should be prepared that this "decision"
  // can also be rolled back.
  "channel-squashed": { channel: Channel; result: Squash };
  // Emitted when the server response is errorneous.
  // Not emitted on networking issue.
  "channel-squashing-failed": {
    channel: Channel;
    error: HttpError | DeserialisationError
  }
};

export type ChannelQuoteResult = {
  channel: Channel;
  quoteResult: Result<Quote, HttpEndpointError>
}

export type ChannelQuoteInfo = {
  channel: Channel;
  quote: Quote;
}

type OnQuoteInfo = (
  snapshot: ChannelQuoteResult[],
  bestSoFar: ChannelQuoteInfo | null
) => void;

export type PayError =
  | { type: "TimeoutCalculation"; error: string }
  | ChequeIssuingError

export class KonduitConsumer<Wallet extends WalletBase<WalletBackendBase>> {
  // We keep the signing key separate from wallet
  // because we want to allow users to use different
  // wallet (CIP-30) for L1 interactions.
  private _prvKey: Ed25519PrivateKey;
  private _wallet: Wallet;

  // The only role of the connector here is to build transactions.
  // We use wallet API for signing and submitting.
  public readonly txBuilder: Connector;

  // FIX: debugging
  public _channels: Map<ChannelTag, Channel>;

  private _subscriptionCounter: number = 0;
  private readonly eventTarget = new EventTarget();

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInterval = Milliseconds.fromNonNegativeInt(NonNegativeInt.fromSmallNumber(0));

  constructor(prvKey: Ed25519PrivateKey, txBuilder: Connector, wallet: Wallet, channels?: Map<ChannelTag, Channel>) {
    this._prvKey = prvKey;
    this._wallet = wallet;
    // Currently we just copy the connector from the wallet.
    this._channels = channels ?? new Map<ChannelTag, Channel>();
    this.txBuilder = txBuilder;
  }

  // A memory leak debugging helper
  public get subscriptionCounter(): number {
    return this._subscriptionCounter;
  }

  public get channels(): Channel[] {
    return Array.from(this._channels.values());
  }

  public get maximumCapacity(): Lovelace | null {
    const anyOperational = this.channels.reduce((acc, channel) => channel.isOperational || acc, false);
    if(!anyOperational)
      return null;
    return this.channels.reduce(
      (acc, channel) =>
        channel.availableApprovedCapacity != null?
          Lovelace.ord.max(acc, channel.availableApprovedCapacity)
          : acc,
      Lovelace.zero
    );
  }

  public async queryQuotes(
    invoice: InvoiceString,
    onQuoteInfo: OnQuoteInfo,
  ): Promise<[ChannelQuoteResult[], ChannelQuoteInfo | null]> {
    const results: ChannelQuoteResult[] = [];
    const findBestQuote = (results: ChannelQuoteResult[]) => {
      const reduceStep = (best: ChannelQuoteInfo | null, current: ChannelQuoteResult): ChannelQuoteInfo | null => {
        if (best == null) {
          const newBest: ChannelQuoteInfo | null = current.quoteResult.match(
            (quote) => ({ channel: current.channel, quote } as ChannelQuoteInfo),
            (_error) => null
          );
          return newBest;
        }
        const { quote: bestQuote }: ChannelQuoteInfo = best;
        const newBest: ChannelQuoteInfo | null = current.quoteResult.match(
          (quote) => (quote.amount < bestQuote.amount ? { channel: current.channel, quote } as ChannelQuoteInfo: best),
          (_error) => best
        );
        return newBest;
      };
      const bestSoFar: ChannelQuoteInfo | null = results.reduce<ChannelQuoteInfo | null>(
        reduceStep,
        null as (ChannelQuoteInfo | null)
      );
      return bestSoFar;
    };
    const probes = this.channels.map(async (channel) => {
      const quoteResult = await channel.adaptorClient.chQuote(invoice);
      results.push({ channel, quoteResult } as ChannelQuoteResult);
      const bestSoFar = findBestQuote(results);
      onQuoteInfo([...results], bestSoFar);
    });

    return Promise.allSettled(probes).then(() => {
      const theBest = findBestQuote(results);
      return [[...results], theBest];
    });
  }

  public static async createUsingConnector(
    cardanoConnectBackend: string,
  ): Promise<Result<{ consumer: KonduitConsumer<CardanoConnectorWallet>, mnemonic: Mnemonic }, JsonError>> {
    let possibleWallet = await CardanoConnectorWallet.create(cardanoConnectBackend);
    return possibleWallet.map((walletWithMnemonic) => {
      let wallet = walletWithMnemonic.wallet;
      let connector = wallet.walletBackend.connector;
      const prvKey = Ed25519PrivateKey.fromMnemonic(walletWithMnemonic.mnemonic);
      return { consumer: new KonduitConsumer(prvKey, connector, walletWithMnemonic.wallet), mnemonic: walletWithMnemonic.mnemonic };
    });
  }

  public static async createUsingBlockfrost(
    cardanoConnectBackend: string, // TODO: this is only needed for tx building. Should be dropped.
    blockfrostProjectId: string,
  ): Promise<Result<{ consumer: KonduitConsumer<BlockfrostWallet>, mnemonic: Mnemonic }, JsonError>> {
    let possibleWallet = await BlockfrostWallet.create(blockfrostProjectId);
    let possibleConnector = await Connector.new(cardanoConnectBackend);
    return Result.combine([
      possibleWallet,
      possibleConnector,
    ]).map(([walletWithMnemonic, connector]) => {
      const prvKey = Ed25519PrivateKey.fromMnemonic(walletWithMnemonic.mnemonic);
      return { consumer: new KonduitConsumer(prvKey, connector, walletWithMnemonic.wallet), mnemonic: walletWithMnemonic.mnemonic };
    });
  }

  // FIXME: those will be replaced by internal properties once we separate wallet from consumer
  public get wallet() {
    return this._wallet;
  }

  private get sKey() {
    return this._prvKey.toSigningKey();
  }

  public get vKey(): ConsumerEd25519VerificationKey {
    return this.sKey.toVerificationKey() as ConsumerEd25519VerificationKey;
  }

  private async poll() {
    // Go over the channels, identify those which needs approval from the adaptor
    for(const channel of this._channels.values()) {
      const origSquashInfo = channel.squashingInfo.lastValue;
      console.log("Polling channel - orig squash:", origSquashInfo);

      const result = await channel.doAdaptorSync(this.sKey);
      console.log("Polling channel - sync result:", result);

      const newSquashInfo = channel.squashingInfo.lastValue;
      console.log("Polling channel - new squash:", newSquashInfo);

      if(newSquashInfo == null) continue;
      if (origSquashInfo == null) {
        this.emit("channel-squashed", { channel, result: newSquashInfo.squash });
      } else if(!SquashBody.areEqual(origSquashInfo.squash.body, newSquashInfo.squash.body)) {
        this.emit("channel-squashed", { channel, result: newSquashInfo.squash });
      }
      //   result.match(
      //     (result) => {
      //       if(result != null)
      //         this.emit("channel-squashed", { channel, result });
      //     },
      //     (error) => {
      //       // TODO: emit only when the error is actually not networking issue but a rather more
      //       // problematic case.
      //       this.emit("channel-squashing-failed", { channel, error });
      //     }
      //   );
      // }
    }
  }
  // (Re)start polling
  public async startPolling(interval: Seconds) {
    let intervalMs = Milliseconds.fromSeconds(interval);
    await this.poll();
    if (this.pollingTimer) {
      if(this.pollingInterval !== intervalMs) {
        clearInterval(this.pollingTimer);
      } else {
        return;
      }
    }
    this.pollingInterval = intervalMs;
    this.pollingTimer = setInterval(() =>
      this.poll(),
      Number(intervalMs)
    );
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private emit<K extends keyof ConsumerEvents>(event: K, payload: ConsumerEvents[K]) {
    this.eventTarget.dispatchEvent(
      new CustomEvent<ConsumerEvents[K]>(event, { detail: payload })
    );
  }

  // WARNING! Please do not forget to unsubscribe when you no longer need the events
  // as the listeners will stay in memory otherwise!
  subscribe<K extends keyof ConsumerEvents>(
    event: K,
    listener: (payload: ConsumerEvents[K]) => void
  ): () => void {  // returns unsubscribe function — very convenient!
    const handler = (e: Event) => {
      const ce = e as ConsumerEvent<ConsumerEvents[K]>;
      listener(ce.detail);
    };

    this.eventTarget.addEventListener(event, handler as EventListener);
    this._subscriptionCounter += 1;
    return () => {
      this.eventTarget.removeEventListener(event, handler as EventListener);
      this._subscriptionCounter -= 1;
    };
  }

  public pay = async (channel: Channel, quote: Quote, invoice: Invoice): Promise<Result<ConfirmedPayment | PendingPayment, PayError>> => {
    const timeout = ValidDate.addMilliseconds(ValidDate.now(), quote.relativeTimeout);
    return timeout.match(
      async (timeout) => {
        const payResult = await channel.doPay(quote.amount, timeout, invoice, this.sKey);
        return payResult;
      },
      async (error) => err({ type: "TimeoutCalculation" as const, error } as PayError)
    );
  }

  // TODO: REFACTOR - move most of this logic down to the channel
  public async openChannel(
    adaptorFullInfo: AdaptorFullInfo,
    amount: Lovelace,
    closePeriod: Milliseconds,
  ): Promise<Result<Channel, JsonError>> {
    const channelTag = await ChannelTag.fromRandomBytes();
    const [adaptorUrl, adaptorInfo] = adaptorFullInfo;
    return await resultAsyncToPromise(
      promiseToResultAsync(this.txBuilder.buildOpenTx(
        channelTag,
        this.vKey,
        adaptorInfo.adaptorEd25519VerificationKey,
        closePeriod,
        amount,
      )).andThen((openTx) =>
        promiseToResultAsync(this.wallet.sign(openTx))
      ).andThen((signedTx) => {
        const now = ValidDate.now();
        return promiseToResultAsync(this.wallet.submit(signedTx))
          .andThen((txHash) => {
            const openTx = {
              adaptor: adaptorInfo.adaptorEd25519VerificationKey,
              adaptorApproved: false,
              amount: amount,
              created: now,
              closePeriod: closePeriod,
              consumer: this.vKey as ConsumerEd25519VerificationKey,
              lastSubmitted: now,
              tag: channelTag,
              txCbor: signedTx.toCbor(),
              txHash: txHash,
              // FIXME: This should be derived from the body of the tx
              txIx: TxIx.fromDigits(0),
              type: "OpenTx" as const,
            } as OpenTx;
            const channel = Channel.open(openTx, adaptorUrl);
            try {
              this._channels.set(channelTag, channel);
            } catch(e) {
              return err(`Panic: Failed to add channel to the map: ${e}`);
            }
            this.emit("channel-tx-submitted", { channel });
            return ok(channel);
          });
      })
    );
  };

  // FIXME: this and the above logic should be pushed to the channel
  // Resubmission on demand should be part of that lower layer as well
  // so the consumer does not manipuate the state of those pieces directly.
  public async closeChannel(channelTag: ChannelTag): Promise<Result<boolean, JsonError>> {
    const channel = this._channels.get(channelTag);
    if (!channel) {
      return err(`Channel with tag ${channelTag} not found`);
    }
    if(!channel.l1.canClose()) {
      return ok(false);
    }
    return await resultAsyncToPromise(
      promiseToResultAsync(this.txBuilder.buildCloseTx(
        channelTag,
        this.vKey,
      )).andThen((closeTx) =>
        promiseToResultAsync(this.wallet.sign(closeTx))
      ).andThen((signedTx) => {
        const now = ValidDate.now();
        return promiseToResultAsync(this.wallet.submit(signedTx))
          .andThen((txHash) => {
            const closeTx = {
              created: now,
              lastSubmitted: now,
              txCbor: signedTx.toCbor(),
              txHash: txHash,
              // FIXME: This should be derived from the body of the tx
              txIx: TxIx.fromDigits(0),
              type: "CloseTx" as const,
            } as CloseTx;
            channel.l1.closeSubmitted(closeTx);
            this.emit("channel-tx-submitted", { channel });
            return ok(true);
          });
      })
    );
  }
}

export const json2KonduitConsumerAsyncCodec: jsonAsyncCodecs.JsonAsyncCodec<KonduitConsumer<AnyWallet>> = (() => {
  return asyncCodec.rmap(
    jsonAsyncCodecs.objectOf({
      channels: asyncCodec.fromSync(jsonCodecs.arrayOf(json2ChannelCodec)),
      private_key: asyncCodec.fromSync(json2Ed25519PrivateKeyCodec),
      tx_builder: json2ConnectorAsyncCodec,
      wallet: json2AnyWalletAsyncCodec,
    }),
    async (r) => {
      const channelsMap = new Map<ChannelTag, Channel>();
      r.channels.forEach((channel) => channelsMap.set(channel.channelTag, channel));
      return new KonduitConsumer(r.private_key, r.tx_builder, r.wallet, channelsMap);
    },
    (consumer) => {
      return {
        channels: consumer.channels,
        private_key: consumer["_prvKey"],
        tx_builder: consumer.txBuilder,
        wallet: consumer.wallet,
      };
    }
  );
})();
