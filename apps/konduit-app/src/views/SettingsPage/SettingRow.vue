<script setup lang="ts">
import Download from "../../components/icons/Download.vue";
import Pen from "../../components/icons/Pen.vue";
import Trash from "../../components/icons/Trash.vue";
import { useRouter, type RouteLocationRaw } from 'vue-router';

export type Action = RouteLocationRaw | (() => void);
type ActionIcon = "pen" | "download" | "trash";

interface Props {
  action?: Action;
  label: string;
  formattedValue: string;
  actionIcon?: ActionIcon;
}

const props = defineProps<Props>();
const router = useRouter();
const handleClick = () => {
  if (typeof props.action === "function") {
    props.action();
  } else if (typeof props.action == "string") {
    router.push({name: props.action});
  }
};
</script>

<template>
  <div class="config-row">
    <div class="data-pair">
      <dt>{{ props.label }}</dt>
      <dd>{{ props.formattedValue }}</dd>
    </div>
    <a class="edit" @click="handleClick" v-if="props.action">
      <Pen v-if="props.actionIcon === 'pen' || !props.actionIcon" />
      <Download v-else-if="props.actionIcon === 'download'" />
      <Trash v-else-if="props.actionIcon === 'trash'" />
    </a>
  </div>
</template>

<style scoped>
.config-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  width: 100%;
}
.data-pair {
  flex-grow: 1;
}

.data-pair dd {
  color: var(--secondary-color);
  font-size: 0.9rem;
  margin: 0.4rem 0;
  padding-left: 0;
}

a.edit {
  align-items: center;
  cursor: pointer;
  justify-content: center;
}

a.edit svg {
  color: var(--primary-color);
  stroke-width: 1.5;
}
</style>

