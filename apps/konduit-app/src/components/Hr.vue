<script lang="ts" setup>
type Props = {
  subtle?: boolean;
}
const props = defineProps<Props>();
</script>

<template>
  <hr :class="{ subtle: props.subtle, hr: true }" />
</template>

<style scoped>
hr {
  border-style: solid;
  border-width: 1px 0 0 0;
  border-top-color: var(--separator-color);
  /* This could be a little 3D effect */
  /* border-bottom-color: white; */
  display: block;
  margin: 0;
  width: 100%;
}
hr.subtle {
  border-top-color: var(--separator-subtle-color);
}
</style>
