export type FieldWidth = "full" | "half";
export namespace FieldWidth {
  export const full = "full" as FieldWidth;
  export const half = "half" as FieldWidth;
}

export type Errors =
  | string[]
  | { value: string; messages: string[] }

export type BaseFieldProps = {
  disabled?: boolean;
  errors?: Errors;
  fieldWidth: FieldWidth;
  isValid: boolean | null;
  label: string;
};


export const extractFieldErrorsMessages = (value: string | null, errors: Errors): string[] => {
  if(Array.isArray(errors)) {
    return errors;
  } else if(value === null || errors.value === value) {
    return errors.messages;
  }
  return [];
};

