import { defaultCardanoConnector } from "./env";
import * as codec from "@konduit/codec";
import { ref, readonly, computed, watch } from 'vue'
import type { Ref } from "vue";
import { fromDb, toDb } from "./store/persistence";
import { BalanceInfo, CardanoConnectorWallet, isBlockfrostWallet, type AnyWallet } from "@konduit/konduit-consumer/wallets/embedded";
import { json2KonduitConsumerCodec, KonduitConsumer } from "@konduit/konduit-consumer";
import { Seconds } from '@konduit/konduit-consumer/time/duration';
import type { Channel } from '@konduit/konduit-consumer/channel';
import { err, ok, type Result } from 'neverthrow';
import type { JsonError } from '@konduit/codec/json/codecs';
import type { Json } from "@konduit/codec/json";
import type { Invoice } from "@konduit/konduit-consumer/bitcoin/bolt11";
import { mkConnectorClient, type ConnectorClient } from "@konduit/konduit-consumer/cardano/connectorClient";
import { okAsyncPromise, promiseToAsync, toPromise } from "@konduit/konduit-consumer/neverthrow";
import type { PublicNetwork } from "@konduit/konduit-consumer/cardano";
import type { HttpEndpointError } from "@konduit/konduit-consumer/http";
import type { Mnemonic } from "@konduit/cardano-keys";

export type AppPhase = "loading" | "launching" | "running";

export const appPhase: Ref<AppPhase> = ref<AppPhase>("loading");

// We are currently restricted to cardano connector because
// the TX builder depends on it.
export type AppKonduitConsumer = KonduitConsumer<CardanoConnectorWallet>;

export const wallet: Ref<CardanoConnectorWallet | null> = ref(null);

export const hasWallet = computed(() => {
  return wallet.value !== null;
});

// The connector usage behaviour is as follows:
// - On app init, we use default connector which is part of the build (through .env setting)
// - If a user creates a new wallet that value will be picked for the backend.
// - If the user edits the connector setting or restores the wallet with a different backend URL then the connector will be validated and set on the wallet (which performs the network check).
// - Then we will react on that wallet config change and set the value here as well.
// - On forget action we do not clear this setting, so that the next create action will use the last used connector and its backend URL.
const _cardanoConnectorUrlLabel = "cardano-connector-url";

export const _cardanoConnector = ref<ConnectorClient>(defaultCardanoConnector.connector);
watch(_cardanoConnector, async (curr, _prev) => {
  if (curr) {
    await toDb(_cardanoConnectorUrlLabel, curr.baseUrl);
  }
});
export const cardanoConnector = readonly(_cardanoConnector);

/* We use only `readonly` wrappers on the objects which actually are readonly
 * If we do this on a mutable object like KonduitConsumer or Wallet
 * it magically becomes immutable and ITS MUTATING INTERNAL METHODS DO NOT WORK ANYMORE.
 */
const _walletBalanceInfo = ref<BalanceInfo | null>(null);
export const walletBalanceInfo = readonly(_walletBalanceInfo);

export const walletBalance = computed(() => {
  return _walletBalanceInfo.value?.lastValue || null;
});

export const _channels = ref<Channel[]>([]);
export const channels = readonly(_channels) as Readonly<Ref<Channel[]>>;

export const konduitConsumer = ref<AppKonduitConsumer | null>(null);

export const setCardanoConnector = async (newConnectorUrl: string) => {
  const newConnector = mkConnectorClient(newConnectorUrl);
  if(konduitConsumer.value === null) return;
  konduitConsumer.value.setConnectorClient(newConnector);
  _cardanoConnector.value = newConnector;
};

const _subscriptions: Array<() => void> = [];

const _koduitConsumerDbLabel: string = "konduit-consumer";

const _saveKonduitConsumer = async () => {
  if(konduitConsumer.value === null) return;
  // TypeScript needs some help here
  const konduitConsumerJson = json2KonduitConsumerCodec.serialise(konduitConsumer.value as AppKonduitConsumer);
  console.log("Saving konduit consumer to DB", konduitConsumerJson);
  await toDb(_koduitConsumerDbLabel, konduitConsumerJson);
}

