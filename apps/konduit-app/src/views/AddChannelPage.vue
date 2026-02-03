<script setup lang="ts">
import { currentInvoice } from "../store";
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
import { Days, Hours, Milliseconds, NormalizedDuration } from "@konduit/konduit-consumer/time/duration";
import { useDefaultFormatters } from "../composables/l10n";
import { useRouter } from "vue-router";

const formatters = useDefaultFormatters();

const respondPeriodFieldSetup = (() => {
  const allowedRespondTimes = [
    NormalizedDuration.fromComponentsNormalization({ hours: Hours.fromDigits(6) }),
    NormalizedDuration.fromComponentsNormalization({ hours: Hours.fromDigits(1, 2) }),
    NormalizedDuration.fromComponentsNormalization({ days: Days.fromDigits(1) }),
    NormalizedDuration.fromComponentsNormalization({ days: Days.fromDigits(2) }),
    NormalizedDuration.fromComponentsNormalization({ days: Days.fromDigits(4) }),
    NormalizedDuration.fromComponentsNormalization({ days: Days.fromDigits(7) }),
  ];

  const optionsInfo = allowedRespondTimes.map(nd => {
    let optionValue = `${Milliseconds.fromNormalizedDuration(nd)}`;
    let label = formatters.formatDurationLong(nd);
    return {
      origValue: nd,
      optionValue,
      label,
    };
  });

  const options = optionsInfo.map(info => ({
    value: info.optionValue,
    label: info.label,
  }));

  const optionValue2Duration = optionsInfo.reduce((acc, info) => {
    acc[info.optionValue] = info.origValue;
    return acc;
  }, {} as Record<string, NormalizedDuration>);

  const respondPeriodRule = createRule({
    message: ({ optionValue }) => {
      if(optionValue == null) return "Please select a valid respond period.";
      return "The selected respond period is not valid.";
    },
    validator: async (value: Maybe<string>) => {
      if(rules.isEmpty(value)) {
        return {
          $valid: false,
        };
      }
      let possibleDuration = optionValue2Duration[value as string];
      if(possibleDuration) {
        return {
          $valid: true,
          duration: possibleDuration,
        };
      }
      return {
        $valid: false,
        optionValue: value,
      };
    },
  });
  return {
    options,
    respondPeriodRule,
  };
})();

const formState = (() => {
  // I introduced this temporary variable
  // to overcome TS "Object is possibly undefined" error.
  const initialRespondPeriodOpt = respondPeriodFieldSetup?.options[0];
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
    $debounce: 1000,
  },
  respondPeriod: {
    required: rules.required,
    respondPeriodRule: respondPeriodFieldSetup.respondPeriodRule,
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

const fields = computed(() => {
  return {
    adaptorUrl: {
      fieldWidth: FieldWidth.full,
      isValid: null,
      label: "Adaptor's URL",
      type: TextField.url,
      placeholder: "https://example-adaptor.com",
      errors: r$.adaptorUrl.$errors,
    },
    respondPeriod: (() => {
      return {
        fieldWidth: FieldWidth.full,
        isValid: null,
        label: "Respond Period",
        type: SelectField.select,
        options: respondPeriodFieldSetup.options,
        errors: r$.$errors.respondPeriod,
      };
    })(),
    amount: {
      fieldWidth: FieldWidth.half,
      isValid: null,
      label: "Amount",
      type: TextField.number,
      errors: r$.amount.$errors,
    },
    // Placeholder for the future currency choice
    currency: {
      disabled: true,
      errors: r$.currency.$errors,
      fieldWidth: FieldWidth.half,
      isValid: null,
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
  <Form :buttons="buttons" :fields="fields" :formState="formState" :handleSubmit="handleSubmit" />
  <NavBar />
</template>

