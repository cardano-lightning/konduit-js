<script lang="ts">
import type { Ref } from "vue";
import type { BaseFieldProps } from "./core"

export type TextFieldType = "text" | "email" | "password" | "tel" | "number" | "date" | "url";
export const text: TextFieldType = "text";
export const email: TextFieldType = "email";
export const password: TextFieldType = "password";
export const tel: TextFieldType = "tel";
export const number: TextFieldType = "number";
export const date: TextFieldType = "date";
export const url: TextFieldType = "url";
</script>

<script setup lang="ts">
export type UnboundProps = BaseFieldProps & {
  type: TextFieldType;
  placeholder?: string;
};

export type Props = UnboundProps & {
  name: string;
  state: Ref<string>;
  touch: () => void;
}

const props = defineProps<Props>();
</script>

<template>
  <label :for="props.name">{{ props.label }}</label>
  <input
    v-model="props.state.value"
    :type="props.type || 'text'"
    :placeholder="props.placeholder || ''"
    :class="{ error: props.isValid === false || (props.errors?.length || 0) > 0, success: props.isValid === true }"
    @blur="props.touch()"
  />
</template>

<style scoped>
label {
  color: var(--primary-color);
  font-weight: normal;
  font-size: 1em;
  margin-bottom: 0.5em;
  display: block;
}

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
  /* background-color: var(--error-background-color); */
  border-color: var(--error-border-color);
  /* color: var(--error-color); */
}

/* FIXME: This requires more debugging. The success state seems to toggle
* between two error states (`isValid` seems to be flipping to `true` during validation).
*/
/*
input.success {
  border-color: var(--success-border-color);
}
*/
</style>
