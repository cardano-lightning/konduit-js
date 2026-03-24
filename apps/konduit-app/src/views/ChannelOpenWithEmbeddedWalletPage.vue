<script setup lang="ts">
import DebugCallout from "../components/DebugCallout.vue";
import MainContainer from "../components/MainContainer.vue";
import { invoice, konduitConsumer, wallet } from "../store";
import { type Props as ButtonProps } from "../components/Button.vue";
import TheHeader from "../components/TheHeader.vue";
import Form from "../components/Form.vue";
import { useRegle } from "@regle/core";
import * as rules from '@regle/rules';
import { computed, ref, type ComputedRef, type Ref } from "vue";
import { FieldWidth } from "../components/Form/core";
import * as TextField from "../components/Form/TextField.vue";
import * as SelectField from "../components/Form/SelectField.vue";
import { useDefaultFormatters } from "../composables/l10n";
import { useRouter } from "vue-router";
import { AdaptorFullInfo } from "@konduit/konduit-consumer/adaptorClient";
import * as codec from "@konduit/codec";
import { string2IntCodec } from "@konduit/codec/urlquery/codecs/sync";
import { stringify, type Json } from "@konduit/codec/json";
import { useNotifications } from "../composables/notifications";
import { pipeDeserialisers } from "@konduit/codec";
import { Ada, Lovelace } from "@konduit/konduit-consumer/cardano";
import { err, ok, Result } from "neverthrow";
import { useEmbeddedWalletDetails } from "../composables/walletDetails";
import { TX_FEE_BUFFER, MIN_ADA_BUFFER } from "@konduit/konduit-consumer/txBuilder";
import { ruleFromAsyncDeserialiser, ruleFromDeserialiser } from "../utils/regle";

const formatters = useDefaultFormatters();

const { walletBalance } = useEmbeddedWalletDetails(wallet);

// We keep this additional value reference to access the validated
// value from the respond period options setup and disable options
// based on the info dynamically provided by the adaptor.
const adaptorFullInfo = ref<AdaptorFullInfo | null>(null);

const adaptorUrlRule = ruleFromAsyncDeserialiser(
  async (value: string): Promise<Result<AdaptorFullInfo, string>> => {
    const result = await AdaptorFullInfo.fromString(value);
    result.map((info) => {
      adaptorFullInfo.value = info;
    });
    return result.mapErr((error) => {
      switch(error.type) {
        case "HttpError":
          return `The provided URL returned an HTTP error: ${error.status} ${error.statusText}`;
        case "NetworkError":
          return `The provided URL is unreachable (due to server setup like CORS or networking problem): "${error.message}"`;
        case "DeserialisationError":
          return `The provided URL did not return a valid Cardano Connector backend response: ${stringify(error.message)}`;
        default:
          return "An unknown error occurred while validating the provided URL.";
      }
    });
  }
);

const adaRule = ruleFromDeserialiser<Ada>((() => {
  const adaDeserialiser = codec.pipe(
    string2IntCodec,
    Ada.intCodec,
  ).deserialise;
  return pipeDeserialisers(
    adaDeserialiser,
    (ada) => {
      if(ada == 0) {
        return err("You can not open a channel with zero amount. Please provide a positive amount of ADA.");
      }
      if(Ada.ord.isLessThan(ada, Ada.fromDigits(2))) {
        return err("The minimum amount for channel opening is 2 ADA. Please provide an amount equal or greater than that.");
      }
      const lovelace = Lovelace.fromAda(ada);
      const maxLovelace = Lovelace.subtractAbs(walletBalance.value, Lovelace.fromAda(Ada.fromDigits(2)));
      if(Lovelace.ord.isGreaterThan(lovelace, maxLovelace)) {
        return err(
          `You have ${formatters.formatAda(walletBalance.value)} available in your wallet, but you need to keep at least 2 ADA for fees. Please provide an amount equal or less than ${formatters.formatAda(maxLovelace)}.`
        );
      }
      return ok(ada);
    }
  );

})());

const formState = (() => {
  return {
    adaptorUrl: ref('https://preprod-adaptor.ferret.channel'),
    amount: ref(''),
    currency: ref('ADA'),
  };
})();

const { r$ } = useRegle(formState, {
  amount: {
    ada: adaRule,
    $debounce: 500,
  },
  currency: {
    required: rules.required,
  },
  adaptorUrl: {
    required: rules.required,
    adaptorUrl: adaptorUrlRule,
    $debounce: 1000,
  },
});

