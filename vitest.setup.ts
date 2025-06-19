// vitest.setup.ts
import { beforeAll, afterAll } from 'vitest';

/**
 * This setup file is executed once per test file before any tests are run.
 * It's the ideal place for global setup and teardown logic.
 *
 * For example, you can use these hooks to:
 * - Set up and tear down a database connection.
 * - Start and stop a shared server or service.
 * - Clear and seed a database before tests run.
 *
 * Note: Testcontainers also has a dedicated extension for Vitest (`@testcontainers/vitest`)
 * that can manage container lifecycles declaratively in `vitest.config.ts`,
 * which can be a cleaner alternative for managing container resources.
 */

beforeAll(() => {
  // This hook runs once before all tests in a single test file.
  // console.log('Executing global setup for a test file...');
});

afterAll(() => {
  // This hook runs once after all tests in a single test file have completed.
  // console.log('Executing global teardown for a test file...');
});
