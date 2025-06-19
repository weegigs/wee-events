import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { createMemoryEventStore } from "@weegigs/events-core";
import { create } from "../server";
import { createClient } from "../client";
import { NatsService } from "../server";
import { NatsClient } from "../client";
import { description } from "@weegigs/events-fastify/src/sample/receipts";

describe("Receipt Service NATS Integration Tests", () => {
  let natsContainer: StartedTestContainer;
  let natsUrl: string;

  beforeAll(async () => {
    // Start NATS server in Docker
    natsContainer = await new GenericContainer("nats:2.10")
      .withExposedPorts(4222)
      .withCommand(["-js", "-m", "8222"])
      .start();

    natsUrl = `nats://localhost:${natsContainer.getMappedPort(4222)}`;
  });

  afterAll(async () => {
    if (natsContainer) {
      await natsContainer.stop();
    }
  });

  describe("Single Receipt Service Instance", () => {
    let service: NatsService;
    let client: NatsClient;
    let store: any;

    beforeEach(async () => {
      store = createMemoryEventStore();

      // Create and start receipt service
      const serviceFactory = create(description, {
        serviceName: "receipt-service",
        serviceVersion: "1.0.0",
        natsUrl,
      })
        .withQueueGroup({ name: "receipt-workers" })
        .withMonitoring()
        .withHealth()
        .build();

      service = await serviceFactory(store, {});
      await service.start();

      // Create client
      client = createClient(description, {
        serviceName: "receipt-service",
        serviceVersion: "1.0.0",
        natsUrl,
      });
      await client.connect();
    });

    afterEach(async () => {
      if (client) {
        await client.disconnect();
      }
      if (service) {
        await service.stop();
      }
    });

    it("should execute receipt commands and queries", async () => {
      const receiptId = "receipt-123";

      // Add items to receipt
      await client.execute("add-item", receiptId, {
        name: "Coffee",
        price: 4.5,
        quantity: 2,
      });

      await client.execute("add-item", receiptId, {
        name: "Muffin",
        price: 3.25,
        quantity: 1,
      });

      // Query receipt
      const receipt = await client.query(receiptId);
      expect(receipt.state.status).toBe("open");
      expect(receipt.state.items).toHaveLength(2);
      expect(receipt.state.total).toBe(12.25); // (4.50 * 2) + 3.25

      // Remove an item
      await client.execute("remove-item", receiptId, { name: "Coffee" });

      // Verify removal
      const updatedReceipt = await client.query(receiptId);
      expect(updatedReceipt.state.items).toHaveLength(1);
      expect(updatedReceipt.state.total).toBe(3.25);

      // Finalize receipt
      await client.execute("finalize", receiptId, {});

      // Verify finalized
      const finalReceipt = await client.query(receiptId);
      expect(finalReceipt.state.status).toBe("closed");
    });

    it("should handle service discovery", async () => {
      const serviceInfo = await client.getServiceInfo();
      expect(serviceInfo.name).toBe("receipt-service");
      expect(serviceInfo.version).toBe("1.0.0");
      expect(serviceInfo.endpoints).toHaveLength(5); // 1 query + 4 commands (add-item, remove-item, finalize, void-receipt)
    });

    it("should provide service statistics", async () => {
      const receiptId = "stats-test";

      // Execute some commands to generate stats
      await client.execute("add-item", receiptId, { name: "Coffee", price: 4.5, quantity: 1 });
      await client.query(receiptId);
      await client.execute("finalize", receiptId, {});

      const stats = await client.getServiceStats();
      expect(stats.name).toBe("receipt-service");
      expect(stats.total_requests).toBeGreaterThan(0);
      expect(stats.endpoints).toHaveLength(5);
    });

    it("should respond to health checks", async () => {
      const health = await client.checkHealth();
      expect(health.name).toBe("receipt-service");
      expect(health.status).toBe("ok");
    });

    it("should handle business rule violations", async () => {
      const receiptId = "error-test";

      // Try to query non-existent receipt
      await expect(client.query(receiptId)).rejects.toThrow();

      // Try to finalize empty receipt
      await expect(client.execute("finalize", receiptId, {})).rejects.toThrow();

      // Add item, finalize, then try to add another item
      await client.execute("add-item", receiptId, { name: "Coffee", price: 4.5, quantity: 1 });
      await client.execute("finalize", receiptId, {});
      await expect(
        client.execute("add-item", receiptId, { name: "Muffin", price: 3.25, quantity: 1 })
      ).rejects.toThrow();
    });
  });

  describe("Multiple Service Instances (Queue Groups)", () => {
    let services: NatsService[];
    let clients: NatsClient[];
    let stores: any[];

    beforeEach(async () => {
      services = [];
      clients = [];
      stores = [];

      // Create 3 service instances with same queue group
      for (let i = 0; i < 3; i++) {
        const store = createMemoryEventStore();
        stores.push(store);

        const serviceFactory = create(description, {
          serviceName: "multi-receipt-service",
          serviceVersion: "1.0.0",
          natsUrl,
        })
          .withQueueGroup({ name: "multi-receipt-group" })
          .withMonitoring()
          .build();

        const service = await serviceFactory(store, {});
        await service.start();
        services.push(service);

        // Create client for each service instance
        const client = createClient(description, {
          serviceName: "multi-receipt-service",
          serviceVersion: "1.0.0",
          natsUrl,
        });
        await client.connect();
        clients.push(client);
      }
    });

    afterEach(async () => {
      // Clean up all clients and services
      for (const client of clients) {
        await client.disconnect();
      }
      for (const service of services) {
        await service.stop();
      }
    });

    it("should distribute commands across queue group members", async () => {
      const aggregateId = "distributed-test";
      const numRequests = 10;

      // Execute multiple commands - they should be distributed across services
      // Note: Each service has its own event store, so we need to use different aggregates
      const promises = [];
      for (let i = 0; i < numRequests; i++) {
        const client = clients[i % clients.length];
        promises.push(client.execute("create", `${aggregateId}-${i}`, { name: `Entity ${i}` }));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(numRequests);

      // Verify all commands succeeded
      results.forEach((result, index) => {
        expect(result.state.name).toBe(`Entity ${index}`);
        expect(result.state.count).toBe(0);
      });
    });

    it("should handle service discovery from multiple instances", async () => {
      // All instances should respond to service discovery
      const client = clients[0];
      const serviceInfo = await client.getServiceInfo();

      expect(serviceInfo.name).toBe("multi-receipt-service");
      expect(serviceInfo.version).toBe("1.0.0");
      expect(serviceInfo.endpoints).toHaveLength(4);
    });
  });

  describe("Event Subscriptions", () => {
    let service: NatsService;
    let client: NatsClient;
    let store: any;

    beforeEach(async () => {
      store = createMemoryEventStore();

      const serviceFactory = create(description, {
        serviceName: "event-test-service",
        serviceVersion: "1.0.0",
        natsUrl,
      }).build();

      service = await serviceFactory(store, {});
      await service.start();

      client = createClient(description, {
        serviceName: "event-test-service",
        serviceVersion: "1.0.0",
        natsUrl,
      });
      await client.connect();
    });

    afterEach(async () => {
      if (client) {
        await client.disconnect();
      }
      if (service) {
        await service.stop();
      }
    });

    it("should receive specific event notifications", async () => {
      const events: any[] = [];

      // Subscribe to 'created' events
      await client.subscribeToEvents("created", async (event) => {
        events.push(event);
      });

      // Give subscription time to be established
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Execute command that triggers event
      const aggregateId = "event-test";
      await client.execute("create", aggregateId, { name: "Event Test" });

      // Wait for event to be received
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("created");
      expect(events[0].data.name).toBe("Event Test");
    });

    it("should receive all events for an aggregate type", async () => {
      const events: any[] = [];

      // Subscribe to all events for the test aggregate
      await client.subscribeToAggregateEvents("test", async (event) => {
        events.push(event);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Execute multiple commands
      const aggregateId = "aggregate-event-test";
      await client.execute("create", aggregateId, { name: "Aggregate Test" });
      await client.execute("increment", aggregateId, { amount: 3 });
      await client.execute("rename", aggregateId, { newName: "Renamed Test" });

      // Wait for events to be received
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(events.length).toBeGreaterThanOrEqual(3);

      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain("created");
      expect(eventTypes).toContain("incremented");
      expect(eventTypes).toContain("renamed");
    });
  });

  describe("Connection Resilience", () => {
    let service: NatsService;
    let client: NatsClient;

    beforeEach(async () => {
      const store = createMemoryEventStore();

      const serviceFactory = create(description, {
        serviceName: "resilience-test",
        serviceVersion: "1.0.0",
        natsUrl,
      }).build();

      service = await serviceFactory(store, {});
      await service.start();

      client = createClient(description, {
        serviceName: "resilience-test",
        serviceVersion: "1.0.0",
        natsUrl,
        maxReconnect: 5,
        reconnectTimeWait: 100,
      });
      await client.connect();
    });

    afterEach(async () => {
      if (client) {
        await client.disconnect();
      }
      if (service) {
        await service.stop();
      }
    });

    it("should handle graceful service shutdown", async () => {
      // Verify service is running
      expect(service.isRunning()).toBe(true);
      expect(client.isConnected()).toBe(true);

      // Create an entity to verify service is working
      const aggregateId = "shutdown-test";
      await client.execute("create", aggregateId, { name: "Shutdown Test" });

      // Stop service gracefully
      await service.stop();
      expect(service.isRunning()).toBe(false);

      // Client should still be connected to NATS, but service requests should fail
      expect(client.isConnected()).toBe(true);

      // Requests should timeout since service is stopped
      await expect(client.execute("increment", aggregateId, { amount: 1 })).rejects.toThrow();
    });
  });
});
