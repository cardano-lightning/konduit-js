<script lang="ts">
import { extractFieldErrorsMessages, type BaseFieldProps } from "./core";
import type { Ref } from "vue";

export type RadioFieldType = "radio";
export const radio: RadioFieldType = "radio";

export type Option =
  | {
    value: string;
    label: string;
    disabled?: boolean;
    icon?: string;
  }
  | string;

export type Layout =
  | { type: "stacked" }
  | { type: "inline"; maxItemsPerRow?: number };

export type UnboundProps = BaseFieldProps & {
  type: RadioFieldType;
  options: Array<Option>;
  layout?: Layout;
};

export type Props = UnboundProps & {
  name: string;
  state: Ref<string>;
  touch: () => void;
};

</script>

<script setup lang="ts">
const props = defineProps<Props>();

function optValue(opt: Option): string {
  return typeof opt === "string" ? opt : opt.value;
}

function optLabel(opt: Option): string {
  return typeof opt === "string" ? opt : opt.label;
}

function optIcon(opt: Option): string | undefined {
  return typeof opt === "string" ? undefined : opt.icon;
}

const hasErrors = (opt: Option): boolean => {
  const value = optValue(opt);
  return extractFieldErrorsMessages(value, props.errors || []).length > 0;
};

</script>

<template>
  <fieldset
    :class="['radio-group', props.layout?.type? props.layout.type:'stacked']"
    :style="{
      '--max-items-per-row': props.layout && props.layout.type === 'inline' ?
        (props.layout.maxItemsPerRow || 3)
        : 'auto'
    }"
  >
    <div class="radio-options">
      <div
        v-for="opt in props.options"
        :key="optValue(opt)"
        class="radio-option"
      >
        <!--
        <input
          :id="`${props.name}-${optValue(opt)}`"
          v-model="props.state.value"
          type="radio"
          :name="props.name"
          :value="optValue(opt)"
          :disabled="props.disabled || optDisabled(opt)"
          :class="{ 'visually-hidden': !!optIcon(opt) }"
          @change="props.touch()"
        />
        <label :for="`${props.name}-${optValue(opt)}`">
          <img
            v-if="optIcon(opt)"
            :src="optIcon(opt)"
            :alt="optLabel(opt)"
            class="radio-icon"
          />
          <span v-else>{{ optLabel(opt) }}</span>
          <span v-if="optIcon(opt)" class="radio-icon-label">{{ optLabel(opt) }}</span>
        </label>
        -->
        <label
          :key="optValue(opt)"
          :class="{ 'has-icon': !!optIcon(opt), 'radio-option': true, error: hasErrors(opt) }"
        >
          <input
            type="radio"
            v-model="props.state.value"
            :name="props.name"
            :value="typeof opt === 'string' ? opt : opt.value"
            :disabled="props.disabled || (typeof opt === 'string' ? false : opt.disabled)"
            :class="{ 'visually-hidden': !!optIcon(opt) }"
            @change="props.touch()"
          />
          <img
            v-if="optIcon(opt)"
            :src="optIcon(opt)"
            :alt="optLabel(opt)"
            class="radio-icon"
          />
          {{ optLabel(opt) }}
        </label>
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
fieldset {
  border: none;
  margin: 0;
  padding: 0;
}

legend {
  color: var(--primary-color);
  font-weight: normal;
  font-size: 1em;
  margin-bottom: 0.5em;
  display: block;
  padding: 0;
}

.stacked .radio-options {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

.inline .radio-options {
  display: grid;
  gap: 1em;
  grid-template-columns: repeat(var(--max-items-per-row), 1fr);
  padding: 1em;
}
.radio-option {
  display: flex;
}
.radio-option label {
  cursor: pointer;
  align-items: center;
  gap: 0.5em;
  text-align: center;
}
.has-icon .radio-icon {
  border: 2px solid var(--frame-border-color);
  filter: grayscale(100%);
  height: 1.5em;
  object-fit: contain;
  opacity: 0.6;
  padding: 0.25em;
  transition: filter 0.2s, opacity 0.2s;
  width: 1.5em;
}

.has-icon input:checked + .radio-icon {
  border-color: var(--primary-color);
  filter: grayscale(0%);
  opacity: 1;
}

.has-icon.error img.radio-icon {
  border-color: var(--error-border-color);
}


input.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
