<script lang="ts">
export type SelectFieldType = "select";
export const select: SelectFieldType = "select";
</script>

<script setup lang="ts">
import type { Ref } from "vue";
import type { BaseFieldProps } from "./core"

export type UnboundProps = BaseFieldProps & {
  type: SelectFieldType;
  options: Array<{ value: string; label: string } | string>;
};

export type Props = UnboundProps & {
  name: string;
  state: Ref<string>;
}

const props = defineProps<Props>();
</script>

<template>
  <label :for="props.name">{{ props.label }}</label>
  <span class="select-wrapper">
    <select
      v-model="props.state.value"
      :class="{ error: props.isValid === false }"
      :disabled="props.disabled || options.length === 0"
    >
      <option
        v-for="opt in props.options"
        :key="typeof opt === 'string' ? opt : opt.value"
        :value="typeof opt === 'string' ? opt : opt.value"
      >
        {{ typeof opt === 'string' ? opt : opt.label }}
      </option>
    </select>
  </span>
</template>

<style scoped>
label {
  color: var(--primary-color);
  font-weight: normal;
  font-size: 1em;
  margin-bottom: 0.5em;
  display: block;
}

/*
input {
  background-color: var(--primary-background-color);
  border: 2px solid var(--frame-border-color);
  box-sizing: border-box;
  font-size: 1em;
  display: block;
  padding: 0.5em;
  width: 100%;
}

input:focus {
  border-color: var(--primary-color);
  outline: none;
}

input.error {
  border-color: var(--error-color);
}
*/
.select-wrapper {
  position: relative;
}
.select-wrapper:before {
  position: absolute;
  top: 50%;
  right: 0.5em;
  content: ' ';
  width: 0;
  height: 0;
  margin-top: -5px;
  border-style: solid;
  border-width: 8px 5px 0 5px;
  border-color: var(--frame-border-color) transparent transparent transparent;
  pointer-events: none;
}

.select-wrapper select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

select {
  background-color: var(--primary-background-color);
  border: 2px solid var(--frame-border-color);
  box-sizing: border-box;
  font-size: 1em;
  display: block;
  padding: 0.5em;
  width: 100%;
}

select:focus {
  border-color: var(--primary-color);
  border-radius: 0;
  outline: none;
}

select:disabled {
  background-color: oklch(from var(--primary-background-color) calc(l * 0.95) c h);
}
</style>
