import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { MemoryStore, AggregateId } from "@weegigs/events-core";
import { connect, NatsConnection } from "@nats-io/transport-node";
import { NatsClient } from "../client";
import { NatsService } from "../server";
import { description, Receipt } from "@weegigs/events-fastify/src/sample/receipts";

describe("Receipt Service NATS Integration Tests", () => {
  let natsContainer: StartedTestContainer;
  let natsUrl: string;

  beforeAll(async () => {
    // Start NATS server in Docker
    natsContainer = await new GenericContainer("nats:latest")
      .withExposedPorts(4222)
      .withCommand(["-js", "-m", "8222"])
      .withWaitStrategy(Wait.forLogMessage("Server is ready"))
      .withStartupTimeout(120000)
      .start();

    natsUrl = `nats://localhost:${natsContainer.getMappedPort(4222)}`;

    // Add small delay for NATS to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 120000);

  afterAll(async () => {
    if (natsContainer) {
      await natsContainer.stop();
    }
  });

  describe("Single Receipt Service Instance", () => {
    let service: NatsService<Receipt>;
    let client: NatsClient<Receipt>;
    let connection: NatsConnection;
    let store: MemoryStore;

    beforeEach(async () => {
      store = new MemoryStore();

      // Create NATS connection
      connection = await connect({
        servers: natsUrl,
        timeout: 5000,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });

      // Create and start receipt service
      service = await NatsService.create(description).connect(connection, store, {});
      await service.start();

      // Add small delay for service to fully initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create client
      client = await NatsClient.create(description).connect(natsUrl);
    });

    afterEach(async () => {
      if (client) {
        await client.close();
      }
      if (service) {
        await service.shutdown();
      }
      if (connection) {
        await connection.close();
      }
    });

    it("should execute receipt commands and queries", async () => {
      const receiptId = AggregateId.create("receipt", "receipt-123");

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

      // Fetch receipt
      const receipt = await client.fetch(receiptId);
      expect(receipt.state.status).toBe("open");
      expect(receipt.state.items).toHaveLength(2);
      expect(receipt.state.total).toBe(12.25); // (4.50 * 2) + 3.25

      // Remove an item
      await client.execute("remove-item", receiptId, { name: "Coffee" });

      // Verify removal
      const updatedReceipt = await client.fetch(receiptId);
      expect(updatedReceipt.state.items).toHaveLength(1);
      expect(updatedReceipt.state.total).toBe(3.25);

      // Finalize receipt
      await client.execute("finalize", receiptId, {});

      // Verify finalized
      const finalReceipt = await client.fetch(receiptId);
      expect(finalReceipt.state.status).toBe("closed");
    });


    it("should handle business rule violations", async () => {
      const receiptId = AggregateId.create("receipt", "error-test");

      // Fetch non-existent receipt should create it with default values
      const emptyReceipt = await client.fetch(receiptId);
      expect(emptyReceipt.aggregate.key).toBe("error-test");
      expect(emptyReceipt.state.status).toBe("open");
      expect(emptyReceipt.state.items).toEqual([]);

      // Try to finalize empty receipt should fail
      await expect(client.execute("finalize", receiptId, {})).rejects.toThrow();

      // Add item, finalize, then try to add another item
      await client.execute("add-item", receiptId, { name: "Coffee", price: 4.5, quantity: 1 });
      await client.execute("finalize", receiptId, {});
      await expect(
        client.execute("add-item", receiptId, { name: "Muffin", price: 3.25, quantity: 1 })
      ).rejects.toThrow();
    });
  });

  describe("Load Balancing", () => {
    let service1: NatsService<Receipt>;
    let service2: NatsService<Receipt>;
    let client: NatsClient<Receipt>;
    let connection1: NatsConnection;
    let connection2: NatsConnection;
    let sharedStore: MemoryStore;

    beforeEach(async () => {
      // Create single shared store for both service instances
      sharedStore = new MemoryStore();

      // Create 2 service instances sharing the same store (not 3 - that's overkill)
      connection1 = await connect({
        servers: natsUrl,
        timeout: 5000,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });

      connection2 = await connect({
        servers: natsUrl,
        timeout: 5000,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });

      service1 = await NatsService.create(description).connect(connection1, sharedStore, {});
      await service1.start();

      service2 = await NatsService.create(description).connect(connection2, sharedStore, {});
      await service2.start();

      // Single client - NATS will load balance between service instances
      client = await NatsClient.create(description).connect(natsUrl);
    });

    afterEach(async () => {
      if (client) {
        await client.close();
      }
      if (service1) {
        await service1.shutdown();
      }
      if (service2) {
        await service2.shutdown();
      }
      if (connection1) {
        await connection1.close();
      }
      if (connection2) {
        await connection2.close();
      }
    });

    it("should load balance across multiple service instances with shared store", async () => {
      const receiptId = AggregateId.create("receipt", "load-balance-test");

      // Add items using single client - NATS will load balance across service instances
      await client.execute("add-item", receiptId, { name: "Coffee", price: 4.5, quantity: 1 });
      await client.execute("add-item", receiptId, { name: "Muffin", price: 3.25, quantity: 1 });
      await client.execute("add-item", receiptId, { name: "Tea", price: 2.0, quantity: 1 });

      // Fetch - should see all items since store is shared between service instances
      const receipt = await client.fetch(receiptId);
      
      expect(receipt.state.items).toHaveLength(3);
      expect(receipt.state.items.map(item => item.name)).toEqual(
        expect.arrayContaining(["Coffee", "Muffin", "Tea"])
      );
      expect(receipt.state.total).toBe(9.75); // 4.5 + 3.25 + 2.0
      expect(receipt.state.status).toBe("open");

      // Remove item 
      await client.execute("remove-item", receiptId, { name: "Muffin" });

      // Verify removal
      const updatedReceipt = await client.fetch(receiptId);
      expect(updatedReceipt.state.items).toHaveLength(2);
      expect(updatedReceipt.state.total).toBe(6.5); // 4.5 + 2.0
    });
  });

  // Note: Event subscription functionality is not yet implemented in the NATS client
  // These tests would be added when the event subscription feature is developed

  describe("Connection Resilience", () => {
    let service: NatsService<Receipt>;
    let client: NatsClient<Receipt>;
    let connection: NatsConnection;

    beforeEach(async () => {
      const store = new MemoryStore();

      // Create NATS connection
      connection = await connect({
        servers: natsUrl,
        timeout: 5000,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });

      service = await NatsService.create(description).connect(connection, store, {});
      await service.start();
      client = await NatsClient.create(description).connect(natsUrl);
    });

    afterEach(async () => {
      if (client) {
        await client.close();
      }
      if (service) {
        await service.shutdown();
      }
      if (connection) {
        await connection.close();
      }
    });

    it("should handle graceful service shutdown", async () => {
      // Create a receipt to verify service is working
      const receiptId = AggregateId.create("receipt", "shutdown-test");
      await client.execute("add-item", receiptId, { name: "Test Item", price: 1.0, quantity: 1 });

      // Stop service gracefully
      await service.shutdown();

      // Requests should timeout since service is stopped
      await expect(
        client.execute("add-item", receiptId, { name: "Another Item", price: 2.0, quantity: 1 })
      ).rejects.toThrow();
    });
  });
});
