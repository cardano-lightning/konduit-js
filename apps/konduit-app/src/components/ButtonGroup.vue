<script setup lang="ts">
import { computed, watch } from "vue";
import { type Props as ButtonProps } from "./Button.vue";
import Button from "./Button.vue";

export type Props = {
  buttons: ButtonProps[]
  style?: Record<string, string> | null | undefined
};

const props = defineProps<Props>();

const style = computed(() => {
  return props.style ?? {};
});

watch(() => props.buttons, (newVal: any) => {
  console.log('Buttons prop changed!', newVal)
}, { deep: true })

</script>

<template>
  <div class="button-group" :style="style">
    <Button
      v-for="(button, index) in props.buttons"
      :key="index"
      :disabled="button.disabled"
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
