<script setup lang="ts">
import { type Props as ButtonProps } from "./Button.vue";
import Button from "./Button.vue";

export type Props = { buttons: ButtonProps[] };

const props = defineProps<Props>();
</script>

<template>
  <div class="button-group">
    <Button
      v-for="(button, index) in props.buttons"
      :key="index"
      :label="button.label"
      :action="button.action"
      :primary="button.primary"
    />
  </div>
</template>

<style scoped>
.button-group {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  padding: 1rem 0;
}
</style>
