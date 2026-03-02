<script setup lang="ts">
import KonduitLogoText from "../components/KonduitLogo/Text.vue";
import { type Props as ButtonProps } from "../components/Button.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import { loadJson } from "../utils/dom";
import { useNotifications } from "../composables/notifications";
import * as store from "../store";
import type { JsonError } from "@konduit/codec/json/codecs";
import { stringify } from "@konduit/codec/json";

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

const createKonduitConsumer = async () => {
  const result = await store.createKonduitConsumer();
  result.match(
    () => notifications.redirectSuccess(
      "A new Konduit wallet created successfully.",
      { name: "home" }
    ),
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
    <div id="logo"><KonduitLogoText /></div>
    <p>A Cardano to Bitcoin Lightning Pipe</p>
    <ButtonGroup :buttons="buttons" />
    <div class="link">
      <a href="https://cardano-lightning.org">Cardano-Lightning</a>
    </div>
  </div>
</template>

<style scoped>
#container {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  text-align: center;
}

#logo {
  display: flex;
  font-size: 3em;
  justify-content: center;
  padding: 20vh 0 2vh;
}

.button-group {
  padding: 8vh 0rem 12vh;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}
</style>

