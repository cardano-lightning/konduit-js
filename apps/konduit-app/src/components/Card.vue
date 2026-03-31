<script lang="ts">
export type CardVariant = "info" | "warning" | "error" | "success" | "tip" | "critical" | "neutral";

export type Props = {
  action?: () => void;
  disabled?: boolean;
  title: string;
  variant: CardVariant;
};
</script>

<script setup lang="ts">
import Check from "./icons/Check.vue";
import Info from "./icons/Info.vue";
import NotepadPen from "./icons/NotepadPen.vue";
import Skull from "./icons/Skull.vue";
import TriangleAlert from "./icons/TriangleAlert.vue";

const props = defineProps<Props>();
</script>

<template>
  <div
    :class="{
      'card': props.variant,
      'disabled': props.disabled || false,
    }"
    @click="props.action ? props.action() : null"
    :style="props.action ? (props.disabled ? 'not-allowed' : 'cursor: pointer;') : ''">
  <h2>
    <slot name="icon">
      <TriangleAlert v-if="props.variant === 'warning' || props.variant === 'error'" />
      <Check v-else-if="props.variant === 'success'" />
      <Info v-else-if="props.variant === 'info'" />
      <NotepadPen v-else-if="props.variant === 'tip'" />
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
.card {
  border: 0px solid var(--frame-border-color);
  /*
    border-left: 0;
    border-right: 0;
  */
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
  padding: var(--data-listing-gap) calc(var(--data-listing-gap) * 0.5);
  place-items: center;
}
  .card h2 {
    align-items: center;
    display: flex;
    font-size: 1em;
    gap: calc(var(--data-listing-gap) * 0.5);
    margin: 0;
    padding: 0;
  }
    .card h2 :deep(svg) {
      height: 1.2em;
      width: 1.2em;
      flex-shrink: 0;
    }

  .card .content {
    line-height: 1.4em;
    margin: 0;
    padding: 0;
    text-align: center;
  }

    .card .content svg {
      width: 0.2em;
      height: 0.2em;
      vertical-align: middle;
    }

.card {
  background-color: var(--focus-background-color);
  box-shadow: 0 2px 1px 0 rgba(0, 0, 0, 1), 0 3px 8px 0 rgba(0, 0, 0, 0.4);
  color: var(--focus-color);
}

.card:active {
  transform: translateY(1px);  /* "Push" down visually */
  box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.5), 0 2px 6px 0 rgba(0, 0, 0, 0.4);
  /* Optional: Darken background slightly for more "press" vibe */
  /* background-color: var(--button-pressed-bg);  /* e.g., a shade darker than normal */
}

.card.disabled {
  opacity: 0.6;
  pointer-events: none; /* Disable all interactions */
  cursor: not-allowed; /* Show "not allowed" cursor */
}

:root[data-theme="light"] .card,
:root[data-theme="system"][data-prefers-color="light"] .card {
  box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.6), 0 2px 15px 0 rgba(0, 0, 0, 0.05);
}

:root[data-theme="light"] .card:active,
:root[data-theme="system"][data-prefers-color="light"] .card:active {
  transform: translateY(1px);  /* "Push" down visually */
  box-shadow: 0 0px 0px 0 rgba(0, 0, 0, 1);
}
</style>
