<script setup lang="ts">
import { currentInvoice, konduitConsumer } from "../store";
import { type Props as ButtonProps } from "../components/Button.vue";
import NavBar from "../components/NavBar.vue";
import TheHeader from "../components/TheHeader.vue";
import Form from "../components/Form.vue";
import { useRegle, type Maybe, createRule, type RegleRuleDefinition } from "@regle/core";
import * as rules from '@regle/rules';
import { computed, ref, type ComputedRef, type Ref } from "vue";
import { FieldWidth } from "../components/Form/core";
import * as TextField from "../components/Form/TextField.vue";
import * as SelectField from "../components/Form/SelectField.vue";
import { Days, Hours, Milliseconds, NormalisedDuration } from "@konduit/konduit-consumer/time/duration";
import { useDefaultFormatters } from "../composables/l10n";
import { useRouter } from "vue-router";
import { AdaptorFullInfo } from "@konduit/konduit-consumer/adaptorClient";
import * as codec from "@konduit/codec";
import { string2IntCodec, type StringDeserialiser } from "@konduit/codec/urlquery/codecs/sync";
import { stringify } from "@konduit/codec/json";
import { useNotifications } from "../composables/notifications";
import { pipeDeserialisers, type Deserialiser } from "@konduit/codec";
import type { JsonError } from "@konduit/codec/json/codecs";
import { Ada, int2AdaCodec, Lovelace } from "@konduit/konduit-consumer/cardano";
import { err, ok, Result } from "neverthrow";
import { isEmpty } from "@regle/rules";

const formatters = useDefaultFormatters();

const formatError = (error: JsonError): string => {
  if(typeof error === "string") {
    return error;
  }
  return stringify(error);
};

const ruleFromDeserialiser = <T>(deserialiser: Deserialiser<string, T, JsonError>): RegleRuleDefinition<string, [], true, { $valid: boolean, deserialisationError: JsonError | null, value: T | null }> => {
  return createRule({
    validator: async (value: Maybe<string>) => {
      if(isEmpty(value)) {
        return { $valid: false, value: null, deserialisationError: "Value is required." };
      }
      let deserialisationResult = deserialiser(value);
      return deserialisationResult.match(
        (value) => ({ $valid: true, value, deserialisationError: null }),
        (_err) => ({ $valid: false, value: null, deserialisationError: _err })
      );
    },
    message: (result) => {
      if(result.deserialisationError) {
        return formatError(result.deserialisationError);
      }
      return "The provided value is not valid.";
    },
  });
}

const ruleFromAsyncDeserialiser = <T>(deserialiser: (value: string) => Promise<Result<T, string>>): RegleRuleDefinition<string, [], true, { $valid: boolean, deserialisationError: string | null, value: T | null }> => {
  return createRule({
    validator: async (value: Maybe<string>) => {
      if(isEmpty(value)) {
        return { $valid: false, value: null, deserialisationError: "Value is required." };
      }
      let deserialisationResult = await deserialiser(value);
      return deserialisationResult.match(
        (value) => ({ $valid: true, value, deserialisationError: null }),
        (_err) => ({ $valid: false, value: null, deserialisationError: _err })
      );
    },
    message: (result) => {
      if(result.deserialisationError) {
        return formatError(result.deserialisationError);
      }
      return "The provided value is not valid.";
    },
  });
}

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
    int2AdaCodec,
  ).deserialise;
  return pipeDeserialisers(
    adaDeserialiser,
    (ada) => {
      if(ada == 0) {
        return err("You can not open a channel with zero amount. Please provide a positive amount of ADA.");
      }
      return ok(ada);
    }
  );

})());

// This setup reacts to the adaptor changes:
// * we disable respond periods that are shorter than the adaptor's required close period
// * we adjust the selected respond period if it becomes invalid
const respondPeriodFieldSetup = computed(() => {
  const allowedRespondTimes = [
    NormalisedDuration.fromComponentsNormalization({ hours: Hours.fromDigits(6) }),
    NormalisedDuration.fromComponentsNormalization({ hours: Hours.fromDigits(1, 2) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(1) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(2) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(4) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(7) }),
  ];
  const optionsInfo = allowedRespondTimes.map(nd => {
    let milliseconds = Milliseconds.fromNormalisedDuration(nd);
    let optionValue = `${milliseconds}`;
    let label = formatters.formatDurationLong(nd);
    let disabled = (
        (adaptorFullInfo.value || false)
        && Milliseconds.ord.isGreaterThan(
            Milliseconds.fromSeconds(adaptorFullInfo.value[1].closePeriod),
            milliseconds
          )
      );
    return {
      origValue: nd,
      optionValue,
      label,
      disabled,
    };
  });

  const options = optionsInfo.map(info => ({
    value: info.optionValue,
    label: info.label,
    disabled: info.disabled,
  }));

  const optionValue2DurationInfo = optionsInfo.reduce((acc, info) => {
    acc[info.optionValue] = [info.origValue, info.disabled];
    return acc;
  }, {} as Record<string, [NormalisedDuration, boolean]>);

  return {
    options,
    optionValue2DurationInfo,
  };
});

// We need this ref to pass it to the deserialiser factory below.
const respondPeriodOptionsRef = computed(() => {
  return respondPeriodFieldSetup.value.optionValue2DurationInfo;
});

