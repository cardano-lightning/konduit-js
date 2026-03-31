<script lang="ts" setup>
import MissingDataPlaceholder from "./MissingDataPlaceholder.vue";
import DataRow from "./DataListing/DataRow.vue";
import type { Props as DataRowProps } from "./DataListing/DataRow.vue";
import Hr from "./Hr.vue";

export type RowConfig = DataRowProps | "separator";

export type Props = {
  rows: RowConfig[];
}
const props = defineProps<Props>();
</script>

<template>
  <dl v-if="props.rows.length > 0" class="data-listing">
    <template v-for="(row, index) in props.rows" :key="index">
      <DataRow
        v-if="row !== 'separator'"
        :label="row.label"
        :formatted-value="row.formattedValue"
        :actions="row.actions"
      />
      <Hr v-else class="separator" :subtle="true" />
    </template>
  </dl>
  <slot v-else name="empty"><MissingDataPlaceholder>Nothing to show yet.</MissingDataPlaceholder></slot>
</template>

<style scoped>
.data-listing {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
  margin: 0;
}
</style>
