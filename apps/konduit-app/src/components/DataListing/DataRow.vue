<script lang="ts">
export type ActionIcon = "pen" | "download" | "trash" | "copy" | "external-link" | "loading" | "info" | "wallet" | "konduit" | "share" | "chevron-right";

export type Href = string;
export type Action =
  | [OnClick, ActionIcon]
  | { action: "copy", message: string, value: string | null }
  | { action: "external-link", url: string }
  | { action: "loading" }
  | { action: "share", value: string, title?: string };

export type ValueImportance = "missing" | "important" | "very-important";
export type ValueConfig =
  string
  | {
    string: string;
    importance: ValueImportance;
  }
export type Props = {
  // If there is only a single action then the whole row becomes clickable.
  actions?: Action[] | { rowAction: Action };
  label: string;
  formattedValue: ValueConfig;
}

const shareSupported = "share" in navigator;

async function doShare(action: { value: string, title?: string }) {
  if(!shareSupported) return;
  await navigator.share({ text: action.value, title: action.title || "Konduit Data" })
}

</script>

<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import ClockThrobber from "../ClockThrobber.vue";
import Copy from "../icons/Copy.vue";
import Download from "../icons/Download.vue";
import ExternalLink from "../icons/SquareArrowOutUpRight.vue";
import Info from "../icons/Info.vue";
import Konduit from "../icons/Konduit.vue";
import Link from "../Link.vue";
import { mkClickHandler } from "../Link.vue";
import Pen from "../icons/Pen.vue";
import Trash from "../icons/Trash.vue";
import WalletMinimal from "../icons/WalletMinimal.vue";
import { Share2 } from "lucide-vue-next";
import type { OnClick } from "../Link.vue";
import { useClipboard } from "@vueuse/core";
import { useNotifications } from "../../composables/notifications";
import { computed } from "vue";
import { useRouter } from "vue-router";

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
    case "share":
      return [() => doShare(action), "#", "share"];
  }
};

const basicActions = computed(() => {
  // props.actions?.map(toBasicAction)
  if(Array.isArray(props.actions)) {
    const actions: Action[] = props.actions;
    return actions.map(toBasicAction);
  } else if(props.actions && "rowAction" in props.actions) {
    return [toBasicAction(props.actions.rowAction)];
  } else {
    return null;
  }
});

const router = useRouter();

const rowOnClick = computed(() => {
  if(props.actions && !Array.isArray(props.actions) && "rowAction" in props.actions) {
    const onClick: OnClick = toBasicAction(props.actions.rowAction)[0];
    return mkClickHandler(router, onClick);
  }
});

</script>

<template>
  <div
    :class="{
      'data-pair': true,
      'without-actions': props.actions == undefined,
      'with-actions': props.actions != undefined,
      'row-clickable': rowOnClick,
    }"
    @click="rowOnClick?rowOnClick($event):undefined"
  >
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
              <ChevronRight v-else-if="action[2] === 'chevron-right'" />
              <Download v-else-if="action[2] === 'download'" />
              <ExternalLink v-else-if="action[2] === 'external-link'" />
              <Info v-else-if="action[2] === 'info'" />
              <Konduit v-else-if="action[2] === 'konduit'" />
              <Pen v-else-if="action[2] === 'pen' || !action[2]" />
              <Share2 v-else-if="action[2] === 'share' && shareSupported" />
              <Trash v-else-if="action[2] === 'trash'" />
              <WalletMinimal v-else-if="action[2] === 'wallet'" />
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
.data-pair.row-clickable {
  cursor: pointer;
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

