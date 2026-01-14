import { computed, type Ref, ref, watch } from "vue";
import { z } from 'zod';
import { clearDb, fromDb, toDb } from "./store/db";
import { hex } from "@scure/base";
import { Channel } from "@konduit/konduit-consumer";
// import type { Lovelace } from "@konduit/cardano";

export type AppPhase = "loading" | "launching" | "running";

export const appPhase: Ref<AppPhase> = ref<AppPhase>("loading");

const signingKeyLabel: string = "signingKey";

export const signingKey: Ref<Uint8Array | null> = ref(null);

export const hasSigningKey = computed(() => {
  return signingKey.value !== null;
});

watch(signingKey, async (curr, _prev) => {
  toDb(signingKeyLabel, curr);
  appPhase.value = curr ? "running" : "launching";
});

const channelsLabel = "channels";

export const channels: Ref<Channel[]> = ref<Channel[]>([]);

export function appendChannel(channel: Channel): void {
  channels.value = [...channels.value, channel];
}

watch(channels, async (curr, _prev) => {
  toDb(channelsLabel, curr);
}, { deep: true });

const cardanoConnectorUrlLabel = "cardanoConnectorUrl";

export const cardanoConnectorUrl: Ref<string | null> = ref<string | null>(null);

watch(cardanoConnectorUrl, async (curr, _prev) => {
  toDb(cardanoConnectorUrlLabel, curr);
});

export const cardanoNetwork: Ref<"mainnet" | "testnet"> = ref<"mainnet" | "testnet">("mainnet");

watch(cardanoNetwork, async (curr, _prev) => {
  toDb("cardanoNetwork", curr);
});

let initPromise: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (initPromise) return initPromise;
  let _init = async () => {
    await fromDb(signingKeyLabel, signingKey);
    await fromDb(channelsLabel, channels);
  };
  initPromise = _init();
  return initPromise;
}

export async function forget(): Promise<void> {
  signingKey.value = null;
  channels.value = [];
  // This should be redundant as the whole state should be cleared
  // above.
  await clearDb();
}

// FIXME: In other parts of the codebase we use a rather manual
// and direct way to parsing and data validation.
// We should standardize on using zod or revert to the manual way here.
const SettingsSchema = z.object({
  version: z.literal('0'),
  content: z.object({
    cardanoConnectorUrl: z.url().optional(),
    cardanoNetwork: z.enum(['mainnet', 'testnet']),
    signingKey: z.string(),
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;

export type ImportSettingsResult =
  | { type: 'success'; data: Settings }
  | { type: 'error'; message: string };

export function importSettings(settings: unknown): ImportSettingsResult {
  const result = SettingsSchema.safeParse(settings);

  if (!result.success) {
    // Collect and display all errors (e.g., via alert or better UX like toasts)
    const errorMessages = result.error.issues.map(issue => {
      return `Field "${issue.path.join('.')}" is invalid: ${issue.message}`;
    }).join('\n');
    return { type: 'error', message: `Failed to import settings:\n${errorMessages}` };
  }

  if (result.data.content.cardanoConnectorUrl) {
    cardanoConnectorUrl.value = result.data.content.cardanoConnectorUrl;
  } else {
    cardanoConnectorUrl.value = null;
  }
  cardanoNetwork.value = result.data.content.cardanoNetwork;

  try {
    signingKey.value = hex.decode(result.data.content.signingKey);
  } catch (e) {
    // alert(`Failed to import settings: ${(e as Error).message}`);
    return { type: 'error', message: `Failed to import settings: ${(e as Error).message}` };
  }
  return { type: 'success', data: result.data };
}

export function exportSettings(): Settings {
  if(!signingKey.value) {
    throw new Error("No signing key to export");
  }
  return {
    version: '0',
    content: {
      cardanoConnectorUrl: cardanoConnectorUrl.value || undefined,
      cardanoNetwork: cardanoNetwork.value,
      signingKey: hex.encode(signingKey.value!),
    },
  };
}

// export const walletBalance = ref(Lovelace);
// 
// watch(walletBalance, async (curr, _prev) => {
//   if (appState.value != appStates.load) {
//     await toDb(walletBalanceLabel, curr);
//   }
// });
// 
// /** Poll the wallet balance at the specified interval (in seconds)
//  *  @param {number} interval - The polling interval in milliseconds.
//  *  @returns a handle to stop the polling.
//  */
// export const pollWalletBalance = (interval) => {
//   return setIntervalAsync(async () => {
//     let connector = await cardanoConnector.value;
//     walletBalance.value = await connector.balance(verificationKey.value);
//   }, interval * 1000);
// };
