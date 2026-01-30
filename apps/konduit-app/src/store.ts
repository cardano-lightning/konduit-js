import { defaultCardanoConnector } from "./env";
import { Connector } from "@konduit/konduit-consumer/cardano/connector";
import { ref, readonly, computed, watch } from 'vue'
import type { Ref } from "vue";
import { fromDb, toDb } from "./store/persistence";
import { CardanoConnectorWallet } from "@konduit/konduit-consumer/wallets/embedded";
import { json2KonduitConsumerAsyncCodec, KonduitConsumer } from "@konduit/konduit-consumer";
import { Seconds } from '@konduit/konduit-consumer/time/duration';
import type { Lovelace } from '../../../paluh/key-management/packages/konduit-consumer/dist/cardano';
import { err, ok, type Result } from 'neverthrow';
import type { JsonError } from '@konduit/codec/json/codecs';
import type { Json } from "@konduit/codec/json";

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

const _walletBalance = ref<Lovelace | null>(null);
export const walletBalance = readonly(_walletBalance);

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
  console.log("Loading KonduitConsumer from JSON");
  console.log(consumerJson);
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

  _subscriptions.push(consumer.wallet.subscribe('balance-changed', () => {
    _saveKonduitConsumer();
    _walletBalance.value = consumer.wallet.balance;
  }));
  _walletBalance.value = consumer.wallet.balance;

  _subscriptions.push(consumer.wallet.subscribe('backend-changed', async ({ newBackend }) => {
    _saveKonduitConsumer();
    _cardanoConnector.value = newBackend.connector
  }));
  _cardanoConnector.value = consumer.wallet.walletBackend.connector;

  consumer.wallet.startPolling(Seconds.fromSmallNumber(30));
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

// const SettingsSchema = z.object({
//   version: z.literal('0'),
//   content: z.object({
//     cardanoConnectorUrl: z.url().optional(),
//     cardanoNetwork: z.enum(['mainnet', 'testnet']),
//     signingKey: z.string(),
//   }),
// });
// 
// export type Settings = z.infer<typeof SettingsSchema>;
// 
// export type ImportSettingsResult =
//   | { type: 'success'; data: Settings }
//   | { type: 'error'; message: string };
// 
// export function importSettings(settings: unknown): ImportSettingsResult {
//   const result = SettingsSchema.safeParse(settings);
// 
//   if (!result.success) {
//     // Collect and display all errors (e.g., via alert or better UX like toasts)
//     const errorMessages = result.error.issues.map(issue => {
//       return `Field "${issue.path.join('.')}" is invalid: ${issue.message}`;
//     }).join('\n');
//     return { type: 'error', message: `Failed to import settings:\n${errorMessages}` };
//   }
// 
//   if (result.data.content.cardanoConnectorUrl) {
//     cardanoConnectorUrl.value = result.data.content.cardanoConnectorUrl;
//   } else {
//     cardanoConnectorUrl.value = null;
//   }
//   cardanoNetwork.value = result.data.content.cardanoNetwork;
// 
//   try {
//     signingKey.value = hex.decode(result.data.content.signingKey);
//   } catch (e) {
//     // alert(`Failed to import settings: ${(e as Error).message}`);
//     return { type: 'error', message: `Failed to import settings: ${(e as Error).message}` };
//   }
//   return { type: 'success', data: result.data };
// }
// 
// export function exportSettings(): Settings {
//   if(!signingKey.value) {
//     throw new Error("No signing key to export");
//   }
//   return {
//     version: '0',
//     content: {
//       cardanoConnectorUrl: cardanoConnectorUrl.value || undefined,
//       cardanoNetwork: cardanoNetwork.value,
//       signingKey: hex.encode(signingKey.value!),
//     },
//   };
// }
// 
// // export const walletBalance = ref(Lovelace);
// // 
// // watch(walletBalance, async (curr, _prev) => {
// //   if (appState.value != appStates.load) {
// //     await toDb(walletBalanceLabel, curr);
// //   }
// // });
// // 
// // /** Poll the wallet balance at the specified interval (in seconds)
// //  *  @param {number} interval - The polling interval in milliseconds.
// //  *  @returns a handle to stop the polling.
// //  */
// // export const pollWalletBalance = (interval) => {
// //   return setIntervalAsync(async () => {
// //     let connector = await cardanoConnector.value;
// //     walletBalance.value = await connector.balance(verificationKey.value);
// //   }, interval * 1000);
// // };
