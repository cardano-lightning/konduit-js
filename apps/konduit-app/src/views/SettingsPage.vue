<script setup lang="ts">
import { exportSettings, forget } from "../store";
import { writeJson } from "../utils/dom";
import { useNotifications } from "../notifications";
import Button from "../components/Button.vue";
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
</script>

<template>
  <div id="container">
    <TheHeader />
    <div class="button-group">
      <Button
        label="Export"
        :primary="true"
        :action="writeSettings"
      />
      <Button
        label="Forget Me"
        :primary="true"
        :action="forgetReload"
      />
    </div>
  </div>
  <NavBar />
</template>

<style scoped>
.button-group {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}
</style>
