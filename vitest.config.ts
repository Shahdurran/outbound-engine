import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The suite runs entirely offline: replay fixtures for the model, the
    // SQLite page cache for the network.
    testTimeout: 20_000,
  },
});
