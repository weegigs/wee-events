import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { NatsServiceBuilder } from "../server";
import type { ServiceDescription } from "@weegigs/events-core/service";
import * as z from "zod";

describe("Queue Groups Feature", () => {
  let natsContainer: StartedTestContainer;
  let natsUrl: string;

  beforeAll(async () => {
    natsContainer = await new GenericContainer("nats:2.10-alpine").withExposedPorts(4222).start();

    natsUrl = `nats://localhost:${natsContainer.getMappedPort(4222)}`;
  });

  afterAll(async () => {
    await natsContainer.stop();
  });

  describe("horizontal scaling with queue groups", () => {
    it("should build services with queue group configuration", () => {
      // Define test service
      const testState = z.object({
        counter: z.number().default(0),
      });

      const testDescription: ServiceDescription<Record<string, never>, z.infer<typeof testState>> = {
        info: () => ({
          version: "1.0.0",
          entity: { type: "counter", schema: testState },
        }),
        commands: () => ({
          increment: z.object({ amount: z.number().default(1) }),
        }),
        events: () => ({}),
        service: (_store, _environment) => ({
          execute: async (_path, target, _command) => ({
            aggregate: target,
            state: { counter: 0 },
            version: 1,
          }),
          load: async (aggregate) => ({
            aggregate,
            state: { counter: 0 },
            version: 1,
          }),
        }),
      };

      // Test that builder correctly applies queue group configuration
      const builder1 = new NatsServiceBuilder(testDescription, {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        natsUrl,
      }).withQueueGroup({
        name: "test-workers",
        maxConcurrency: 5,
      });

      const builder2 = new NatsServiceBuilder(testDescription, {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        natsUrl,
      }).withQueueGroup({
        name: "test-workers", // Same queue group name
        maxConcurrency: 3,
      });

      // Verify builders have correct configuration
      expect(builder1["config"]).toMatchObject({
        serviceName: "test-service",
        queueGroup: {
          name: "test-workers",
          maxConcurrency: 5,
        },
      });

      expect(builder2["config"]).toMatchObject({
        serviceName: "test-service",
        queueGroup: {
          name: "test-workers",
          maxConcurrency: 3,
        },
      });

      // Verify build() returns a factory function
      const factory1 = builder1.build();
      const factory2 = builder2.build();

      expect(typeof factory1).toBe("function");
      expect(typeof factory2).toBe("function");
    });

    it("should validate queue group configuration in builder", () => {
      // Define test service
      const testState = z.object({
        processed: z.boolean().default(false),
      });

      const testDescription: ServiceDescription<Record<string, never>, z.infer<typeof testState>> = {
        info: () => ({
          version: "1.0.0",
          entity: { type: "task", schema: testState },
        }),
        commands: () => ({
          process: z.object({ taskId: z.string() }),
        }),
        events: () => ({}),
        service: (store, environment) => ({
          execute: async (path, target, command) => ({
            aggregate: target,
            state: { processed: false },
            version: 1,
          }),
          load: async (aggregate) => ({
            aggregate,
            state: { processed: false },
            version: 1,
          }),
        }),
      };

      // Test that different queue group configurations work
      const builder1 = new NatsServiceBuilder(testDescription, {
        serviceName: "failover-service",
        serviceVersion: "1.0.0",
        natsUrl,
      }).withQueueGroup({
        name: "task-workers",
        maxConcurrency: 3,
      });

      const builder2 = new NatsServiceBuilder(testDescription, {
        serviceName: "failover-service",
        serviceVersion: "1.0.0",
        natsUrl,
      }).withQueueGroup({
        name: "task-workers",
        maxConcurrency: 5,
      });

      // Both builders should have valid configurations
      expect(builder1["config"].queueGroup.name).toBe("task-workers");
      expect(builder1["config"].queueGroup.maxConcurrency).toBe(3);

      expect(builder2["config"].queueGroup.name).toBe("task-workers");
      expect(builder2["config"].queueGroup.maxConcurrency).toBe(5);
    });
  });

  describe("queue group configuration validation", () => {
    it("should validate queue group name format", () => {
      const testState = z.object({});

      const testDescription: ServiceDescription<Record<string, never>, z.infer<typeof testState>> = {
        info: () => ({
          version: "1.0.0",
          entity: { type: "test", schema: testState },
        }),
        commands: () => ({}),
        events: () => ({}),
        service: (store, environment) => ({
          execute: async (path, target, command) => ({
            aggregate: target,
            state: {},
            version: 1,
          }),
          load: async (aggregate) => ({
            aggregate,
            state: {},
            version: 1,
          }),
        }),
      };

      // Valid queue group name
      expect(() => {
        new NatsServiceBuilder(testDescription, {
          serviceName: "test-service",
          serviceVersion: "1.0.0",
          natsUrl,
        }).withQueueGroup({
          name: "valid-queue-name",
          maxConcurrency: 5,
        });
      }).not.toThrow();

      // Invalid queue group names should throw during validation
      const invalidNames = [
        "", // empty
        "Queue-Name", // uppercase
        "queue_name", // underscore
        "queue.name", // dot
        "1queue", // starts with number
      ];

      invalidNames.forEach((name) => {
        expect(() => {
          new NatsServiceBuilder(testDescription, {
            serviceName: "test-service",
            serviceVersion: "1.0.0",
            natsUrl,
          }).withQueueGroup({
            name,
            maxConcurrency: 5,
          });
        }).toThrow();
      });
    });

    it("should validate max concurrency limits", () => {
      const testState = z.object({});

      const testDescription: ServiceDescription<Record<string, never>, z.infer<typeof testState>> = {
        info: () => ({
          version: "1.0.0",
          entity: { type: "test", schema: testState },
        }),
        commands: () => ({}),
        events: () => ({}),
        service: (store, environment) => ({
          execute: async (path, target, command) => ({
            aggregate: target,
            state: {},
            version: 1,
          }),
          load: async (aggregate) => ({
            aggregate,
            state: {},
            version: 1,
          }),
        }),
      };

      // Valid concurrency values
      [1, 10, 100, 1000].forEach((concurrency) => {
        expect(() => {
          new NatsServiceBuilder(testDescription, {
            serviceName: "test-service",
            serviceVersion: "1.0.0",
            natsUrl,
          }).withQueueGroup({
            name: "test-queue",
            maxConcurrency: concurrency,
          });
        }).not.toThrow();
      });

      // Invalid concurrency values
      [0, -1, 1001, 1.5].forEach((concurrency) => {
        expect(() => {
          new NatsServiceBuilder(testDescription, {
            serviceName: "test-service",
            serviceVersion: "1.0.0",
            natsUrl,
          }).withQueueGroup({
            name: "test-queue",
            maxConcurrency: concurrency,
          });
        }).toThrow();
      });
    });
  });
});
