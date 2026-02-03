<script setup lang="ts">
import { writeJson } from "../utils/dom";
import { useNotifications } from "../composables/notifications";
import SettingRow from "./SettingsPage/SettingRow.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";
import Hr from "../components/Hr.vue";
import { cardanoConnector, wallet } from "../store";
import { json2KonduitConsumerAsyncCodec, KonduitConsumer } from "@konduit/konduit-consumer";
import { konduitConsumer, forget } from "../store";
import { abbreviated } from "../composables/formatters";
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
  const json = json2KonduitConsumerAsyncCodec.serialise(konduitConsumer.value as KonduitConsumer);
  writeJson(json, "konduit.json");
};

const formattedConnector = orPlaceholder(cardanoConnector.value?.backendUrl);
const formattedAddress = abbreviated(() => wallet.value?.addressBech32, 25, 10);

</script>

<template>
  <TheHeader :back-page-name="'home'" />
  <dl id="container">
    <SettingRow :label="'Cardano connector'" :formatted-value="formattedConnector" :actions="[['edit-cardano-connector-url', 'pen']]" />
    <Hr class="separator" />
    <SettingRow :label="'Embedded wallet address'" :formatted-value="formattedAddress" />
    <SettingRow :label="'Export'" :formatted-value="''" :actions="[[writeSettings,'download']]" />
    <SettingRow :label="'Forget'" :formatted-value="''" :actions="[[forgetReload, 'trash']]" />
  </dl>
  <NavBar />
</template>

<style scoped>
</style>
