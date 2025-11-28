<script setup lang="ts">
import { ref, watch } from "vue";
import * as bln from "@konduit/bln";
import { hex } from "@scure/base";

// --- State Management (using Vue ref) ---
const invoiceInput = ref<string>("");
const parsedData = ref<bln.bolt11.DecodedInvoice | null>(null);
const error = ref<string | null>(null);
const isLoading = ref<boolean>(false);

type ExtendedType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "function"
  | "object"
  | "array"
  | "uint8array"
  | "null";

function extendedTypeOf(value: any): ExtendedType {
  if (value === null) return "null";
  const t = typeof value;
  if (t !== "object")
    return t as Exclude<
      ExtendedType,
      "object" | "array" | "uint8array" | "null"
    >;
  if (Array.isArray(value)) return "array";
  if (value instanceof Uint8Array) return "uint8array";
  return "object";
}

const RENDERERS: Record<ExtendedType, (x: any) => string> = {
  string: (x) => x,
  number: (x) => x.toLocaleString(),
  bigint: (x) => x.toLocaleString(),
  boolean: (x) => String(x),
  symbol: (x) => String(x),
  undefined: (_) => "[undefined]",
  function: (_) => "[function!]",
  object: (x) => JSON.stringify(x, null, 2),
  array: (x) => JSON.stringify(x, null, 2),
  uint8array: hex.encode,
  null: (_) => "[none]",
};

/**
 * Helper function to render complex data types prettily.
 */
const renderValue = (value: any): string => {
  return RENDERERS[extendedTypeOf(value)](value);
};

/**
 * Parses the invoice input using the mock function.
 */
const handleParse = () => {
  // Clear previous results immediately
  parsedData.value = null;
  error.value = null;
  // Guard clause for empty input
  if (invoiceInput.value.trim().length === 0) {
    return;
  }
  isLoading.value = true;
  try {
    parsedData.value = bln.bolt11.parse(invoiceInput.value);
  } catch (err: any) {
    error.value = err.message || "An unknown error occurred during parsing.";
  } finally {
    isLoading.value = false;
  }
};

watch(invoiceInput, () => {
  handleParse();
});
</script>

<template>
  <div class="app-container">
    <div class="content-area">
      <h1 class="title">⚡ Lightning Invoice Decoder</h1>
      <p class="subtitle">
        Paste a Bitcoin Lightning Invoice (BOLT 11) to view its structured
        content. Parsing is automatic.
      </p>

      <!-- Input Area -->
      <div class="input-card">
        <label for="invoiceInput" class="label">
          Lightning Invoice String:
        </label>
        <textarea
          id="invoiceInput"
          rows="4"
          v-model="invoiceInput"
          placeholder="e.g., lnbc1q045v..."
          class="textarea-input"
          :disabled="isLoading"
        />

        <!-- Loading Indicator -->
        <div v-if="isLoading" class="loading-indicator">
          <svg
            class="spinner"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Parsing invoice...
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-box">
        <span style="font-weight: bold">Error:</span> {{ error }}
      </div>

      <!-- Display Results -->
      <div v-if="parsedData" class="results-card">
        <h2 class="results-header">Parsed Invoice Details</h2>
        <div class="data-list">
          <div
            v-for="([key, value], index) in Object.entries(parsedData)"
            :key="index"
            class="data-row"
          >
            <!-- Label (Key) -->
            <div class="data-label">{{ key }}:</div>
            <!-- Value (Result) -->
            <div class="data-value">
              {{ renderValue(value) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base Colors and Structure */
:root {
  --color-primary: #4f46e5; /* Indigo-600 */
  --color-secondary: #4338ca; /* Indigo-700 */
  --color-text-dark: #1f2937; /* Gray-900 */
  --color-text-medium: #4b5563; /* Gray-600 */
  --color-bg-light: #f9fafb; /* Gray-50 */
  --color-white: white;
}

.app-container {
  padding: 24px;
  min-height: 100vh;
  background-color: var(--color-bg-light);
  font-family: monospace;
}

.content-area {
  max-width: 48rem;
  margin: 0 auto;
}

/* Typography */
.title {
  font-size: 30px;
  font-weight: 800;
  color: var(--color-text-dark);
  margin-bottom: 1.5rem;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: var(--color-text-medium);
  margin-bottom: 2rem;
}

.label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-medium);
  margin-bottom: 0.5rem;
}

/* Cards & Input */
.input-card,
.results-card,
.example-box,
.error-box {
  padding: 24px;
  background-color: var(--color-white);
  border: 1px solid #e0e7ff; /* Indigo-100 */
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05); /* Shadow-lg */
  margin-top: 2rem;
  transition: box-shadow 300ms ease;
}

.input-card {
  background-color: var(--color-white);
}

.textarea-input {
  width: 90%;
  padding: 12px;
  border: 1px solid #d1d5db; /* Gray-300 */
  font-family: monospace;
  font-size: 0.875rem;
  resize: none;
  outline: none;
  transition: border-color 150ms ease;
}

.textarea-input:focus {
  border-color: var(--color-primary);
}

/* Error and Loading */
.error-box {
  margin-top: 1rem;
  padding: 16px;
  background-color: #fee2e2; /* Red-100 */
  border: 1px solid #f87171; /* Red-400 */
  color: #b91c1c; /* Red-700 */
}

.loading-indicator {
  margin-top: 1rem;
  text-align: center;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.spinner {
  animation: spin 1s linear infinite;
  margin-right: 0.75rem;
  height: 1.25rem;
  width: 1.25rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Results Display */
.results-card {
  background-color: var(--color-bg-light);
  border: 1px solid #e5e7eb; /* Gray-200 */
}

.results-header {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-secondary);
  margin-bottom: 1rem;
  border-bottom: 1px solid #ccc;
  padding-bottom: 0.5rem;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem; /* Simulates space-y-3 */
}

.data-row {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background-color: var(--color-white);
  border: 1px solid #f3f4f6; /* Gray-100 */
}

.data-label {
  font-weight: 500;
  color: var(--color-text-medium);
  width: 100%;
  margin-bottom: 4px; /* Simulates mb-1 */
  font-size: 0.875rem;
}

.data-value {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--color-text-dark);
  word-break: break-all;
  width: 100%;
}

/* Responsiveness (Simulating 'sm:' breakpoints) */
@media (min-width: 640px) {
  .data-row {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }
  .data-label {
    width: 33.333333%; /* w-1/3 */
    margin-bottom: 0; /* sm:mb-0 */
    text-align: left; /* sm:text-right */
  }
  .data-value {
    width: 66.666667%; /* w-2/3 */
    text-align: right; /* sm:text-right */
  }
}
</style>
