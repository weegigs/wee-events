import { describe, it, expect, beforeEach } from "vitest";
import { create, NatsServiceBuilder } from "./server";
import { ServiceDescription } from "@weegigs/events-core";
import * as z from "zod";

// Real service description for testing
const testEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const testServiceDescription: ServiceDescription<Record<string, never>, z.infer<typeof testEntitySchema>> = {
  info: () => ({
    version: "1.0.0",
    entity: { type: "test", schema: testEntitySchema },
  }),
  commands: () => ({
    create: z.object({ name: z.string() }),
    update: z.object({ name: z.string() }),
  }),
  events: () => ({}),
  service: (_store, _environment) => ({
    execute: async (_path, target, _command) => ({
      aggregate: target,
      state: { id: "test", name: "test" },
      version: 1,
    }),
    load: async (aggregate) => ({
      aggregate,
      state: { id: "test", name: "test" },
      version: 1,
    }),
  }),
};

describe("NatsServiceBuilder", () => {
  describe("create", () => {
    it("should create builder with valid base config", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      };

      const builder = create(testServiceDescription, config);

      expect(builder).toBeInstanceOf(NatsServiceBuilder);
      expect(builder["config"].serviceName).toBe("test-service");
      expect(builder["config"].serviceVersion).toBe("1.0.0");
      expect(builder["config"].natsUrl).toBe("nats://localhost:4222");
    });

    it("should reject invalid service name", () => {
      const config = {
        serviceName: "Test-Service",
        serviceVersion: "1.0.0",
      };

      expect(() => create(testServiceDescription, config)).toThrow("Service name must start with lowercase letter");
    });

    it("should reject invalid version", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0",
      };

      expect(() => create(testServiceDescription, config)).toThrow("Version must follow semver format");
    });
  });

  describe("builder methods", () => {
    let builder: NatsServiceBuilder<any, any>;

    beforeEach(() => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      };
      builder = create(testServiceDescription, config);
    });

    it("should add queue group configuration", () => {
      const newBuilder = builder.withQueueGroup({
        name: "worker-group",
        maxConcurrency: 20,
      });

      expect(newBuilder).toBeInstanceOf(NatsServiceBuilder);
      expect(newBuilder).not.toBe(builder); // Should return new instance
      expect(newBuilder["config"]).toHaveProperty("queueGroup");
      expect(newBuilder["config"].queueGroup.name).toBe("worker-group");
      expect(newBuilder["config"].queueGroup.maxConcurrency).toBe(20);
    });

    it("should add monitoring configuration with defaults", () => {
      const newBuilder = builder.withMonitoring();

      expect(newBuilder["config"]).toHaveProperty("monitoring");
      expect(newBuilder["config"].monitoring.interval).toBe(30_000);
      expect(newBuilder["config"].monitoring.includeMemoryStats).toBe(true);
    });

    it("should add monitoring configuration with custom values", () => {
      const newBuilder = builder.withMonitoring({
        interval: 60_000,
        includeMemoryStats: false,
        includeRequestStats: true,
      });

      expect(newBuilder["config"].monitoring.interval).toBe(60_000);
      expect(newBuilder["config"].monitoring.includeMemoryStats).toBe(false);
      expect(newBuilder["config"].monitoring.includeRequestStats).toBe(true);
    });

    it("should add telemetry configuration", () => {
      const newBuilder = builder.withTelemetry({
        sampling: {
          commands: 0.8,
          events: 0.2,
        },
        environment: "production",
      });

      expect(newBuilder["config"]).toHaveProperty("telemetry");
      expect(newBuilder["config"].telemetry.sampling.commands).toBe(0.8);
      expect(newBuilder["config"].telemetry.environment).toBe("production");
    });

    it("should add rate limit configuration", () => {
      const newBuilder = builder.withRateLimit({
        maxRequestsPerSecond: 100,
        perClient: true,
      });

      expect(newBuilder["config"]).toHaveProperty("rateLimit");
      expect(newBuilder["config"].rateLimit.maxRequestsPerSecond).toBe(100);
      expect(newBuilder["config"].rateLimit.burst).toBe(200); // Auto-calculated
      expect(newBuilder["config"].rateLimit.perClient).toBe(true);
    });

    it("should add circuit breaker configuration", () => {
      const newBuilder = builder.withCircuitBreaker({
        failureThreshold: 10,
        recoveryTimeout: 60_000,
      });

      expect(newBuilder["config"]).toHaveProperty("circuitBreaker");
      expect(newBuilder["config"].circuitBreaker.failureThreshold).toBe(10);
      expect(newBuilder["config"].circuitBreaker.recoveryTimeout).toBe(60_000);
    });

    it("should add authentication configuration", () => {
      const newBuilder = builder.withAuth({
        type: "basic",
        username: "admin",
        password: "SecurePass123",
      });

      expect(newBuilder["config"]).toHaveProperty("auth");
      expect(newBuilder["config"].auth.type).toBe("basic");
      expect((newBuilder["config"].auth as any).username).toBe("admin");
    });

    it("should add health check configuration", () => {
      const newBuilder = builder.withHealth({
        interval: 15_000,
        timeout: 3_000,
      });

      expect(newBuilder["config"]).toHaveProperty("health");
      expect(newBuilder["config"].health.interval).toBe(15_000);
      expect(newBuilder["config"].health.timeout).toBe(3_000);
    });

    it("should chain multiple configurations", () => {
      const newBuilder = builder
        .withQueueGroup({ name: "workers", maxConcurrency: 5 })
        .withMonitoring({ interval: 45_000 })
        .withRateLimit({ maxRequestsPerSecond: 50 });

      expect(newBuilder["config"]).toHaveProperty("queueGroup");
      expect(newBuilder["config"]).toHaveProperty("monitoring");
      expect(newBuilder["config"]).toHaveProperty("rateLimit");

      expect(newBuilder["config"].queueGroup.name).toBe("workers");
      expect(newBuilder["config"].monitoring.interval).toBe(45_000);
      expect(newBuilder["config"].rateLimit.maxRequestsPerSecond).toBe(50);
    });

    it("should validate configuration in each step", () => {
      expect(() => {
        builder.withQueueGroup({
          name: "Invalid-Name",
          maxConcurrency: 5,
        });
      }).toThrow("Queue group name must start with lowercase letter");

      expect(() => {
        builder.withRateLimit({
          maxRequestsPerSecond: -10,
        });
      }).toThrow("Rate limit must be positive");
    });
  });

  describe("build", () => {
    it("should return service factory function", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      };

      const builder = create(testServiceDescription, config);
      const factory = builder.build();

      expect(typeof factory).toBe("function");
    });

    it("should build service with complex configuration", () => {
      const config = {
        serviceName: "complex-service",
        serviceVersion: "2.1.0",
      };

      const builder = create(testServiceDescription, config)
        .withQueueGroup({ name: "complex-workers", maxConcurrency: 15 })
        .withMonitoring({ interval: 20_000 })
        .withTelemetry({
          sampling: { commands: 1.0, events: 0.5 },
          environment: "staging",
        });

      const factory = builder.build();
      expect(typeof factory).toBe("function");
    });
  });

  describe("type safety", () => {
    it("should maintain type information through builder chain", () => {
      const config = {
        serviceName: "typed-service",
        serviceVersion: "1.0.0",
      };

      const builder = create(testServiceDescription, config).withQueueGroup({ name: "typed-workers" }).withMonitoring();

      // TypeScript should know these properties exist
      const finalConfig = builder["config"];
      expect(finalConfig.serviceName).toBe("typed-service");
      expect(finalConfig.queueGroup.name).toBe("typed-workers");
      expect(finalConfig.monitoring.interval).toBe(30_000);
    });
  });
});