export const loadKonduitConsumerFromJson = (consumerJson: Json): Result<AppKonduitConsumer, JsonError> => {
  const consumerCodec = codec.pipe(
    json2KonduitConsumerCodec, {
      deserialise: (konduitConsumer) => {
        if(isBlockfrostWallet(konduitConsumer.wallet)) {
          return err("BlockfrostWallet is not supported yet in this app");
        }
        return ok(konduitConsumer as AppKonduitConsumer);
      },
      serialise: (konduitConsumer: AppKonduitConsumer) => {
        return konduitConsumer as KonduitConsumer<AnyWallet>;
      }
    }
  );

  const result = consumerCodec.deserialise(consumerJson);
  result.map((consumer) => _setupKonduitConsumer(consumer));
  return result;
}

export const loadKonduitConsumerFromDb = async (): Promise<Result<AppKonduitConsumer | null, JsonError>> => {
  const konduitConsumerJson = await fromDb(_koduitConsumerDbLabel);
  if(konduitConsumerJson === null) return ok(null);
  return loadKonduitConsumerFromJson(konduitConsumerJson as Json);
}

const _setupKonduitConsumer = (consumer: AppKonduitConsumer): void => {
  if(konduitConsumer.value !== null) {
    forgetKonduitConsumer();
  }
  konduitConsumer.value = consumer;
  _channels.value = consumer.channels;

  _subscriptions.push(consumer.subscribe('channel-tx-submitted', ({ channel: _channel }) => {
    _saveKonduitConsumer();
    _channels.value = consumer.channels;
  }));

  _subscriptions.push(consumer.subscribe('channel-squashed', ({ channel: _channel }) => {
    _saveKonduitConsumer();
    _channels.value = consumer.channels;
  }));

  _subscriptions.push(consumer.wallet.subscribe('balance-fetched', () => {
    _saveKonduitConsumer();
    _walletBalanceInfo.value = consumer.wallet.balanceInfo;
    wallet.value = consumer.wallet;
  }));
  _walletBalanceInfo.value = consumer.wallet.balanceInfo;
  wallet.value = consumer.wallet;

  _subscriptions.push(consumer.wallet.subscribe('backend-changed', async ({ newBackend }) => {
    _saveKonduitConsumer();
    _cardanoConnector.value = newBackend.connector
  }));
  _cardanoConnector.value = consumer.wallet.walletBackend.connector;
  consumer.wallet.startPolling(Seconds.fromDigits(1, 2, 0));
  consumer.startPolling(Seconds.fromDigits(0, 1, 5));
  wallet.value = consumer.wallet;
}

export const createKonduitConsumer = async (): Promise<Result<AppKonduitConsumer, HttpEndpointError>> => {
  if(konduitConsumer.value !== null) {
    forgetKonduitConsumer();
  }
  return toPromise(
    promiseToAsync(cardanoConnector.value.network())
      .andThen((publicNetwork: PublicNetwork) => okAsyncPromise<{ consumer: AppKonduitConsumer, mnemonic: Mnemonic }, HttpEndpointError>(KonduitConsumer.createUsingConnector(cardanoConnector.value.baseUrl, publicNetwork)))
      .map((res) => {
        const { consumer, mnemonic: _mnemonic } = res;
        _setupKonduitConsumer(consumer);
        _saveKonduitConsumer();
        return consumer;
      })
  );
}

export const forgetKonduitConsumer = (): void => {
  if(konduitConsumer.value === null) {
    return;
  }
  konduitConsumer.value.wallet.stopPolling();
  konduitConsumer.value = null;
  _subscriptions.forEach(unsub => unsub());
}

// We keep the "current invoice" as the pay flow can be interrupted.
// User can be redirected to the adaptor and channel setup etc.
export const invoice = ref<Invoice | null>(null);

let initPromise: Promise<Result<null, string>> | null = null;

export async function init(): Promise<Result<null, string>> {
  if (initPromise) return initPromise;
  let _init = async () => {
    const result = await loadKonduitConsumerFromDb();
    return result.match(
      (_consumer) => ok(null),
      (e) => err(`Failed to load KonduitConsumer from DB: ${e}`)
    );
  };
  initPromise = _init();
  return initPromise;
}

export async function forget(): Promise<void> {
  // Please note that we do not clear the stored connector URL here.
  forgetKonduitConsumer();
}

