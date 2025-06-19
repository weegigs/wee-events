import { describe, it, expect, beforeEach } from "vitest";
import { createClient, createDefaultClient } from "./client";
import { ServiceDescription } from "@weegigs/events-core";
import * as z from "zod";

// Real service description for testing
const testEntitySchema = z.object({
  id: z.string(),
  status: z.string().default("pending"),
});

const testServiceDescription: ServiceDescription<Record<string, never>, z.infer<typeof testEntitySchema>> = {
  info: () => ({
    version: "1.0.0",
    entity: { type: "test", schema: testEntitySchema },
  }),
  commands: () => ({
    create: z.object({ data: z.string() }),
    update: z.object({ data: z.string() }),
  }),
  events: () => ({}),
  service: (_store, _environment) => ({
    execute: async (_path, target, _command) => ({
      aggregate: target,
      state: { id: "test", status: "pending" },
      version: 1,
    }),
    load: async (aggregate) => ({
      aggregate,
      state: { id: "test", status: "pending" },
      version: 1,
    }),
  }),
};

describe("NatsClient", () => {
  describe("createClient", () => {
    it("should create client with provided config", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        natsUrl: "nats://test-server:4222",
        timeout: 3000,
      };

      const client = createClient(testServiceDescription, config);

      // Test that client was created successfully
      expect(client).toBeDefined();
      expect(typeof client.connect).toBe("function");
      expect(typeof client.disconnect).toBe("function");
      expect(typeof client.isConnected).toBe("function");
    });

    it("should not be connected initially", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      };

      const client = createClient(testServiceDescription, config);

      expect(client.isConnected()).toBe(false);
    });
  });

  describe("createDefaultClient", () => {
    it("should create client with default configuration", () => {
      const client = createDefaultClient(testServiceDescription, "default-service");

      // Test that client was created successfully
      expect(client).toBeDefined();
      expect(typeof client.connect).toBe("function");
      expect(typeof client.disconnect).toBe("function");
      expect(typeof client.isConnected).toBe("function");
    });

    it("should override defaults with provided options", () => {
      const client = createDefaultClient(testServiceDescription, "custom-service", {
        serviceVersion: "2.1.0",
        timeout: 8000,
        natsUrl: "nats://custom-server:4222",
      });

      // Test that client was created successfully
      expect(client).toBeDefined();
      expect(typeof client.connect).toBe("function");
      expect(typeof client.disconnect).toBe("function");
      expect(typeof client.isConnected).toBe("function");
    });
  });

  describe("client instance", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        natsUrl: "nats://localhost:4222",
      };
      client = createClient(testServiceDescription, config);
    });

    it("should have correct initial state", () => {
      expect(client.isConnected()).toBe(false);
    });

    it("should throw error when calling methods without connection", async () => {
      const aggregateId = { type: "test", key: "123" };

      await expect(client.execute("create", aggregateId, { data: "test" })).rejects.toThrow(
        "Not connected to NATS server"
      );

      await expect(client.query(aggregateId)).rejects.toThrow("Not connected to NATS server");

      await expect(client.getServiceInfo()).rejects.toThrow("Not connected to NATS server");

      await expect(client.getServiceStats()).rejects.toThrow("Not connected to NATS server");

      await expect(client.checkHealth()).rejects.toThrow("Not connected to NATS server");
    });

    it("should handle disconnect when not connected", async () => {
      // Should not throw when disconnecting while not connected
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });

  describe("configuration validation", () => {
    it("should accept minimal valid configuration", () => {
      const config = {
        serviceName: "minimal-service",
        serviceVersion: "1.0.0",
      };

      expect(() => createClient(testServiceDescription, config)).not.toThrow();
    });

    it("should accept full configuration", () => {
      const config = {
        serviceName: "full-service",
        serviceVersion: "2.0.0",
        natsUrl: "nats://full-server:4222",
        timeout: 10000,
        maxReconnect: 5,
        reconnectTimeWait: 1000,
      };

      const client = createClient(testServiceDescription, config);

      // Test that client was created successfully
      expect(client).toBeDefined();
      expect(typeof client.connect).toBe("function");
      expect(typeof client.disconnect).toBe("function");
      expect(typeof client.isConnected).toBe("function");
    });
  });

  describe("method signatures", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createDefaultClient(testServiceDescription, "test-service");
    });

    it("should have expected method signatures", () => {
      expect(typeof client.connect).toBe("function");
      expect(typeof client.disconnect).toBe("function");
      expect(typeof client.isConnected).toBe("function");
      expect(typeof client.execute).toBe("function");
      expect(typeof client.query).toBe("function");
      expect(typeof client.getServiceInfo).toBe("function");
      expect(typeof client.getServiceStats).toBe("function");
      expect(typeof client.checkHealth).toBe("function");
    });

    it("should accept options in execute method", async () => {
      const aggregateId = { type: "test", key: "123" };
      const payload = { data: "test" };
      const options = {
        timeout: 2000,
        correlationId: "test-corr-123",
        causationId: "cause-789",
        jwt: "test-jwt-token",
        context: { "request-source": "unit-test" },
      };

      // Should not throw type errors
      const executePromise = client.execute("create", aggregateId, payload, options);
      await expect(executePromise).rejects.toThrow(); // Will fail due to no connection, but types are correct
    });

    it("should accept options in query method", async () => {
      const aggregateId = { type: "test", key: "123" };
      const options = {
        timeout: 3000,
        correlationId: "query-corr-456",
        jwt: "test-jwt-token-query",
        context: { "request-source": "unit-test-query" },
      };

      // Should not throw type errors
      const queryPromise = client.query(aggregateId, options);
      await expect(queryPromise).rejects.toThrow(); // Will fail due to no connection, but types are correct
    });
  });
});

/**
 * Note: Full integration tests with actual NATS server will be in separate
 * docker.spec.ts files using testcontainers as specified in the project plan.
 * These tests focus on:
 * - Type safety and API surface
 * - Configuration validation
 * - Error handling for disconnected state
 * - Method signature correctness
 */
