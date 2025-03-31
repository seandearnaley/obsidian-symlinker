import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Default to node, but individual tests can override with @vitest-environment jsdom
    environment: "node",
    include: ["**/*.test.js", "**/*.test.mjs"],
    exclude: ["node_modules/**", "dist/**"],
    // Increase timeouts for coverage tests
    testTimeout: 20000,
    // Configure JSDOM environment where needed
    environmentOptions: {
      jsdom: {
        resources: "usable",
      },
    },
    // For renderer-direct.test.mjs
    environmentMatchGlobs: [["**/renderer-direct.test.mjs", "jsdom"]],
    // Silence console output during tests
    silent: true,
    // Only show errors in the console
    reporters: ["default"],
    outputTruncateLength: 80,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "test/"],
      // Make sure the coverage instrument examines our main files
      include: ["src/**/*.js"],
      // Enable all coverage features for these files
      all: true,
      // Ensure we collect all code coverage from both files
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
});
