import { onMounted, onUnmounted, ref, watch, computed, type Ref, type ComputedRef } from "vue";
import { fromDb, toDb } from "../store/persistence";
import {
  KrakenTickersResponse,
  mkKrakenClient,
  mkKrakenFxFromTickers,
} from "@konduit/konduit-consumer/kraken";
import { mkJson2FetchResultCodec, PollingInfo, type FetchResult } from "@konduit/konduit-consumer/polling";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { Seconds } from "@konduit/konduit-consumer/time/duration";
import { Milliseconds } from "@konduit/konduit-consumer/time/duration";
import type { Result } from "neverthrow";
import type { JsonCodec, JsonError } from "@konduit/codec/json/codecs";
import type { Fx } from "@konduit/konduit-consumer/fx";

const krakenTickersLabel="kraken-tickers";
const tickersInfo = ref(new PollingInfo(null)) as Ref<PollingInfo<KrakenTickersResponse>>;

const pollingInfoCodec:JsonCodec<FetchResult<KrakenTickersResponse> | null> =
  jsonCodecs.nullable(mkJson2FetchResultCodec(KrakenTickersResponse.jsonCodec));
watch(tickersInfo, async (curr: PollingInfo<KrakenTickersResponse>) => {
  const lastFetch: FetchResult<KrakenTickersResponse> | null = curr.lastFetch;
  const json = pollingInfoCodec.serialise(lastFetch);
  await toDb(krakenTickersLabel, json);
});

// Polls the default set of tickers from kraken
export const useKrakenTickers = (
  intervalSeconds: Seconds,
  baseUrl?: string,
) => {
  const client = mkKrakenClient(baseUrl);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const scheduleNext = () => {
    if (intervalSeconds > 0 && !cancelled) {
      timeoutId = setTimeout(fetchOnce, Milliseconds.fromSeconds(intervalSeconds));
    }
  };

  const fetchOnce = async () => {
    const res = await client.getTickers();
    tickersInfo.value = tickersInfo.value.mkSuccessor(res as Result<KrakenTickersResponse, JsonError>);

    scheduleNext();
  };

  onMounted(async () => {
    const stored = await fromDb(krakenTickersLabel);
    if (stored) {
      pollingInfoCodec.deserialise(stored).map((lastFetch) => {
        tickersInfo.value = new PollingInfo(lastFetch)
      });
    }
    fetchOnce();
  });

  onUnmounted(() => {
    cancelled = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  });

  return {
    tickersInfo,
  };
};

export const useKrakenFx = (
  intervalSeconds: Seconds,
  baseUrl?: string,
): { tickersInfo: Ref<PollingInfo<KrakenTickersResponse | null>>; krakenFx: ComputedRef<Fx | null> } => {
  const { tickersInfo } = useKrakenTickers(intervalSeconds, baseUrl);

  const krakenFx: ComputedRef<Fx | null> = computed(() => {
    if (tickersInfo.value && tickersInfo.value.lastValue) {
      return mkKrakenFxFromTickers(tickersInfo.value.lastValue);
    }
    return null;
  });

  return {
    tickersInfo,
    krakenFx,
  };
};
