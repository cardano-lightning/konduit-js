<script setup lang="ts">
import { writeJson } from "../utils/dom";
import { useNotifications } from "../composables/notifications";
import SettingRow from "./SettingsPage/SettingRow.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";
import { computed } from "vue";
import { cardanoConnector, wallet } from "../store";
import { abbreviate, MISSING_PLACEHOLDER } from "../utils/formatters";
import { json2KonduitConsumerAsyncCodec, KonduitConsumer } from "@konduit/konduit-consumer";
import { konduitConsumer, forget } from "../store";

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

//  <ButtonGroup
//    :buttons="buttons"
//    :style="{ padding: '10vh 0 10vh' }"
//  />

// const buttons: ButtonProps[] = [
//   {
//     label: "Export",
//     action: writeSettings,
//     primary: true,
//   },
//   {
//     label: "Forget Me",
//     action: forgetReload,
//     primary: true,
//   },
// ];

const formattedConnector = computed(() => {
  if(cardanoConnector.value === null) return MISSING_PLACEHOLDER;
  return abbreviate(cardanoConnector.value.backendUrl, 25, 20);
});

const formattedAddress = computed(() => {
  if(wallet.value !== null)
    return abbreviate(wallet.value.addressBech32, 20, 10);
  return MISSING_PLACEHOLDER;
});


</script>

<template>
  <TheHeader :back-page-name="'home'" />
  <dl id="container">
    <SettingRow :label="'Cardano connector'" :formatted-value="formattedConnector || MISSING_PLACEHOLDER" :action="'edit-cardano-connector-url'" />
    <hr />
    <SettingRow :label="'Embedded wallet address'" :formatted-value="formattedAddress" />
    <SettingRow :label="'Export'" :formatted-value="''" :action="writeSettings" :action-icon="'download'" />
    <SettingRow :label="'Forget'" :formatted-value="''" :action="forgetReload" :action-icon="'trash'" />
  </dl>
  <NavBar />
</template>

<style scoped>
#container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

hr {
  color: var(--color-border);
  margin: 1rem 0;
}
</style>
