<script setup lang="ts">
import { exportSettings, forget } from "../store";
import { writeJson } from "../utils/dom";
import { useNotifications } from "../composables/notifications";
import { type Props as ButtonProps } from "../components/Button.vue";
import ButtonGroup from "../components/ButtonGroup.vue";
import TheHeader from "../components/TheHeader.vue";
import NavBar from "../components/NavBar.vue";

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

const buttons: ButtonProps[] = [
  {
    label: "Export",
    action: writeSettings,
    primary: true,
  },
  {
    label: "Forget Me",
    action: forgetReload,
    primary: true,
  },
];
</script>

<template>
  <TheHeader />
  <ButtonGroup
    :buttons="buttons"
    :style="{ padding: '10vh 0 10vh' }"
  />
  <NavBar />
</template>

