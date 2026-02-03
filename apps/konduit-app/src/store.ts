import { defaultCardanoConnector } from "./env";
import { Connector } from "@konduit/konduit-consumer/cardano/connector";
import { ref, readonly, computed, watch } from 'vue'
import type { Ref } from "vue";
import { fromDb, toDb } from "./store/persistence";
import { BalanceInfo, CardanoConnectorWallet } from "@konduit/konduit-consumer/wallets/embedded";
import { json2KonduitConsumerAsyncCodec, KonduitConsumer } from "@konduit/konduit-consumer";
import { Seconds } from '@konduit/konduit-consumer/time/duration';
import { err, ok, type Result } from 'neverthrow';
import type { JsonError } from '@konduit/codec/json/codecs';
import type { Json } from "@konduit/codec/json";
import type { InvoiceInfo } from "@konduit/bln/invoice";

export type AppPhase = "loading" | "launching" | "running";

export const appPhase: Ref<AppPhase> = ref<AppPhase>("loading");

const _wallet: Ref<CardanoConnectorWallet | null> = ref(null);
// We are replacing the signingKey with a wallet abstraction
export const wallet = readonly(_wallet);

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

const _cardanoConnector = ref<Connector>(defaultCardanoConnector);
export const cardanoConnector = readonly(_cardanoConnector);

watch(_cardanoConnector, async (curr, _prev) => {
  if (curr) {
    await toDb(_cardanoConnectorUrlLabel, curr.backendUrl);
  }
});

const _walletBalanceInfo = ref<BalanceInfo | null>(null);
export const walletBalanceInfo = readonly(_walletBalanceInfo);

export const walletBalance = computed(() => {
  return _walletBalanceInfo.value?.lovelace;
});

const _konduitConsumer = ref<KonduitConsumer | null>(null);
export const konduitConsumer = readonly(_konduitConsumer);

const _subscriptions: Array<() => void> = [];

const _koduitConsumerDbLabel: string = "konduit-consumer";

const _saveKonduitConsumer = async () => {
  if(_konduitConsumer.value === null) return;
  // TypeScript needs some help here
  const konduitConsumerJson = json2KonduitConsumerAsyncCodec.serialise(_konduitConsumer.value as KonduitConsumer);
  await toDb(_koduitConsumerDbLabel, konduitConsumerJson);
}

export const loadKonduitConsumerFromJson = async (consumerJson: Json): Promise<Result<KonduitConsumer, JsonError>> => {
  const result = await json2KonduitConsumerAsyncCodec.deserialise(consumerJson);
  result.map((consumer) => _setupKonduitConsumer(consumer));
  return result;
}

export const loadKonduitConsumerFromDb = async (): Promise<Result<KonduitConsumer | null, JsonError>> => {
  const konduitConsumerJson = await fromDb(_koduitConsumerDbLabel);
  if(konduitConsumerJson === null) return ok(null);
  return await loadKonduitConsumerFromJson(konduitConsumerJson as Json);
}

const _setupKonduitConsumer = (consumer: KonduitConsumer): void => {
  if(_konduitConsumer.value !== null) {
    forgetKonduitConsumer();
  }
  _konduitConsumer.value = consumer;
  _subscriptions.push(consumer.wallet.subscribe('balance-fetched', () => {
    _saveKonduitConsumer();
    _walletBalanceInfo.value = consumer.wallet.balanceInfo;
  }));
  _walletBalanceInfo.value = consumer.wallet.balanceInfo;

  _subscriptions.push(consumer.wallet.subscribe('backend-changed', async ({ newBackend }) => {
    _saveKonduitConsumer();
    _cardanoConnector.value = newBackend.connector
  }));
  _cardanoConnector.value = consumer.wallet.walletBackend.connector;

  consumer.wallet.startPolling(Seconds.fromDigits(1, 2, 0));
  _wallet.value = consumer.wallet;
}

export const createKonduitConsumer = async (): Promise<Result<KonduitConsumer, JsonError>> => {
  if(_konduitConsumer.value !== null) {
    forgetKonduitConsumer();
  }
  const result = await CardanoConnectorWallet.create(cardanoConnector.value as Connector);
  return await result.match(
    async ({ mnemonic: _m, wallet }) => {
      const consumer = new KonduitConsumer(wallet);
      _setupKonduitConsumer(consumer);
      await _saveKonduitConsumer();
      return ok(consumer);
    },
    async (e) => err(e)
  );
}

export const forgetKonduitConsumer = (): void => {
  if(_konduitConsumer.value === null) {
    return;
  }
  _konduitConsumer.value.wallet.stopPolling();
  _konduitConsumer.value = null;
  _subscriptions.forEach(unsub => unsub());
}

// const channelsLabel = "channels";
// export const channels: Ref<Channel[]> = ref<Channel[]>([]);
// 
// export function appendChannel(channel: Channel): void {
//   channels.value = [...channels.value, channel];
// }
//
// watch(channels, async (curr, _prev) => {
//   toDb(channelsLabel, curr);
// }, { deep: true });

// We keep the "current invoice" as the pay flow can be interrupted:
// - User can be redirected to the adaptor and channel setup
export const currentInvoice = ref<InvoiceInfo | null>(null);

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

