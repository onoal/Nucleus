import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist"],
    },
  },
  resolve: {
    alias: {
      "@noble/curves/ed25519": resolve(
        __dirname,
        "../../node_modules/@noble/curves/ed25519.js"
      ),
    },
    conditions: ["import", "module", "browser", "default"],
  },
});
