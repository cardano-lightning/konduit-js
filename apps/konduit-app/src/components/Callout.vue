<script lang="ts">
export type CalloutVariant = "info" | "warning" | "error" | "success" | "hint" | "critical" | "neutral" | "bug";

export type Props = {
  title: string;
  variant: CalloutVariant;
};
</script>

<script setup lang="ts">
import { Bug, Check, Info, TriangleAlert, Skull } from "lucide-vue-next";
import NotepadPen from "./icons/NotepadPen.vue";

const props = defineProps<Props>();
</script>

<template>
<div :class="['callout', props.variant]">
  <h2>
    <slot name="icon">
      <Bug v-if="props.variant === 'bug'" />
      <TriangleAlert v-if="props.variant === 'warning' || props.variant === 'error'" />
      <Check v-else-if="props.variant === 'success'" />
      <Info v-else-if="props.variant === 'info'" />
      <NotepadPen v-else-if="props.variant === 'hint'" />
      <Skull v-else-if="props.variant === 'critical'" />
    </slot>
    {{ props.title }}
  </h2>
  <div class="content">
  <slot />
  </div>
</div>
</template>

<style scoped>
.callout {
  border: 1px solid var(--frame-border-color);
  border-left: 0;
  border-right: 0;
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
  padding: var(--data-listing-gap) calc(var(--data-listing-gap) * 0.5);
  place-items: center;
}
  .callout h2 {
    align-items: center;
    display: flex;
    font-size: 1em;
    gap: calc(var(--data-listing-gap) * 0.5);
    margin: 0;
    padding: 0;
  }
    .callout h2 :deep(svg) {
      height: 1.2em;
      width: 1.2em;
      flex-shrink: 0;
    }

  .callout .content {
    line-height: 1.4em;
    margin: 0;
    padding: 0;
    text-align: center;
  }

    .callout .content svg {
      width: 0.2em;
      height: 0.2em;
      vertical-align: middle;
    }

.callout.error, .callout.bug, .callout.critical {
  background-color: var(--error-background-color);
  border-color: var(--error-border-color);
  color: var(--error-color);
}

.callout.info {
  background-color: var(--hint-background-color);
  border-color: var(--hint-border-color);
  color: var(--hint-color);
}

.callout.success {
  background-color: var(--success-background-color);
  border-color: var(--success-border-color);
  color: var(--success-color);
}

.callout.warning {
  background-color: var(--warning-background-color);
  border-color: var(--warning-border-color);
  color: var(--warning-color);
}

.callout.neutral {
  background-color: inherit;
  color: inherit;
  border-color: var(--frame-border-color);
}

.callout.hint {
  background-color: var(--hint-background-color);
  border-color: var(--hint-border-color);
  color: var(--hint-color);
}

</style>
