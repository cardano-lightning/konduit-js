<script lang="ts">
export type OnClick = string | RouteLocationRaw | (() => void);
</script>

<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from 'vue-router';

interface Props {
  href: string;
  click?: OnClick;
}

const props = defineProps<Props>();
const router = useRouter();

const handleClick = (action: OnClick, event: MouseEvent) => {
  event.preventDefault();
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
<a :href="props.href" @click="props.click ? handleClick(props.click, $event) : null"><slot></slot></a>
</template>

<style scoped>
a {
  font-weight: 500;
  color: #646cff;
  text-decoration: none;
}
</style>

