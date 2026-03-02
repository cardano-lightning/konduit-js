<script lang="ts">
export type ActionIcon = "pen" | "download" | "trash" | "copy" | "external-link" | "loading" | "info";

export type Href = string;
export type Action =
  | [OnClick, ActionIcon]
  | { action: "copy", message: string, value: string | null }
  | { action: "external-link", url: string }
  | { action: "loading" }

export type ValueImportance = "missing" | "important" | "very-important";
export type ValueConfig =
  string
  | {
    string: string;
    importance: ValueImportance;
  }
export type Props = {
  actions?: Action[];
  label: string;
  formattedValue: ValueConfig;
}

</script>

<script setup lang="ts">
import ClockThrobber from "../ClockThrobber.vue";
import Copy from "../icons/Copy.vue";
import Download from "../icons/Download.vue";
import ExternalLink from "../icons/SquareArrowOutUpRight.vue";
import Info from "../icons/Info.vue";
import Link from "../Link.vue";
import Pen from "../icons/Pen.vue";
import Trash from "../icons/Trash.vue";
import type { OnClick } from "../Link.vue";
import { useClipboard } from "@vueuse/core";
import { useNotifications } from "../../composables/notifications";
import { computed } from "vue";

const props = defineProps<Props>();

//* Copy button
const clipboard = useClipboard();
const notifications = useNotifications();

const mkCopyHandler = (message: string, value: string | null) => () => {
  if (!value) return;
  clipboard.copy(value);
  notifications.success(message);
};

type BasicAction = [OnClick, Href, ActionIcon]

const toBasicAction = (action: Action): BasicAction => {
  if (Array.isArray(action)) {
    if(typeof action[0] === "string")
      return [action[0], action[0], action[1]];
    else
      return [action[0], "#", action[1]];
  }
  switch (action.action) {
    case "copy":
      return [mkCopyHandler(action.message, action.value), "#", "copy"];
    case "external-link":
      return [action.url, action.url, "external-link"];
    case "loading":
      return ["", "#", "loading"];
  }
};

const basicActions = computed(() => props.actions?.map(toBasicAction));

</script>

<template>
  <div :class="'data-pair ' + (props.actions == undefined? 'without-actions':'with-actions')">
    <dt>
        <div class="label">{{ props.label }}</div>
        <div class="actions" v-if="props.actions">
          <template v-for="(action, index) in basicActions">
            <ClockThrobber class="edit" v-if="action[2] === 'loading'" />
            <Link
              v-else
              :key="index"
              class="edit"
              :href="action[1]"
              :click="action[0]"
            >
              <Copy v-if="action[2] === 'copy'" />
              <Download v-else-if="action[2] === 'download'" />
              <ExternalLink v-else-if="action[2] === 'external-link'" />
              <Info v-else-if="action[2] === 'info'" />
              <Pen v-else-if="action[2] === 'pen' || !action[2]" />
              <Trash v-else-if="action[2] === 'trash'" />
            </Link>
          </template>
        </div>
    </dt>
    <dd v-if="typeof props.formattedValue == 'string'">
      {{ props.formattedValue }}
    </dd>
    <dd v-else :class="props.formattedValue.importance">
      {{ props.formattedValue.string }}
    </dd>
  </div>
</template>

<style scoped>
.data-pair {
  align-items: left;
  display: flex;
  line-height: 1.2rem;
  gap: calc(var(--data-listing-gap) / 3);
  overflow: hidden;
  width: 100%;
}
.data-pair.with-actions {
  flex-direction: column;
}
.data-pair.without-actions {
  flex-direction: row;
}
  .data-pair dt {
    display: flex;
    flex-direction: row;
    width: 100%;
  }
    .data-pair dt .label {
      flex-grow: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* FIXME: This repeated height: 1.2rem is probably not optimal
     * styling. Please retest that and possibly refactor.
     */
    .data-pair dt .actions {
      display: flex;
      gap: 0.38rem;
      flex: 0 0 auto;
      height: 1.2rem;
      text-align: right;
    }

      .data-pair dt .actions .edit {
        align-items: center;
        display: inline-block;
        justify-content: center;
        line-height: 1.2rem;
      }

      .data-pair dt .actions a.edit {
        cursor: pointer;
      }

        .data-pair dt .actions .edit svg {
          color: var(--primary-color);
          stroke-width: 1.5;
          height: 1.2rem;
        }

  .data-pair dd {
    color: var(--secondary-color);
    font-size: 1.0rem;
    line-height: 1.2rem;
    overflow: hidden;
    margin-left: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 90%;
  }
  .data-pair.without-actions dd {
    text-align: right;
  }
  .data-pair.with-actions dd {
    text-align: left;
  }
  .data-pair dd.missing {
    color: var(--missing-data-color);
    font-style: italic;
  }
  .data-pair dd.important {
    font-size: 1rem;
    font-weight: 600;
  }
  .data-pair dd.very-important {
    font-weight: 700;
  }
</style>