const respondPeriodRule = (() => {
  const mkString2RespondPeriodDeserialiser = (optionsRef: Ref<Record<string, [NormalisedDuration, boolean]>>): StringDeserialiser<NormalisedDuration> => {
    return (value: string) => {
      if(!optionsRef.value)
        return err("Respond period options are not configured yet.");
      const options = optionsRef.value;
      if(!options[value]) return err(`No such respond period option: ${value}`);
      let [duration, disabled] = options[value];
      if(disabled) {
        return err(`The selected respond period of ${formatters.formatDurationLong(duration)} is not valid for the current adaptor.`);
      }
      return ok(duration);
    }
  };
  return ruleFromDeserialiser(
    mkString2RespondPeriodDeserialiser(respondPeriodOptionsRef)
  );
})();

const formState = (() => {
  const initialRespondPeriodOpt = respondPeriodFieldSetup.value?.options.find(opt => !opt.disabled);
  const initialRespondPeriod: string = initialRespondPeriodOpt ? initialRespondPeriodOpt.value : '';
  return {
    adaptorUrl: ref('https://ada.konduit.channel'),
    respondPeriod: ref(initialRespondPeriod),
    amount: ref(''),
    currency: ref('ADA'),
  };
})();

const { r$ } = useRegle(formState, {
  adaptorUrl: {
    required: rules.required,
    adaptorUrl: adaptorUrlRule,
    $debounce: 1000,
  },
  respondPeriod: {
    required: rules.required,
    respondPeriod: respondPeriodRule,
    $debounce: 500,
  },
  amount: {
    ada: adaRule,
    $debounce: 500,
  },
  currency: {
    required: rules.required,
  },
});

// We want to run the validation immediately so
r$.adaptorUrl.$touch();

const isValid = (dirty: boolean, valid: boolean) => {
  if(!dirty) return null;
  return valid;
};

const isFormFieldName = (name: string): name is ("adaptorUrl" | "respondPeriod" | "amount" | "currency") => {
  return ["adaptorUrl", "respondPeriod", "amount", "currency"].includes(name);
};

const touch = (fieldName: string) => {
  if(isFormFieldName(fieldName)) {
    const field = r$[fieldName];
    if(field && !field.$dirty) {
      field.$touch();
    }
  }
};

const notifications = useNotifications();

const fields = computed(() => {
  return {
    adaptorUrl: {
      fieldWidth: FieldWidth.full,
      isValid: isValid(r$.adaptorUrl.$dirty, r$.adaptorUrl.$rules.adaptorUrl.$valid),
      label: "Adaptor's URL",
      type: TextField.url,
      placeholder: "https://example-adaptor.com",
      errors: r$.adaptorUrl.$errors,
    },
    respondPeriod: (() => {
      return {
        fieldWidth: FieldWidth.full,
        isValid: isValid(
          r$.amount.$dirty,
          r$.respondPeriod.$rules.respondPeriod.$valid
        ),
        label: "Respond Period",
        type: SelectField.select,
        options: respondPeriodFieldSetup.value.options,
        errors: r$.respondPeriod.$errors,
      };
    })(),
    amount: {
      fieldWidth: FieldWidth.half,
      isValid: isValid(
        r$.amount.$dirty,
        r$.amount.$rules.ada.$valid,
      ),
      label: "Amount",
      type: TextField.number,
      errors: r$.amount.$errors,
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
    }
  };
});

const submitting = ref(false);

const handleSubmit = async () => {
  if (r$.$ready && submitting.value === false) {
    let ada = r$.amount.$rules.ada.$metadata.value;
    let respondPeriod = r$.respondPeriod.$rules.respondPeriod.$metadata.value;
    let adaptorFullInfo = r$.adaptorUrl.$rules.adaptorUrl.$metadata.value;
    if(konduitConsumer.value == null || ada == null || respondPeriod == null || adaptorFullInfo == null) {
      notifications.error("Criticial - cannot add channel: app state is inconsistent");
      return;
    }
    submitting.value = true;
    const openningResult = await konduitConsumer.value.openChannel(
      adaptorFullInfo,
      Lovelace.fromAda(ada),
      Milliseconds.fromNormalisedDuration(respondPeriod)
    );
    submitting.value = false;
    return openningResult.match(
      (_channel) => {
        const redirectPage = currentInvoice.value != null ? { name: 'pay' } : { name: 'home' };
        console.error("Channels in the consumer:");
        if(konduitConsumer.value != null) {
          console.error(konduitConsumer.value._channels);
        } else {
          console.error("No channels found.");
        }
        notifications.redirectSuccess("Channel opening transaction was just submitted. It may take some time to confirm on the blockchain and be accepted and fully trusted by the adaptor.", redirectPage);
      },
      (error) => {
        notifications.error(`Failed to open channel: ${error}. Please try again or contact support if the problem persists.`);
      }
    );
  } else {
    notifications.warn("Please fix the errors in the form before submitting.");
  }
};

const router = useRouter();

const buttons: ComputedRef<ButtonProps[]> = computed(() => {
  const cancelUrl = (() => {
    if(currentInvoice.value != null) {
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
      label: "Cancel",
      action: () => { router.push(cancelUrl); },
      primary: false,
    },
    {
      disabled: !r$.$ready || submitting.value,
      label: "Add",
      action: handleSubmit,
      primary: true,
    },
  ]
});
</script>

<template>
  <TheHeader />
  <Form :buttons="buttons" :fields="fields" :formState="formState" :handleSubmit="handleSubmit" :touch="touch" />
  <NavBar />
</template>

