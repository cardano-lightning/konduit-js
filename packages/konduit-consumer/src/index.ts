import { JsonError } from "@konduit/codec/json/codecs";
import * as jsonAsyncCodecs from "@konduit/codec/json/async";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import * as asyncCodec from "@konduit/codec/async";
import { AnyWallet, BlockfrostWallet, CardanoConnectorWallet, json2AnyWalletAsyncCodec } from "./wallets/embedded";
import { Result } from "neverthrow";
import { Mnemonic } from "@konduit/cardano-keys";
import { AdaptorFullInfo } from "./adaptorClient";
import { Channel, ChannelTag, ConsumerEd25519VerificationKey, json2ChannelCodec, OpenTx } from "./channel";
import { Milliseconds, Seconds } from "./time/duration";
import { Lovelace } from "./cardano";
import { Connector, json2ConnectorAsyncCodec } from "./cardano/connector";
import { hoistToResultAsync, resultAsyncToPromise } from "./neverthrow";
import { ValidDate } from "./time/absolute";
import { NonNegativeInt } from "@konduit/codec/integers/smallish";

type ConsumerEvent<T> = CustomEvent<T>;

export type ConsumerEvents = {
  "channel-opened": { channel: Channel; };
};

export class KonduitConsumer {
  private _wallet: AnyWallet;
  // The only role of the connector here is to build transactions.
  // We use wallet API for signing and submitting.
  public readonly txBuilder: Connector;
  private _channels: Map<ChannelTag, Channel>;

  private _subscriptionCounter: number = 0;
  private readonly eventTarget = new EventTarget();

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInterval = Milliseconds.fromNonNegativeInt(NonNegativeInt.fromSmallNumber(0));

  constructor(txBuilder: Connector, wallet: AnyWallet, channels?: Map<ChannelTag, Channel>) {
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
  ): Promise<Result<{ consumer: KonduitConsumer, mnemonic: Mnemonic }, JsonError>> {
    let possibleWallet = await CardanoConnectorWallet.create(cardanoConnectBackend);
    return possibleWallet.map((walletWithMnemonic) => {
      let wallet = walletWithMnemonic.wallet;
      let connector = wallet.walletBackend.connector;
      return { consumer: new KonduitConsumer(connector, walletWithMnemonic.wallet), mnemonic: walletWithMnemonic.mnemonic };
    });
  }

  public static async createUsingBlockfrost(
    cardanoConnectBackend: string, // TODO: this is only needed for tx building. Should be dropped.
    blockfrostProjectId: string,
  ): Promise<Result<{ consumer: KonduitConsumer, mnemonic: Mnemonic }, JsonError>> {
    let possibleWallet = await BlockfrostWallet.create(blockfrostProjectId);
    let possibleConnector = await Connector.new(cardanoConnectBackend);
    return Result.combine([
      possibleWallet,
      possibleConnector,
    ]).map(([walletWithMnemonic, connector]) => {
      return { consumer: new KonduitConsumer(connector, walletWithMnemonic.wallet), mnemonic: walletWithMnemonic.mnemonic };
    });
  }

  // FIXME: those will be replaced by internal properties once we separate wallet from consumer
  public get wallet() {
    return this._wallet;
  }

  // public get connector() {
  //   return this._wallet.walletBackend.connector;
  // }

  public get vKey(): ConsumerEd25519VerificationKey {
    return this.wallet.vKey as ConsumerEd25519VerificationKey;
  }

  private async poll() {
    const result = await this.walletBackend.getBalance(this.vKey);
    const resultFlattened = result.match((info) => info, (failure) => failure);
    let origBalance = this.balance;
    this._balanceInfo = this._balanceInfo? this._balanceInfo.mkSuccessor(resultFlattened) : BalanceInfo.mkNew(resultFlattened);
    result.match(
      (lovelace) => {
        this.emit('balance-fetched', { currentBalance: lovelace });
        if(origBalance !== lovelace)
          this.emit('balance-changed', { newBalance: lovelace });
      },
      (error) => {
        this.emit('balance-update-failed', { error });
      }
    );
  }

  // (Re)start polling
  public async startPolling(interval: Seconds) {
    let intervalMs = Milliseconds.fromSeconds(interval);
    this.poll();
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
      ).andThen((signedTx) =>
        hoistToResultAsync(this.wallet.submit(signedTx))
        .map((txHash) => {
          const openTx = {
            adaptor: adaptorInfo.adaptorEd25519VerificationKey,
            adaptorApproved: false,
            amount: amount,
            closePeriod: closePeriod,
            consumer: this.vKey,
            submitted: ValidDate.now(),
            tag: channelTag,
            txBlockNo: null,
            txCbor: signedTx.toCbor(),
            txHash: txHash,
            type: "OpenTx" as const,
          } as OpenTx;
          const channel = Channel.create(openTx, adaptorUrl);
          this._channels.set(channelTag, channel);
          this.emit("channel-opened", { channel });
          return channel;
        })
      )
    );
  };

}

export const json2KonduitConsumerAsyncCodec: jsonAsyncCodecs.JsonAsyncCodec<KonduitConsumer> = (() => {
  return asyncCodec.rmap(
    jsonAsyncCodecs.objectOf({
      channels: asyncCodec.fromSync(jsonCodecs.arrayOf(json2ChannelCodec)),
      tx_builder: json2ConnectorAsyncCodec,
      wallet: json2AnyWalletAsyncCodec,
    }),
    async (r) => {
      const channelsMap = new Map<ChannelTag, Channel>();
      r.channels.forEach((channel) => channelsMap.set(channel.channelTag, channel));
      return new KonduitConsumer(r.tx_builder, r.wallet, channelsMap);
    },
    (consumer) => {
      return {
        channels: consumer.channels,
        tx_builder: consumer.txBuilder,
        wallet: consumer.wallet,
      };
    }
  );
})();
