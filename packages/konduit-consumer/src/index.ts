import { JsonError } from "@konduit/codec/json/codecs";
import { CardanoConnectorWallet } from "./wallets/embedded";
import type { Result } from "neverthrow";
import { Mnemonic } from "@konduit/cardano-keys";
import * as asyncCodec from "@konduit/codec/async";
import * as jsonAsyncCodecs from "@konduit/codec/json/async";
import { Adaptor, AdaptorUrl } from "./adaptor";
import { ChannelTag } from "./channel/core";

export class KonduitConsumer {
  private _wallet: CardanoConnectorWallet;
  private _adaptors: Map<AdaptorUrl, Adaptor>;

  constructor(wallet: CardanoConnectorWallet, adaptors: Map<AdaptorUrl, Adaptor> = new Map()) {
    this._wallet = wallet;
    this._adaptors = adaptors;
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

  public async restore(
    backendUrl: string,
    mnemonic: Mnemonic,
    password?: Uint8Array
  ): Promise<Result<KonduitConsumer, JsonError>> {
    let possibleWallet = await CardanoConnectorWallet.restore(backendUrl, mnemonic, password);
    return possibleWallet.map((wallet) => {
      return new KonduitConsumer(wallet);
    });
  }

  public get wallet() {
    return this._wallet;
  }

  public get adaptors() {
    return this._adaptors;
  }
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
