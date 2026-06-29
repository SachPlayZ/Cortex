import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@cortex/shared": new URL("../../packages/shared/src/index.ts", import.meta.url).pathname
    }
  }
});
