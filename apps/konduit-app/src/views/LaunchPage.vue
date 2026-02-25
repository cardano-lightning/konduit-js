<script setup lang="ts">
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
    <img id="logo" src="../assets/logo.svg" alt="Konduit logo" />
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
  height: 15vh;
  padding: 33vh 4rem 2vh;
}

.button-group {
  padding: 10vh 0rem 10vh;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}
</style>

