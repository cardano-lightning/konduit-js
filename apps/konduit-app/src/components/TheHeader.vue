<script setup lang="ts">
import KonduitLogo from "./KonduitLogo.vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ChevronLeft from "./icons/ChevronLeft.vue";

// Define props
const props = defineProps<{
  backPageName?: string | (() => void);
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
  if(props.backPageName) {
    if(typeof props.backPageName === "function") {
      props.backPageName();
      return;
    }
    router.push({ name: props.backPageName });
  } else {
    router.back();
  }
};


</script>

<template>
  <header v-if="isIndex" class="index-header">
      <KonduitLogo />
  </header>
  <header v-else class="back" aria-label="Go back" @click="goBack">
    <h1><ChevronLeft /><span>{{ currentPageName }}</span><template v-if="subsection"><ChevronLeft /><span>{{ subsection }}</span></template></h1>
  </header>
</template>

<style scoped>
header {
  padding: var(--main-container-padding) 0 calc(var(--data-listing-gap) * 2);
}

header.index-header {
  /* font-size: 0.7rem; */
}
  header.index-header svg {
    height: 1.8em;
    width: auto;
  }

  header h1 {
    display: flex;
    font-weight: normal;
    font-size: 1.5rem;
    margin: 0;
    padding: 0;
    vertical-align: middle;
  }

    header h1 svg {
      flex: 0 0 auto;
      display: inline-block;
      height: 1em;
      width: auto;
    }

    header h1 svg,
    header h1 span {
      vertical-align: middle;
    }

    header h1 span {
      flex: 1 1 auto;
      margin-left: -0.5rem;
      text-align: center;
    }

.back {
  cursor: pointer;
}
</style>
