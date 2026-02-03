<script setup lang="ts">
import Download from "../../components/icons/Download.vue";
import Pen from "../../components/icons/Pen.vue";
import Copy from "../../components/icons/Copy.vue";
import ExternalLink from "../../components/icons/SquareArrowOutUpRight.vue";
import Trash from "../../components/icons/Trash.vue";
import { useRouter, type RouteLocationRaw } from 'vue-router';

export type ActionHandler = string | RouteLocationRaw | (() => void);
export type ActionIcon = "pen" | "download" | "trash" | "copy" | "external-link";
export type Action = [ActionHandler, ActionIcon];

interface Props {
  actions?: Action[];
  label: string;
  formattedValue: string;
}

const props = defineProps<Props>();
const router = useRouter();
const handleClick = (fullAction: Action, event: MouseEvent) => {
  event.preventDefault();
  const action = fullAction[0];
  console.log("Action clicked:", action);
  if (typeof action === "function") {
    action();
  } else if (typeof action == "string") {
    if(action.startsWith("http://") || action.startsWith("https://") || action.startsWith("mailto:")) {
      window.open(action, "_blank");
    } else {
      router.push({ name: action });
    }
  }
};
</script>

<template>
  <div class="config-row">
    <div class="data-pair">
      <dt>{{ props.label }}</dt>
      <dd>{{ props.formattedValue }}</dd>
    </div>
    <div v-if="props.actions">
      <a
        v-for="(action, index) in props.actions"
        :key="index"
        class="edit"
        :href="typeof action[0] === 'string' ? action[0] : '#'"
        @click="handleClick(action, $event)"
      >
        <Pen v-if="action[1] === 'pen' || !action[1]" />
        <Download v-else-if="action[1] === 'download'" />
        <Trash v-else-if="action[1] === 'trash'" />
        <Copy v-else-if="action[1] === 'copy'" />
        <ExternalLink v-else-if="action[1] === 'external-link'" />
      </a>
    </div>
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
  overflow: hidden;
}

.data-pair dt {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-pair dd {
  color: var(--secondary-color);
  display: block;
  font-size: 0.9rem;
  margin: 0.4rem 0;
  overflow: hidden;
  padding-left: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

a.edit {
  align-items: center;
  cursor: pointer;
  justify-content: center;
}

a.edit svg {
  color: var(--primary-color);
  stroke-width: 1.5;
  height: 1.2rem;
}
</style>

