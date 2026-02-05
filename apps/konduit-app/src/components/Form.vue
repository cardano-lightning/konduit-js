<script setup lang="ts">
import type { UnboundProps as SelectFieldProps } from './Form/SelectField.vue';
import type { UnboundProps as TextFieldProps } from './Form/TextField.vue';
import { type Props as ButtonProps } from "./Button.vue";
import ButtonGroup from './ButtonGroup.vue';
import SelectField from './Form/SelectField.vue';
import TextField from './Form/TextField.vue';
import { computed, type Ref } from 'vue';

export type FieldProps =
  | TextFieldProps
  | SelectFieldProps;

export type Props<Keys extends string = string> = {
  buttons: ButtonProps[];
  // Handle submit should expect that the form state
  // can still be invalid as this component is
  // validation agnostic.
  handleSubmit: () => void;
  fields: Record<Keys, FieldProps>;
  formState: Record<Keys, Ref<string>>;
  touch: (fieldName: Keys) => void;
};

const props = defineProps<Props>();

// Poor man's "widgets":
// - we allow groupping two fields per column.
// - we collect errors for both of them and display them below both of them.
const groupedFields = computed((): { fields: {name: string, field: FieldProps}[], errors: string[] }[] => {
  const result = [];
  let currentRowFields:{name: string, field: FieldProps }[] = [];
  let currentRowErrors: string[] = [];

  for(const [name, field] of Object.entries(props.fields)) {
    // Logic to group fields can be added here if needed
    if(field.fieldWidth === 'half') {
      if(currentRowFields.length === 1) {
        currentRowFields.push({ name, field });
        currentRowErrors = currentRowErrors.concat(field.errors || []);

        result.push({ fields: currentRowFields, errors: currentRowErrors });
        currentRowFields = [];
        currentRowErrors = [];
      } else {
        currentRowFields = [{ name, field }];
        currentRowErrors = field.errors ? [...field.errors] : [];
      }
    } else {
      if(currentRowFields.length === 1) {
        result.push({ fields: currentRowFields, errors: currentRowErrors });
        currentRowFields = [];
        currentRowErrors = [];
      }
      result.push({ fields: [{ name, field }], errors: field.errors || [] });
    }
  }
  if(currentRowFields.length === 1) {
    result.push({ fields: currentRowFields, errors: currentRowErrors });
  }
  return result;
});
</script>

<template>
  <form id="form-container" @submit.prevent="props.handleSubmit">
    <div class="form-body">
      <div
        v-for="row in groupedFields"
        class="form-row"
      >
        <div class="fields">
          <div
            v-for="{ name, field } in row.fields"
            :key="name"
            class="field"
          >
            <TextField
              v-if="field.type == 'text' || field.type == 'email' || field.type == 'password' || field.type == 'tel' || field.type == 'number' || field.type == 'date' || field.type == 'url'"
              :disabled="field.disabled"
              :errors="field.errors"
              :fieldWidth="field.fieldWidth"
              :isValid="field.isValid"
              :label="field.label"
              :name="name"
              :placeholder="field.placeholder"
              :state="props.formState[name] as Ref<string>"
              :touch="() => props.touch(name)"
              :type="field.type"
            />

            <SelectField
              v-else-if="field.type === 'select'"
              :disabled="field.disabled"
              :errors="field.errors"
              :fieldWidth="field.fieldWidth"
              :isValid="field.isValid"
              :label="field.label"
              :name="name"
              :options="field.options"
              :state="props.formState[name] as Ref<string>"
              :touch="() => props.touch(name)"
              :type="field.type"
            />
          </div>
        </div>
        <ul class="errors" v-if="row.errors && row.errors.length > 0">
          <li class="error" v-for="error of row.errors" :key='error'>
            {{ error }}
          </li>
        </ul>
      </div>
    </div>
    <ButtonGroup :buttons="props.buttons" />
  </form>
</template>

<style scoped>
#form-container {
  display: flex;
  flex-direction: column;
  gap: 3em;
  justify-content: space-between;
  padding: 1em;
  /* This should be parent concern */
  /* padding-bottom: calc(30% + env(safe-area-inset-bottom)); */
}

.form-body {
  display: flex;
  gap: 1em;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 1em;
  width: 100%;
}

.form-row .fields {
  display: flex;
  gap: 1.5em;
  flex-direction: row;
  width: 100%;
}

.form-row .fields .field {
  flex: 1;
}

/* Spacing should be controlled by the flex gap of the form-row */
.form-row .errors {
  color: var(--error-color);
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  margin: 0;
  padding: 0;
}

.form-row .errors li.error {
  flex: 1;
  margin: 0;
  padding: 0;
}
</style>
