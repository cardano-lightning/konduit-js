import { computed, type ComputedRef, type Ref } from 'vue';
import { abbreviate } from "../utils/formatters";

export function useAbbreviate(value: Ref<string | null | undefined>, prefixLength: number=10, suffixLength: number = 10): ComputedRef<string> {
  return computed(() => {
    if (value.value == null) return '';
    return abbreviate(value.value, prefixLength, suffixLength);
  });
}
