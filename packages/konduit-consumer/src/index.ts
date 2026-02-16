import type { JsonError } from "@konduit/codec/json/codecs";
import * as jsonAsyncCodecs from "@konduit/codec/json/async";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as asyncCodec from "@konduit/codec/async";
import { type Wallet as WalletBase, type AnyWallet, BlockfrostWallet, CardanoConnectorWallet, json2AnyWalletAsyncCodec, type WalletBackendBase } from "./wallets/embedded";
import { err, Result } from "neverthrow";
import { Ed25519PrivateKey, Mnemonic } from "@konduit/cardano-keys";
import { AdaptorFullInfo, type ChSquashResponse } from "./adaptorClient";
import { Channel, ChannelTag, type ConsumerEd25519VerificationKey, json2ChannelCodec, type OpenTx } from "./channel";
import { Milliseconds, Seconds } from "./time/duration";
import { json2Ed25519PrivateKeyCodec, Lovelace } from "./cardano";
import { Connector, json2ConnectorAsyncCodec } from "./cardano/connector";
import { hoistToResultAsync, resultAsyncToPromise } from "./neverthrow";
import { ValidDate } from "./time/absolute";
import type { Json } from "@konduit/codec/json";
import type { HttpEndpointError } from "./http";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";

type ConsumerEvent<T> = CustomEvent<T>;

export type ConsumerEvents = {
  "channel-opened": { channel: Channel; };
  "channel-squashed": { channel: Channel; result: ChSquashResponse };
};

export class KonduitConsumer<Wallet extends WalletBase<WalletBackendBase>> {
  // We keep the signing key separate from wallet
  // because we want to allow users to use different
  // wallet (CIP-30) for L1 interactions.
  private _prvKey: Ed25519PrivateKey;
  private _wallet: Wallet;
  // The only role of the connector here is to build transactions.
  // We use wallet API for signing and submitting.
  public readonly txBuilder: Connector;
  private _channels: Map<ChannelTag, Channel>;

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
      if(!channel.isFullySquashed) {
        const result = await channel.squash(this.sKey)
        if(result == null) continue; // channel is already fully squashed, nothing to do
        result.map((result) => {
          if(result != null)
            this.emit("channel-squashed", { channel, result });
        });
      }
    }
  }
  // // (Re)start polling
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

  public async openChannel(
    adaptorFullInfo: AdaptorFullInfo,
    amount: Lovelace,
    closePeriod: Milliseconds,
  ): Promise<Result<Channel, JsonError>> {
    const channelTag = await ChannelTag.fromRandomBytes();
    const [adaptorUrl, adaptorInfo] = adaptorFullInfo;
    return await resultAsyncToPromise(
      hoistToResultAsync(this.txBuilder.buildOpenTx(
        channelTag,
        this.vKey,
        adaptorInfo.adaptorEd25519VerificationKey,
        closePeriod,
        amount,
      )).andThen((openTx) =>
        hoistToResultAsync(this.wallet.sign(openTx))
      ).andThen((signedTx) => {
        const now = ValidDate.now();
        return hoistToResultAsync(this.wallet.submit(signedTx))
          .map((txHash) => {
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
              type: "OpenTx" as const,
            } as OpenTx;
            const channel = Channel.open(openTx, adaptorUrl);
            this._channels.set(channelTag, channel);
            this.emit("channel-opened", { channel });
            return channel;
          });
      })
    );
  };

  public async squashChannel(
    channelTag: ChannelTag,
  ): Promise<null | Result<Json, HttpEndpointError | { type: "not-found", message: string }>> {
    const channel = this._channels.get(channelTag);
    if(channel == undefined)
      return err({ type: "not-found" as const, message: "Channel not found" });
    return channel.squash(this.sKey);
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
