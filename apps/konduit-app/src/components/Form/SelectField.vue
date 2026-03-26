<script lang="ts">
export type SelectFieldType = "select";
export const select: SelectFieldType = "select";
</script>

<script setup lang="ts">
import type { Ref } from "vue";
import Info from "../icons/Info.vue";
import Link from "../Link.vue";
import { extractFieldErrorsMessages, type BaseFieldProps } from "./core"

export type UnboundProps = BaseFieldProps & {
  type: SelectFieldType;
  options: Array<{ value: string; label: string, disabled?: boolean } | string>;
};

export type Props = UnboundProps & {
  name: string;
  state: Ref<string>;
  touch: () => void;
}

const props = defineProps<Props>();
const hasErrors = (): boolean => {
  return extractFieldErrorsMessages(null, props.errors || []).length > 0;
};

const optionValue = (opt: string | { value: string; label: string, disabled?: boolean }): string => {
  return typeof opt === 'string' ? opt : opt.value;
};
</script>

<template>
  <label :for="props.name" v-if="props.label">
    <span>{{ props.label }}</span>
    <Link v-if="props.info" :href="'#'" @click="props.info" class="info"><Info /></Link>
  </label>
  <span class="select-wrapper">
    <select
      v-model="props.state.value"
      :class="{ error: props.isValid === false || hasErrors(), placeholder: optionValue(props.state.value) === '' }"
      :disabled="props.disabled || options.length === 0"
      @blur="props.touch()"
      @change="props.touch()"
    >
      <option
        v-for="opt in props.options"
        :key="typeof opt === 'string' ? opt : opt.value"
        :value="typeof opt === 'string' ? opt : opt.value"
        :disabled="typeof opt === 'string' ? false : opt.disabled"
        :class="optionValue(opt) == '' ? 'placeholder' : ''"
      >
        {{ typeof opt === 'string' ? opt : opt.label }}
      </option>
    </select>
  </span>
</template>

<style scoped>
/* We position text label on the left and the icon on the far right. */
label {
  color: var(--primary-color);
  display: flex;
  font-weight: normal;
  font-size: 1em;
  margin-bottom: 0.5em;
  padding: 0 0.25em;
}
  label .info {
    margin-left: auto;
    flex-shrink: 0;
  }
  label .info svg {
    color: var(--secondary-color);
    height: 1.1em;
    width: 1.1em;
  }

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
  border-color: var(--secondary-color) transparent transparent transparent;
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
select.placeholder {
  opacity: 0.5;
}

select.error {
  /* background-color: var(--error-background-color); */
  border-color: var(--error-border-color);
  /* color: var(--error-color); */
}

/* FIXME: This requires more debugging. The success state seems to toggle
* between two error states (`isValid` seems to be flipping to `true` during validation).
*/
/*
select.success {
  border-color: var(--success-border-color);
}
*/
</style>
