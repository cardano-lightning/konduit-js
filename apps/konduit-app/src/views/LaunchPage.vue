<script setup lang="ts">
import KonduitLogo from "../components/KonduitLogo.vue";
import { type Props as ButtonProps } from "../components/Button.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import { loadJson } from "../utils/dom";
import { useNotifications } from "../composables/notifications";
import * as store from "../store";
import type { JsonError } from "@konduit/codec/json/codecs";
import { stringify } from "@konduit/codec/json";
import { useRouter } from "vue-router";

const notifications = useNotifications();

const loadKonduitConsumerJson = async () => {
  const jsonData = await loadJson();
  jsonData.match(
    async (json) => {
      const result = await store.loadKonduitConsumerFromJson(json);
      result.match(
        () => notifications.redirectSuccess(
          "Konduit app imported successfully.",
          { name: "home" }
        ),
        (e: JsonError) => {
          notifications.error(`Failed to import Konduit app: ${stringify(e)}`);
        }
      );
    },
    () => {
      notifications.error("No file selected.");
    }
  );
};

const router = useRouter();

const createKonduitConsumer = async () => {
  const result = await store.createKonduitConsumer();
  result.match(
    () => router.push({ name: "home" }),
    (e: any) => {
      notifications.error(`Failed to create Konduit app: ${e}`);
    }
  );
};

const buttons: ButtonProps[] = [
  {
    label: "Import",
    action: loadKonduitConsumerJson,
    primary: false,
  },
  {
    label: "Create",
    action: createKonduitConsumer,
    primary: true,
  },
];
</script>

<template>
  <div id="container">
    <div id="logo"><KonduitLogo /></div>
    <p>A Cardano to Bitcoin Lightning Pipe</p>
    <ButtonGroup :buttons="buttons" />
    <div id="link">
      <span>by</span>
      <a href="https://cardano-lightning.org">cardano-lightning.org</a>
    </div>
  </div>
</template>

<style scoped>
#app {
  max-width: 640px;
}

#container {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: var(--main-container-padding);
  text-align: center;
}

#logo {
  display: flex;
  font-size: 1em;
  max-height: 4em;
  justify-content: center;
  padding: 20vh 0 2vh;
}

#link {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 1em;
  color: var(--text-secondary);
}

.button-group {
  padding: 8vh 0rem 12vh;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}
</style>

