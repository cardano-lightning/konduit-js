import { computed, type Ref, ref, watch } from "vue";
import { z } from 'zod';
import { clearDb, fromDb, toDb } from "./store/db";
import { hex } from "@scure/base";

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

let initPromise: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (initPromise) return initPromise;
  let _init = async () => {
    await fromDb(signingKeyLabel, signingKey);
  };
  initPromise = _init();
  return initPromise;
}

export async function forget(): Promise<void> {
  signingKey.value = null;
  // This should be redundant as the whole state should be cleared
  // above.
  await clearDb();
}

const SettingsSchema = z.object({
  version: z.literal('0'),
  content: z.object({
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
      signingKey: hex.encode(signingKey.value!),
    },
  };
}
