import { computed, type ComputedRef, type Ref } from 'vue';
import { abbreviate, MISSING_PLACEHOLDER } from "../utils/formatters";

export function useAbbreviate(value: Ref<string | null | undefined>, prefixLength: number=10, suffixLength: number = 10, placeholder=MISSING_PLACEHOLDER): ComputedRef<string> {
  return computed(() => {
    if (value.value == null) return placeholder;
    return abbreviate(value.value, prefixLength, suffixLength);
  });
}
