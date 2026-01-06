import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.js", "lib/**/__tests__/**/*.test.js"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
