import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from "vue";
import { PollingInfo } from "@konduit/konduit-consumer/polling";
import { useDefaultFormatters } from "./l10n";
import { ValidDate } from "@konduit/konduit-consumer/time/absolute";
import { AnyPreciseDuration, Milliseconds, NormalisedDuration, Seconds } from "@konduit/konduit-consumer/time/duration";

const formatters = useDefaultFormatters();

type FormattingVariant = "long" | "short";

export const useFormattedLastSuccessfulSyncInfo = (
  pollingInfoRef: Ref<PollingInfo<any> | null>,
  formatingVariant: FormattingVariant = "short",
  infoUpdateFrequency: Seconds = Seconds.fromDigits(1, 5)
): ComputedRef<string> => {
  const now = ref(ValidDate.now());
  onMounted(() => {
    const interval = setInterval(() => {
      now.value = ValidDate.now();
    }, Milliseconds.fromSeconds(infoUpdateFrequency));
    onUnmounted(() => {
      clearInterval(interval);
    });
  });
  return computed(() => {
    if(pollingInfoRef.value?.lastSuccessfulFetch != null) {
      const secondsSinceLastSync = Seconds.fromDiffDates(
       now.value,
       pollingInfoRef.value.lastSuccessfulFetch.fetchedAt
      );
      if(secondsSinceLastSync == 0) return "Synced just now";

      let normalized = (() => {
       let normalized = NormalisedDuration.fromAnyPreciseDuration(AnyPreciseDuration.fromSeconds(secondsSinceLastSync));
       if(secondsSinceLastSync < 60) {
         return normalized;
       }
       return { ...normalized, seconds: Seconds.fromDigits(0) };
      })();
      if(formatingVariant === "short") {
        return `${formatters.formatDurationShort(normalized)} ago`;
      }
      return `Synced ${formatters.formatDurationLong(normalized)} ago`;
    }
    return "Not synced";
  });
};
