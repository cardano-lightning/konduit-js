import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { builtinModules } from "node:module";

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      external: [
        // Node.js built-in modules must be externalized
        ...builtinModules,
        // Also externalize the 'commander' package itself and any other production dependencies
        "commander",
        "@scure/base",
      ],
    },
  },
});
