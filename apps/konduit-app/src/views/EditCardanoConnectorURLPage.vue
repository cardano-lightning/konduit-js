<script setup lang="ts">
import TheHeader from "../components/TheHeader.vue";
import Form from "../components/Form.vue";
import * as TextField from "../components/Form/TextField.vue";
import { useRouter } from 'vue-router';
import { computed, ref, type ComputedRef } from 'vue';
import { createRule, useRegle, type Maybe } from '@regle/core';
import { cardanoConnector } from "../store";
import * as rules from '@regle/rules';
import { type Props as ButtonProps } from "../components/Button.vue";
import { CardanoConnectorWallet } from "@konduit/konduit-consumer/wallets/embedded";
import { wallet } from "../store";
import { isEmpty } from "@regle/rules";
import { Milliseconds } from "@konduit/konduit-consumer/time/duration";
import { FieldWidth } from "../components/Form/core";

const walletBackendRule = createRule({
  message: ({ backend }) => {
    if(backend) return "The provided URL is not a valid Cardano Connector backend for the current network.";
    return "The provided URL is not a valid Cardano Connector backend or the backend is unreachable.";
  },
  validator: async (value: Maybe<string>) => {
    let backendUrl;
    if(isEmpty(value)) {
      return {
        backendUrl: null,
        backend: null,
        $valid: false,
      };
    }
    backendUrl = value as string;
    const createResult = await CardanoConnectorWallet.createBackend(backendUrl, Milliseconds.fromDigits(5, 0, 0));
    return createResult.match(
      (newBackend) => {
        if (wallet.value && wallet.value.networkMagicNumber === newBackend.networkMagicNumber) {
          return {
            backendUrl,
            backend: newBackend,
            $valid: true
          };
        }
        return {
          backendUrl,
          backend: newBackend,
          $valid: false
        };
      },
      () => {
        return {
          backendUrl,
          backend: null,
          $valid: false
        };
      }
    );
  },
});

const formState = {
  url: ref(cardanoConnector.value.backendUrl || ''),
};

const { r$ } = useRegle(
  formState,
  {
    url: {
      required: rules.required,
      // TODO: I have no clue why this composition of rules doesn't work:
      // url: rules.withMessage(
      //   rules.and(rules.url, walletBackendRule),
      //   () => "Please provide a valid Cardano Connector URL."
      // ),
      // TODO: It would be much nicer to error only if the URL is syntactically valid.
      //       And the root domain does exist.
      url: walletBackendRule,
      $debounce: 1000,
    },
  }
);

const fields = computed(() => {
  return {
    url: {
      fieldWidth: FieldWidth.full,
      isValid: null,
      label: "Cardano Connector's URL",
      type: TextField.url,
      placeholder: "https://example-adaptor.com",
      errors: r$.url.$errors,
    }
  };
});

const handleSubmit = () => {
  if (r$.$ready) {
    console.log("Submitting form", r$.$value);
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

const buttons: ComputedRef<ButtonProps[]> = computed(() => {
  return [
    {
      label: "Cancel",
      action: () => { router.push({ name: 'settings' }); },
      primary: false,
    },
    {
      disabled: !r$.$ready || r$.$value.url === cardanoConnector.value.backendUrl,
      label: "Save",
      action: handleSubmit,
      primary: true,
    },
  ]
});
</script>

<template>
  <TheHeader :back-page-name="'settings'" />
  <Form :buttons="buttons" :fields="fields" :formState="formState" :handleSubmit="handleSubmit" :touch="touch" />
</template>

