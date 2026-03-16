<script setup lang="ts">
import KonduitLogo from "./KonduitLogo.vue";
import { computed } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import ChevronLeft from "./icons/ChevronLeft.vue";

// Define props
const props = defineProps<{
  back?: string | (() => void) | RouteLocationRaw;
  title?: string;
  subsection?: string;
}>();

// Get the current route and router instances
const route = useRoute();
const router = useRouter();
const isIndex = computed(() => route.path === "/");
const currentPageName = computed(() => {
  return props.title || route.meta.title || route.name || "Page";
});

const goBack = () => {
  if (props.back) {
    if (typeof props.back === "function") {
      props.back();
      return;
    } else if (typeof props.back === "string") {
      router.push({ name: props.back });
      return;
    } else {
      router.push(props.back);
      return;
    }
  } else {
    router.back();
  }
};
</script>

<template>
  <header v-if="isIndex" class="index-header">
    <h1><KonduitLogo /></h1>
    <div class="header-right">
      <slot name="header-right" />
    </div>
  </header>
  <header v-else class="regular-header" aria-label="Go back">
    <div class="header-left" @click="goBack">
      <ChevronLeft />
    </div>
    <h1>
      <span>{{ currentPageName }}</span>
      <template v-if="subsection">
        <ChevronLeft />
        <span>{{ subsection }}</span>
      </template>
    </h1>
    <div class="header-right">
      <slot name="header-right" />
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  font-size: 1.5rem;
  padding: var(--main-container-padding) 0 calc(var(--data-listing-gap) * 2);
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

/* Special sizing for the Konduit logo on index header */
header.index-header h1 :deep(svg.konduit-logo) {
  height: 1.8rem;
}

</style>
