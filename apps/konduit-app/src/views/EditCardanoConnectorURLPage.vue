<script setup lang="ts">
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import Form from "../components/Form.vue";
import * as TextField from "../components/Form/TextField.vue";
import { useRouter } from 'vue-router';
import { computed, ref, type ComputedRef } from 'vue';
import { useRegle } from '@regle/core';
import { cardanoConnector, konduitConsumer, setCardanoConnector } from "../store";
import * as rules from '@regle/rules';
import { type Props as ButtonProps } from "../components/Button.vue";
import { mkConnectorClient } from "@konduit/konduit-consumer/cardano/connectorClient";
import { wallet } from "../store";
import { FieldWidth } from "../components/Form/core";
import { NetworkMagicNumber, PublicNetwork } from "@konduit/konduit-consumer/cardano";
import { ruleFromAsyncDeserialiser } from "../utils/regle";
import { err, ok, Result } from "neverthrow";
import { useAppBack } from "../composables/history";

type Url = string;

const backendUrlRule = ruleFromAsyncDeserialiser<Url>(
  async (backendUrl: string): Promise<Result<Url, string>> => {
    const connectorClient = mkConnectorClient(backendUrl);
    return (await connectorClient.network()).match(
    (publicNetwork: PublicNetwork) => {
      const networkMagicNumber = NetworkMagicNumber.fromPublicNetwork(publicNetwork);
      if (wallet.value && wallet.value.networkMagicNumber === networkMagicNumber) {
        return ok(backendUrl);
      }
      return err("The provided URL is not a valid Cardano Connector backend for the current network.");
    },
    () => {
      return err("The provided URL is not a valid Cardano Connector backend or the backend is unreachable.");
    }
  );
});

const formState = {
  url: ref(cardanoConnector.value.baseUrl || ''),
};

const { r$ } = useRegle(
  formState,
  {
    url: {
      required: rules.required,
      connectorServer: backendUrlRule,
      $debounce: 1000,
    },
  }
);

const fields = computed(() => {
  return {
    url: {
      fieldWidth: FieldWidth.full,
      isValid: r$.url.$rules.connectorServer.$valid,
      label: "Cardano Connector's URL",
      type: TextField.url,
      placeholder: "https://example-adaptor.com",
      errors: r$.url.$errors,
    }
  };
});

const handleSubmit = () => {
  if (r$.$ready && konduitConsumer.value && r$.url.$rules.connectorServer.$metadata?.value) {
    setCardanoConnector(r$.url.$rules.connectorServer.$metadata.value);
    router.push({ name: 'settings' });
  }
};

const router = useRouter();

const isFormFieldName = (name: string): name is ("url") => {
  return ["url"].includes(name);
};

const touch = (fieldName: string) => {
  if(isFormFieldName(fieldName)) {
    const field = r$[fieldName];
    if(field && !field.$dirty) {
      field.$touch();
    }
  }
};

const appBack = useAppBack()

const buttons: ComputedRef<ButtonProps[]> = computed(() => {
  return [
    {
      label: "Cancel",
      action: appBack.handleClick,
      primary: false,
    },
    {
      disabled: !r$.$ready || r$.$value.url === cardanoConnector.value.baseUrl,
      label: "Save",
      action: handleSubmit,
      primary: true,
    },
  ]
});
</script>

<template>
  <MainContainer :buttons="buttons">
    <TheHeader :back="'settings'" />
    <Form :buttons="[]" :fields="fields" :formState="formState" :handleSubmit="handleSubmit" :touch="touch" />
  </MainContainer>
</template>

