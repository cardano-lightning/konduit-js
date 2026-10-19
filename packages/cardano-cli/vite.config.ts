import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "cardano-cli",
      formats: ["es", "umd"],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    outDir: "dist",
    cssCodeSplit: false,
  },
  plugins: [
    dts(),
    topLevelAwait(),
  ],
});
