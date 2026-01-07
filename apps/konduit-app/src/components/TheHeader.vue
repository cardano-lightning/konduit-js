<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

// Import the new, separate icon components
import KonduitLogo from "./KonduitLogo.vue";

// Define props
const props = defineProps<{
  subsection?: string;
}>();

// Get the current route and router instances
const route = useRoute();
const router = useRouter();
const isIndex = computed(() => route.path === "/");
const currentPageName = computed(() => {
  return route.meta.title || route.name || "Page";
});
</script>

<template>
  <header>
    <div v-if="isIndex">
      <h2>
        <KonduitLogo /> {{ currentPageName }}
        <template v-if="subsection"> | {{ subsection }}</template>
      </h2>
    </div>
    <div v-else class="back" aria-label="Go back" @click="router.back()">
      <h2>
        ⟨ {{ currentPageName }}
        <template v-if="subsection"> | {{ subsection }}</template>
      </h2>
    </div>
  </header>
</template>

<style scoped>
header {
  padding: 0.5rem;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  align-items: center;
}

header h2 {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back {
  cursor: pointer;
}
</style>
