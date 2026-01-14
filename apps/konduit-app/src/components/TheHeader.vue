<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ChevronLeft from "./icons/ChevronLeft.vue";

// Import the new, separate icon components
import KonduitLogo from "./KonduitLogo.vue";

// Define props
const props = defineProps<{
  backPageName?: string;
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
    router.push({ name: props.backPageName });
  } else {
    router.back();
  }
};


</script>

<template>
  <header v-if="isIndex" class="index-header">
    <h1><KonduitLogo /> {{ currentPageName }}<template v-if="subsection"> | {{ subsection }}</template></h1>
  </header>
  <header v-else class="back" aria-label="Go back" @click="goBack">
    <h1><ChevronLeft /><span>{{ currentPageName }}</span><template v-if="subsection"><ChevronLeft /><span>{{ subsection }}</span></template></h1>
  </header>
</template>

<style scoped>
header {
  padding: 0.5rem;
}

header h1 {
  font-weight: normal;
  font-size: 1.5rem;
  vertical-align: middle;
}

header h1 svg {
  display: inline-block;
  height: 1em;
  margin-right: 1.5rem;
  width: auto;
}

header h1 svg,
header h1 span {
  vertical-align: middle;
}

header.index-header h1 svg {
  height: 3.5em;
}

.back {
  cursor: pointer;
}
</style>
