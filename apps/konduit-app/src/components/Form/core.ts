export type FieldWidth = "full" | "half";
export namespace FieldWidth {
  export const full = "full" as FieldWidth;
  export const half = "half" as FieldWidth;
}

export type BaseFieldProps = {
  disabled?: boolean;
  errors?: string[];
  fieldWidth: FieldWidth;
  isValid: boolean | null;
  label: string;
};

