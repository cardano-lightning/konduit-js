<script setup lang="ts">
import { importSettings, signingKey } from "../store";
import Button from "../components/Button.vue";
import { loadJson } from "../utils/dom";
import * as keys from "../cardano/keys";
import { useNotifications } from "../composables/notifications";

const notifications = useNotifications();

const loadSettings = async () => {
  try {
    const jsonData = await loadJson();
    // null == user cancelled
    if (jsonData) {
      const result = importSettings(jsonData);
      if (result.type === "success") {
        notifications.redirectSuccess(
          "Settings imported successfully.",
          { name: "home" }
        );
      } else if (result.type === "error") {
        notifications.error(result.message);
      }
    }
  } catch (err) {
    notifications.error("Failed to load settings: " + (err as Error).message);
  }
};

const createSkey = () => {
  signingKey.value = keys.genSkey();
  notifications.redirectSuccess(
    "Signing key created successfully.",
    { name: "home" }
  );
};

</script>

<template>
  <div id="container">
    <img id="logo" src="../assets/logo.svg" alt="Konduit logo" />
    <p>A Cardano to Bitcoin Lightning Pipe</p>
    <div class="button-group">
      <Button
        label="Import"
        :primary="false"
        :action="loadSettings"
      />
      <Button
        label="Create"
        :primary="true"
        :action="createSkey"
      />
    </div>
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

