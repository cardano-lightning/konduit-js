<script setup lang="ts">
import { stringify, type Json } from "@konduit/codec/json";
import * as env from "../env";
import Callout, { type CalloutVariant } from "./Callout.vue";

const debug = env.debugMode;

type Props = {
  debugInfo: Json | null;
};

const props = defineProps<Props>();
</script>

<template>
  <Callout
    v-if="props.debugInfo && debug"
    :variant="'warning' as CalloutVariant"
    :title="'Debug information'"
  >
    <p>Here are some debugging details that might be helpful for troubleshooting:</p>
    <pre class="debug-info">{{ stringify(props.debugInfo) }}</pre>
  </Callout>
</template>

<style scoped>
.debug-info {
  background: var(--background-color);
  font-family: monospace;
  font-size: 0.8em;
  margin-top: calc(var(--data-listing-gap) * 0.5);
  max-height: 20em;
  overflow: auto;
  padding: calc(var(--data-listing-gap) * 0.5);
  text-align: left;
/* wrap long lines and break the words if needed */
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
