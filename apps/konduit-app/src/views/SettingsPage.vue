<script setup lang="ts">
import { exportSettings, forget } from "../store";
import { writeJson } from "../utils/dom";
import { useNotifications } from "../composables/notifications";
import SettingRow from "./SettingsPage/SettingRow.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";
import { computed } from "vue";
import { cardanoConnectorUrl, signingKey } from "../store";
import { toVerificationKey } from "../cardano/keys";
import { abbreviateHex, MISSING_PLACEHOLDER } from "../utils/formatters";

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
  writeJson(exportSettings(), "konduit.json");
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

const formattedVkey = computed(() => {
  if(signingKey.value !== null)
    return abbreviateHex(toVerificationKey(signingKey.value));
  return MISSING_PLACEHOLDER;
});

const formattedConnector = computed(() => {
  if(cardanoConnectorUrl.value !== null)
    return cardanoConnectorUrl.value;
  return MISSING_PLACEHOLDER;
});

</script>

<template>
  <TheHeader :back-page-name="'home'" />
  <dl id="container">
    <SettingRow :label="'Verification key'" :formatted-value="formattedVkey" />
    <SettingRow :label="'Cardano connector'" :formatted-value="formattedConnector || MISSING_PLACEHOLDER" :action="'edit-cardano-connector-url'" />
    <SettingRow :label="'Cardano network'" :formatted-value="'Mainnet'" :action="'cardano-network'" />
    <hr />
    <SettingRow :label="'Export'" :formatted-value="''" :action="writeSettings" :action-icon="'download'" />
    <SettingRow :label="'Forget Me'" :formatted-value="''" :action="forgetReload" :action-icon="'trash'" />
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
