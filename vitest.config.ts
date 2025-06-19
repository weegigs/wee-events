import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Set a generous timeout for all tests and hooks.
     * Tests involving Testcontainers can take a while to start up,
     * as they need to pull Docker images and wait for containers to be ready.
     * 60 seconds should be more than enough for most cases.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,

    /**
     * Disable global APIs (describe, it, expect, etc.).
     * This enforces that all test files must explicitly import these
     * functions from 'vitest', leading to more self-contained and readable tests.
     */
    globals: false,

    /**
     * Use the standard 'node' environment.
     * Testcontainers works by communicating with the Docker daemon from the Node.js process.
     */
    environment: "node",

    /**
     * Exclude compiled output directories from test runs.
     * This is the crucial setting that prevents Vitest from accidentally running tests
     * on the compiled JavaScript files in the `lib` directory, which can lead to
     * confusing errors when the source and compiled code are out of sync.
     */
    exclude: ["**/node_modules/**", "**/lib/**", "**/dist/**", "**/build/**"],
  },
});
