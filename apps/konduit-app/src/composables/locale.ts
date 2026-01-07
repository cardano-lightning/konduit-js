import { ref, type Ref } from 'vue';
import type { Tagged } from 'type-fest';

export type Locale = Tagged<string, 'Locale'>;

// FIXME?
// Currently we don't provide app level locale settings.
// This tiny layer allows us to change that in the future more easily.
export function useLocale(): Ref<Locale> {
  const locale: Ref<Locale> = ref((navigator.language || 'en-US' ) as Locale);
  return locale;
}
