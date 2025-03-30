import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/*.test.js", "**/*.test.mjs"],
		exclude: ["node_modules/**", "dist/**"],
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
			statements: 80
		},
	},
});