// We want to run the validation immediately so
r$.adaptorUrl.$touch();

const isValid = (dirty: boolean, valid: boolean) => {
  if(!dirty) return null;
  return valid;
};

const isFormFieldName = (name: string): name is ("adaptorUrl" | "amount" | "currency") => {
  return ["adaptorUrl", "amount", "currency"].includes(name);
};

const touch = (fieldName: string) => {
  if(isFormFieldName(fieldName)) {
    const field = r$[fieldName];
    if(field && !field.$dirty) {
      field.$touch();
    }
  }
};

const openingOperationCostMargin = Lovelace.unsafeAdd(TX_FEE_BUFFER, MIN_ADA_BUFFER);

const maxAmount = computed(() => {
  return Lovelace.subtractAbs(
    walletBalance.value,
    openingOperationCostMargin,
  );
});

const notifications = useNotifications();

const fields = computed(() => {
  const minAda = Lovelace.fromAda(Ada.fromDigits(2));
  return {
    amount: {
      errors: r$.amount.$errors,
      fieldWidth: FieldWidth.half,
      isValid: isValid(
        r$.amount.$dirty,
        r$.amount.$rules.ada.$valid,
      ),
      label: "Amount",
      placeholder: `${formatters.formatAda(minAda)} - ${formatters.formatAda(maxAmount.value)}`,
      type: TextField.number,
    },
    // Placeholder for the future currency choice
    currency: {
      disabled: true,
      errors: r$.currency.$errors,
      fieldWidth: FieldWidth.half,
      isValid: true,
      label: "Currency / Unit",
      options: ["ADA"],
      type: SelectField.select,
    },
    adaptorUrl: {
      fieldWidth: FieldWidth.full,
      isValid: isValid(r$.adaptorUrl.$dirty, r$.adaptorUrl.$rules.adaptorUrl.$valid),
      label: "Adaptor's URL",
      type: TextField.url,
      placeholder: "https://example-adaptor.com",
      errors: r$.adaptorUrl.$errors,
    },
  };
});

const debugInfo = ref(null) as Ref<Json>

const submitting = ref(false);

const handleSubmit = async () => {
  if (r$.$ready && submitting.value === false) {
    let ada = r$.amount.$rules.ada.$metadata.value;
    let adaptorFullInfo = r$.adaptorUrl.$rules.adaptorUrl.$metadata.value;
    if(konduitConsumer.value == null || ada == null || adaptorFullInfo == null) {
      notifications.error("Criticial - cannot add channel: app state is inconsistent");
      return;
    }
    submitting.value = true;
    const openningResult = await konduitConsumer.value.openChannel(
      adaptorFullInfo,
      Lovelace.fromAda(ada),
    );
    submitting.value = false;
    return openningResult.match(
      (_channel) => {
        const redirectTo = router.currentRoute.value.query.redirectTo ? String(router.currentRoute.value.query.redirectTo) : { name: 'home' }
        notifications.redirectSuccess("Channel opening transaction was just submitted. It may take some time to confirm on the blockchain and be accepted and fully trusted by the adaptor.", redirectTo);
      },
      (error) => {
          notifications.error(`Failed to open channel. Please try again or contact support if the problem persists.`);
          debugInfo.value = error as Json;
      }
    );
  } else {
    notifications.warn("Please fix the errors in the form before submitting.");
  }
};

const router = useRouter();

const buttons: ComputedRef<ButtonProps[]> = computed(() => {
  const cancelUrl = (() => {
    if(invoice.value != null) {
      // TODO:
      // We should redirect to the invoice details with notifition
      // about possible cancellation.
      // We sholud also cancel the invoice automatically if it already expired.
      return { name: 'pay' };
    } else {
      return { name: 'home' };
    }
  })();
  return [
    {
      label: "Go back",
      action: () => { router.push(cancelUrl); },
      primary: false,
    },
    {
      disabled: !r$.$ready || submitting.value,
      label: "Open Channel",
      action: handleSubmit,
      primary: true,
    },
  ]
});
</script>

<template>
  <MainContainer :buttons="buttons">
    <TheHeader />
    <div id="container">
      <Form :buttons="[]" :fields="fields" :formState="formState" :handleSubmit="handleSubmit" :touch="touch" />
      <DebugCallout :debugInfo="debugInfo" />
    </div>
  </MainContainer>
</template>

<style scoped>
#container {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}
</style>

