<script setup lang="ts">
import KonduitLogo from "./KonduitLogo.vue";
import { computed } from "vue";
import { useRoute, type RouteLocationRaw } from "vue-router";
import ChevronLeft from "./icons/ChevronLeft.vue";
import CurrencySwitch from "./CurrencySwitch.vue";
import { useFx } from "../composables/fx";
import { useAppBack } from "../composables/history";

// Define props
const props = defineProps<{
  back?: string | RouteLocationRaw | [string | RouteLocationRaw, (event: MouseEvent) => void];
  title?: string;
  showFxCurrencySwitcher?: boolean;
  styling?: {
    noMarginBottom?: boolean;
    noBorderBottom?: boolean;
  },
  subsection?: string;
}>();

// Get the current route and router instances
const route = useRoute();
const isIndex = computed(() => route.path === "/");
const currentPageName = computed(() => {
  return props.title || route.meta.title || route.name || "Page";
});

const fx = useFx();

const backTarget = computed((): RouteLocationRaw | null => {
  if (!props.back) return null
  if (typeof props.back === 'string') return props.back
  if (Array.isArray(props.back)) return props.back[0];
  return null
})

const appBack = useAppBack(backTarget)

const handleBackClick = (e: MouseEvent) => {
  if (Array.isArray(props.back)) {
    props.back[1]?.(e)          // extra handler
  }
  appBack.handleClick(e)
}

const back = {
  href: appBack.href,
  handleClick: handleBackClick
} as const

const headerClasses = computed(() => {
  return {
    'index-header': isIndex.value,
    'regular-header': !isIndex.value,
    'no-margin-bottom': props.styling?.noMarginBottom,
    'no-border-bottom': props.styling?.noBorderBottom
  };
});
</script>

<template>
  <header
    v-if="isIndex"
    :class="headerClasses"
    aria-label="Home"
  >
    <div v-if="isIndex" class="header-left">&nbsp;</div>
    <h1><KonduitLogo /></h1>
    <div class="header-right">
      <slot name="header-right">
      <CurrencySwitch v-model="fx.currentCurrency.value" v-if="props.showFxCurrencySwitcher" />
      </slot>
    </div>
  </header>
  <header v-else class="regular-header" aria-label="Go back">
    <a class="header-left" @click="back.handleClick" href="back.href">
      <ChevronLeft />
    </a>
    <h1>
      <span>{{ currentPageName }}</span>
      <template v-if="subsection">
        <ChevronLeft />
        <span>{{ subsection }}</span>
      </template>
    </h1>
    <div class="header-right">
      <slot name="header-right">
      <CurrencySwitch v-model="fx.currentCurrency.value" v-if="props.showFxCurrencySwitcher" />
      </slot>
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  font-size: 1.5rem;
  margin-bottom: var(--data-listing-gap);
  padding: var(--main-container-padding) 0 var(--data-listing-gap);
}

header .header-left,
header .header-right {
  flex: 0 0 auto;
}

header .header-left {
  cursor: pointer;
}

  header .header-left :deep(svg),
  header .header-right :deep(svg) {
    height: 1.2rem;
    stroke: var(--primary-color);
    stroke-width: 1.5;
  }

header h1 {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  font-size: inherit;
  font-weight: normal;
  justify-content: center;
  margin: 0;
  padding: 0;
  text-align: center;
}

  header.regular-header h1 :deep(svg) {
    flex-grow: 0;
    stroke: var(--primary-color) !important;
  }

header {
  border-bottom: 1px solid var(--frame-border-color);
}
header.no-border-bottom {
  border-bottom: none;
}
header.no-margin-bottom {
  margin-bottom: 0;
}
/* Special sizing for the Konduit logo on index header */
header.index-header h1 :deep(svg.konduit-logo) {
  height: 2.5rem;
}
header.index-header .header-left,
header.index-header .header-right {
  min-width: 1.5rem;
}
header.index-header .header-right {
  text-align: right;
}
header.index-header .header-left {
  text-align: left;
}
</style>
