<script lang="ts">
export type OnClick = string | RouteLocationRaw | (() => void);
</script>

<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from 'vue-router';
import SquareArrowOutUpRight from './icons/SquareArrowOutUpRight.vue';

interface Props {
  href: string;
  click?: OnClick;
  underscore?: boolean; // default: true
  showIcon?: boolean; // default: false
  useBold?: boolean; // default: false
}

const props = defineProps<Props>();
const router = useRouter();

const handleClick = (action: OnClick, event: MouseEvent) => {
  event.preventDefault();
  if (typeof action === "function") {
    action();
  } else if (typeof action === "string") {
    if (action.startsWith("http://") || action.startsWith("https://") || action.startsWith("mailto:")) {
      window.open(action, "_blank");
    } else {
      router.push({ name: action });
    }
  } else {
    router.push(action);
  }
};
</script>

<template>
  <a
    :href="props.href"
    :class="{ 'no-underline': props.underscore || true, 'bold': props.useBold }"
    @click="props.click ? handleClick(props.click, $event) : null"
  >
    <slot></slot>
    <SquareArrowOutUpRight v-if="props.showIcon" class="external-icon" />
  </a>
</template>

<style scoped>
a {
  font-weight: 500;
  color: inherit;
  text-decoration: underline;
}

.bold {
  font-weight: bold;
}

.no-underline {
  text-decoration: none;
}

.external-icon {
  display: inline-block;
  height: 1em;
  margin-left: 0.25em;
  vertical-align: middle;
  width: auto;
}
</style>
