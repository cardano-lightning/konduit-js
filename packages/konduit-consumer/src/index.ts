import { JsonError } from "@konduit/codec/json/codecs";
import { CardanoConnectorWallet } from "./wallets/embedded";
import type { Result, ResultAsync } from "neverthrow";
import { Mnemonic } from "@konduit/cardano-keys";
import * as asyncCodec from "@konduit/codec/async";
import * as jsonAsyncCodecs from "@konduit/codec/json/async";
import { AdaptorFullInfo } from "./adaptorClient";
import { Channel, ChannelTag, ConsumerVKey } from "./channel";
import { Milliseconds } from "./time/duration";
import { Lovelace, TxCbor, TxHash } from "./cardano";
import { TransactionReadyForSigning } from "./cardano/connector";
import { hoistToResultAsync, resultAsyncToPromise } from "./neverthrow";

type ConsumerEvent<T> = CustomEvent<T>;

export type ConsumerEvents = {
  "channel-opened": { channel: Channel; tag: ChannelTag };
};

export class KonduitConsumer {
  // TODO: remove wallet from here. It should be replaced by:
  // * L2 signer interface
  // * L2 signer can be either a private key (ideally valut) or possibly a...
  // CIP-30 wallet if we agree on some extension to the L1 cheque standard.
  private _wallet: CardanoConnectorWallet;
  private _channels: Map<ChannelTag, Channel>;
  private _subscriptionCounter: number = 0;
  private readonly eventTarget = new EventTarget();

  constructor(wallet: CardanoConnectorWallet, channels: Map<ChannelTag, Channel> = new Map()) {
    this._wallet = wallet;
    // Currently we just copy the connector from the wallet.
    this._channels = channels;
  }

  // A memory leak debugging helper
  public get subscriptionCounter(): number {
    return this._subscriptionCounter;
  }

  public async create(
    backendUrl: string,
    mnemonicPassword?: Uint8Array
  ): Promise<Result<{ consumer: KonduitConsumer, mnemonic: Mnemonic }, JsonError>> {
    let possibleWallet = await CardanoConnectorWallet.create(backendUrl, mnemonicPassword);
    return possibleWallet.map((walletWithMnemonic) => {
      return { consumer: new KonduitConsumer(walletWithMnemonic.wallet), mnemonic: walletWithMnemonic.mnemonic };
    });
  }

  // FIXME: those will be replaced by internal properties once we separate wallet from consumer
  public get wallet() {
    return this._wallet;
  }
  public get connector() {
    return this._wallet.walletBackend.connector;
  }
  public get vKey(): ConsumerVKey {
    return this._wallet.vKey as ConsumerVKey;
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
    const possibleOpenTx = hoistToResultAsync(this.connector.buildOpenTx(
      channelTag,
      this.vKey,
      adaptorInfo.adaptorVKey,
      closePeriod,
      amount,
    ));
    const result = await resultAsyncToPromise(
      possibleOpenTx.andThen((openTx: TransactionReadyForSigning): ResultAsync<[TransactionReadyForSigning, TxHash], JsonError> => {
        return hoistToResultAsync(this._wallet.signAndSubmit(openTx)).map(
          (txHash) => {
            return [openTx, txHash];
          });
      })
    );
    return result.map(
      ([tx, txHash]) => {
        const openTx = {
          txCbor: TxCbor.fromTxReadyForSigning(tx),
          txHash: txHash,
          tag: channelTag,
          type: "OpenTx" as const,
          consumer: this.vKey,
          adaptor: adaptorInfo.adaptorVKey,
          closePeriod: closePeriod,
          amount: amount,
          submitted: null,
        };
        const channel = Channel.create(openTx, adaptorUrl);
        this._channels.set(channelTag, channel);
        this.emit("channel-opened", { channel, tag: channelTag });
        return channel;
    });
  }

  // public async restore(
  //   backendUrl: string,
  //   mnemonic: Mnemonic,
  //   password?: Uint8Array
  // ): Promise<Result<KonduitConsumer, JsonError>> {
  //   let possibleWallet = await CardanoConnectorWallet.restore(backendUrl, mnemonic, password);
  //   return possibleWallet.map((wallet) => {
  //     return new KonduitConsumer(wallet);
  //   });
  // }

}

export const json2KonduitConsumerAsyncCodec: jsonAsyncCodecs.JsonAsyncCodec<KonduitConsumer> = (() => {
  const json2RecordCodec = jsonAsyncCodecs.objectOf({
      wallet: CardanoConnectorWallet.json2WalletAsyncCodec
  });
  return asyncCodec.rmapSync(
    json2RecordCodec,
    (obj): KonduitConsumer => {
      return new KonduitConsumer(obj.wallet);
    },
    (consumer: KonduitConsumer) => {
      return {
        wallet: consumer.wallet,
      };
    }
  );
})();
