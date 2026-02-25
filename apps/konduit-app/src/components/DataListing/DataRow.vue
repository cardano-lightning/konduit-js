<script lang="ts">
export type ActionIcon = "pen" | "download" | "trash" | "copy" | "external-link";

export type Href = string;
export type Action =
  | [OnClick, ActionIcon]
  | { action: "copy", message: string, value: string | null }
  | { action: "external-link", url: string }

export type ValueImportance = "missing" | "important" | "very-important";
export type ValueConfig = string | {
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
import Download from "../../components/icons/Download.vue";
import Pen from "../../components/icons/Pen.vue";
import Copy from "../../components/icons/Copy.vue";
import ExternalLink from "../../components/icons/SquareArrowOutUpRight.vue";
import Trash from "../../components/icons/Trash.vue";
import Link from "../../components/Link.vue";
import type { OnClick } from "../../components/Link.vue";
import { useClipboard } from "@vueuse/core";
import { useNotifications } from "../../composables/notifications";

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
  }
};

const basicActions = props.actions?.map(toBasicAction);

</script>

<template>
  <div :class="'data-pair ' + (props.actions == undefined? 'without-actions':'with-actions')">
    <dt>
        <div class="label">{{ props.label }}</div>
        <div class="actions" v-if="props.actions">
          <Link
            v-for="(action, index) in basicActions"
            :key="index"
            class="edit"
            :href="action[1]"
            :click="action[0]"
          >
            <Pen v-if="action[2] === 'pen' || !action[2]" />
            <Download v-else-if="action[2] === 'download'" />
            <Trash v-else-if="action[2] === 'trash'" />
            <Copy v-else-if="action[2] === 'copy'" />
            <ExternalLink v-else-if="action[2] === 'external-link'" />
          </Link>
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
  align-items: center;
  display: flex;
  line-height: 1.2rem;
  gap: 0.3rem;
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
      gap: 0.3rem;
      flex: 0 0 auto;
      height: 1.2rem;
      text-align: right;
    }

      .data-pair dt .actions a {
        display: inline-block;
        line-height: 1.2rem;
      }

        .data-pair dt .actions a.edit {
          align-items: center;
          cursor: pointer;
          justify-content: center;
        }

          .data-pair dt .actions a.edit svg {
            color: var(--primary-color);
            stroke-width: 1.5;
            height: 1.2rem;
          }

  .data-pair dd {
    color: var(--secondary-color);
    font-size: 0.9rem;
    line-height: 1.2rem;
    overflow: hidden;
    margin-left: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
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

