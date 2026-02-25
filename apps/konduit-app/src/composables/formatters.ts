import { computed, toValue, type ComputedRef, type Ref } from 'vue';
import { abbreviate, MISSING_PLACEHOLDER } from "../utils/formatters";

// Reactive version of the `abbreviate` function
export function abbreviated(getter: () => Ref<string | null | undefined> | string | null | undefined, prefixLength: number=10, suffixLength: number = 10, placeholder=MISSING_PLACEHOLDER): ComputedRef<string> {
  return computed(() => {
    const value = toValue(getter());
    if (value == null) return placeholder;
    return abbreviate(value, prefixLength, suffixLength);
  });
}

