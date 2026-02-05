<script setup lang="ts">
import { currentInvoice, cardanoConnector } from "../store";
import { type Props as ButtonProps } from "../components/Button.vue";
import NavBar from "../components/NavBar.vue";
import TheHeader from "../components/TheHeader.vue";
import Form from "../components/Form.vue";
import { useRegle, type Maybe, createRule } from "@regle/core";
import * as rules from '@regle/rules';
import { computed, ref, type ComputedRef } from "vue";
import { FieldWidth } from "../components/Form/core";
import * as TextField from "../components/Form/TextField.vue";
import * as SelectField from "../components/Form/SelectField.vue";
import { Days, Hours, Milliseconds, NormalisedDuration } from "@konduit/konduit-consumer/time/duration";
import { useDefaultFormatters } from "../composables/l10n";
import { useRouter } from "vue-router";
import { Adaptor } from "@konduit/konduit-consumer/adaptor";
import { stringify } from "@konduit/codec/json";

const formatters = useDefaultFormatters();

const adaptor = ref<Adaptor | null>(null);

const adaptorUrlValidator = createRule({
  message: (result) => {
    if(result?.adaptorUrlValidationError) {
      switch(result.adaptorUrlValidationError.type) {
        case "HttpError":
          return `The provided URL returned an HTTP error: ${result.adaptorUrlValidationError.status} ${result.adaptorUrlValidationError.statusText}`;
        case "NetworkError":
          return `The provided URL is unreachable (due to server setup like CORS or networking problem): "${result.adaptorUrlValidationError.message}"`;
        case "DeserialisationError":
          return `The provided URL did not return a valid Cardano Connector backend response: ${stringify(result.adaptorUrlValidationError.message)}`;
        default:
          return "An unknown error occurred while validating the provided URL.";
      }
    }
    return [];
  },
  validator: async (value: Maybe<string>) => {
    let emptyResult = {
      adaptorUrlValidationError: null,
      adaptor: null,
      $valid: false,
    };
    if(rules.isEmpty(value)) return emptyResult;
    let backendUrl = value as string;
    const createResult = await Adaptor.fromUrlString(backendUrl);
    return createResult.match(
      (a: Adaptor) => {
        adaptor.value = a;
        return {
          ...emptyResult,
          adaptor: a,
          $valid: true
        };
      },
      (_err) => {
        return {
          ...emptyResult,
          adaptorUrlValidationError: _err,
          $valid: false
        };
      }
    );
  },
});

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
    let disabled = (adaptor.value && adaptor.value.info.closePeriod > milliseconds) || false;
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

const respondPeriodRule = createRule({
  message: (meta) => {
    if(meta.optionValue == null) return "Please select a valid respond period.";
    if(meta.duration != null && meta.$invalid) {
      return `The selected respond period of ${formatters.formatDurationLong(meta.duration)} is not valid for the current adaptor.`;
    }
    return "The selected respond period is not valid.";
  },
  validator: async (value: Maybe<string>) => {
    if(rules.isEmpty(value)) {
      return {
        $valid: false,
        optionValue: null,
      };
    }
    let possibleDurationInfo = respondPeriodFieldSetup.value.optionValue2DurationInfo[value as string];
    if(possibleDurationInfo) {
      let [duration, disabled] = possibleDurationInfo;
      if(disabled) {
        return {
          $valid: false,
          duration: duration,
          optionValue: value,
        };
      }
      return {
        $valid: true,
        duration: duration,
        optionValue: value,
      };
    }
    return {
      $valid: false,
      optionValue: value,
    };
  },
});

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
    adaptorUrlValidator: adaptorUrlValidator,
    $debounce: 1000,
  },
  respondPeriod: {
    required: rules.required,
    respondPeriodRule: respondPeriodRule,
    $debounce: 500,
  },
  amount: {
    required: rules.required,
    numeric: rules.numeric,
    minValue: rules.minValue(1),
    $debounce: 500,
  },
  currency: {
    required: rules.required,
  },
});

// We want to run the validation immediately so
r$.adaptorUrl.$touch();
// r$.respondPeriod.$touch();

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

const fields = computed(() => {
  return {
    adaptorUrl: {
      fieldWidth: FieldWidth.full,
      isValid: isValid(r$.adaptorUrl.$dirty, r$.adaptorUrl.$rules.adaptorUrlValidator.$valid),
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
          r$.respondPeriod.$rules.respondPeriodRule.$valid
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
        r$.amount.$rules.minValue.$valid && r$.amount.$rules.numeric.$valid && r$.amount.$rules.required.$valid
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
      label: "Currency",
      options: ["ADA"],
      type: SelectField.select,
    }
  };
});

const handleSubmit = () => {
  if (r$.$ready) {
    console.log("Submitting form", r$.$value);
    // Here you would typically handle the form submission,
    // e.g., send data to the backend or update application state.
  } else {
    console.log("Form is not ready for submission.");
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
      disabled: !r$.$ready,
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

