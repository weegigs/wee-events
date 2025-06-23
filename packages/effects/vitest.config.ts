import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          statements: 30,
          branches: 30,
          functions: 30,
          lines: 30,
        },
      },
    },
  })
);