import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [
    // `@konduit/konduit-consumer` loads a `.wasm` module, which vite cannot
    // handle on its own.
    wasm(),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
