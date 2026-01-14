<script setup lang="ts">
import TheHeader from "../components/TheHeader.vue";
import { useRouter } from 'vue-router';
import { computed, type ComputedRef } from 'vue';
import { useRegle } from '@regle/core';
import { cardanoConnectorUrl } from "../store";
import * as rules from '@regle/rules';
import { type Props as ButtonProps } from "../components/Button.vue";
import ButtonGroup from "../components/ButtonGroup.vue";

const { r$ } = useRegle(
  {
    url: cardanoConnectorUrl.value || '',
  },
  {
    url: {
      required: rules.required,
      url: rules.url,
      $debounce: 1000,
    },
  }
);

const handleSubmit = () => {
  if (r$.$ready) {
    cardanoConnectorUrl.value = r$.$value.url;
    router.push({ name: 'settings' });
  }
};

const router = useRouter();

const buttons: ComputedRef<ButtonProps[]> = computed(() => {
  console.log("Recomputing buttons", r$.$invalid);
  return [
    {
      label: "Cancel",
      action: () => { router.push({ name: 'settings' }); },
      primary: false,
    },
    {
      disabled: !r$.$ready,
      label: "Save",
      action: handleSubmit,
      primary: true,
    },
  ]
});
</script>

<template>
  <TheHeader :back-page-name="'settings'" />
  <form id="form-container" @submit.prevent="handleSubmit">
    <div class="form-body">
      <div class="field">
        <legend>Cardano Connector URL</legend>
        <input
           v-model='r$.$value.url'
          :class="{ error: r$.url.$error }"
          type='text'
          placeholder='https://cardano-lightning.org/konduit'
        />
        <span v-for="error of r$.url.$errors" :key='error'>
          {{ error }}
        </span>
      </div>
    </div>
    <ButtonGroup :buttons="buttons" />
  </form>
</template>

<style scoped>
#form-container {
  align-content: space-between;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
  padding-bottom: calc(30% + env(safe-area-inset-bottom)); /* Navbar height + safe area */
  height: 100%;
}

.form-body {
  align-content: space-around;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-around;
}
</style>

