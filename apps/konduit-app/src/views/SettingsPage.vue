<script setup lang="ts">
import { writeJson } from "../utils/dom";
import DataListing from "../components/DataListing.vue";
import { useNotifications } from "../composables/notifications";
import TheHeader from "../components/TheHeader.vue";
import MainContainer from "../components/MainContainer.vue";
import { cardanoConnector, type AppKonduitConsumer } from "../store";
import { json2KonduitConsumerCodec } from "@konduit/konduit-consumer";
import { konduitConsumer, forget } from "../store";
import { orPlaceholder } from "../utils/formatters";

const notifications = useNotifications();

const forgetReload = () => {
  forget()
    .then((_) => {
      notifications.redirectSuccess(
        "All settings have been forgotten.",
        { name: "launch" }
      );
    });
};

const writeSettings = () => {
  if(!konduitConsumer.value) {
    notifications.error(
      "Cannot export settings: no wallet is configured."
    );
    return;
  }
  const json = json2KonduitConsumerCodec.serialise(konduitConsumer.value as AppKonduitConsumer);
  writeJson(json, "konduit.json");
};

const formattedConnector = orPlaceholder(cardanoConnector.value?.baseUrl);

</script>

<template>
  <MainContainer>
    <TheHeader :back="'home'" />
    <DataListing :rows="[
      { label: 'Cardano connector', formattedValue: formattedConnector, actions: [['edit-cardano-connector-url', 'pen']] },
      'separator',
      { label: 'Export', formattedValue: '', actions: [[writeSettings,'download']] },
      { label: 'Forget', formattedValue: '', actions: [[forgetReload, 'trash']] },
    ]" />
  </MainContainer>
</template>

