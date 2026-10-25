<script lang="ts">
export type Progress =
  | { type: 'submitting' }
  | { type: 'submitted' }
  | { type: 'on-chain'; txHash: string }
  | { type: 'approved' };

export type Props = {
  progress: Progress;
};
</script>

<script setup lang="ts">
import Callout from "./Callout.vue";
import Link from "./Link.vue";
import Square from "./icons/Square.vue";
import SquareCheckBig from "./icons/SquareCheckBig.vue";
import BatteryThrobber from "./BatteryThrobber.vue";
const props = defineProps<Props>();
</script>

<template>
  <Callout
    :title="'Lightning charging in progress'"
    :variant="'info'"
  >
    <template #icon>
      <BatteryThrobber />
    </template>
    <!-- Should we add this: It usually takes just a few minutes. -->
    <ul id="opening-steps">
      <li>
        <template v-if="props.progress.type === 'submitting'">
          <Square />
          Submitting the opening transaction&hellip;
        </template>
        <template v-else>
          <SquareCheckBig />
          The opening transaction was submitted.
        </template>
      </li>
      <li>
        <template v-if="props.progress.type === 'on-chain'">
          <SquareCheckBig />
          FIXME: LINK
          The transaction <Link :href="'#'" :use-bold="true" :show-icon="true">was&nbsp;confirmed</Link>.
        </template>
        <template v-if="props.progress.type === 'submitted'">
          <Square />
          Opening transaction is being added to the chain
        </template>
        <template v-if="props.progress.type === 'submitting'">
          <Square />
          Waiting for the transaction to be submitted
        </template>
      </li>
      <li><Square /> The adaptor approved the channel.</li>
    </ul>
  </Callout>
</template>
