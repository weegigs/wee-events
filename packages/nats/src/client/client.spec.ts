import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { connect, NatsConnection } from "@nats-io/transport-node";
import { MemoryStore, DespatcherDescription, LoaderDescription, ServiceDescription, AggregateId, Entity, Publisher } from "@weegigs/events-core";
import { z } from "zod";
import { NatsService } from "../server/nats-service";
import { NatsClient } from "./client";
import { UnknownCommandError, InvalidCommandPayloadError } from "./errors";

// Test entity type for client testing
const TestEntity = {
  schema: z.object({
    id: z.string(),
    value: z.number(),
    status: z.enum(["active", "inactive"])
  }),
  create: () => ({
    id: "",
    value: 0,
    status: "active" as const
  })
};

type TestEntity = z.infer<typeof TestEntity.schema>;

// Test command schemas
const SetValue = {
  name: "set-value",
  schema: z.object({
    value: z.number()
  })
};

const SetStatus = {
  name: "set-status", 
  schema: z.object({
    status: z.enum(["active", "inactive"])
  })
};

// Simple test event
const ValueSet = {
  name: "value-set",
  schema: z.object({
    value: z.number()
  })
};

// Command handlers
const setValueHandler = async (_environment: Publisher, _entity: Entity<TestEntity>, _command: { value: number }) => {
  await _environment.publish(_entity.aggregate, {
    type: ValueSet.name,
    data: { value: _command.value }
  });
};

const setStatusHandler = async (_environment: Publisher, _entity: Entity<TestEntity>, _command: { status: string }) => {
  // Simple handler for testing
};

// Event reducer
const valueSetReducer = (state: TestEntity, event: { data: { value: number } }): TestEntity => ({
  ...state,
  value: event.data.value
});

// Test service description
const testDescription = ServiceDescription.create(
  { 
    title: "Test Client Service", 
    description: "Service for testing NatsClient", 
    version: "1.0.0" 
  },
  LoaderDescription.fromInitFunction<TestEntity>(
    { type: "test-entity", schema: TestEntity.schema },
    TestEntity.create
  )
    .reducer(ValueSet.name, ValueSet.schema, valueSetReducer)
    .description(),
  DespatcherDescription.handler(SetValue.name, SetValue.schema, setValueHandler)
    .handler(SetStatus.name, SetStatus.schema, setStatusHandler)
    .description()
);

describe("NatsClient Integration Tests", () => {
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

  describe("Client Lifecycle", () => {
    let service: NatsService<TestEntity>;
    let client: NatsClient<TestEntity>;
    let connection: NatsConnection;
    let store: MemoryStore;

    beforeEach(async () => {
      store = new MemoryStore();

      // Create NATS connection for service
      connection = await connect({
        servers: natsUrl,
        timeout: 5000,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });

      // Create and start test service
      service = await NatsService.create(testDescription).connect(connection, store, {});
      await service.start();

      // Create client
      client = await NatsClient.create(testDescription).connect(natsUrl);

      // Small delay for service registration
      await new Promise(resolve => setTimeout(resolve, 100));
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

    it("should create client using static factory method", async () => {
      expect(client).toBeDefined();
      expect(typeof client.execute).toBe("function");
      expect(typeof client.fetch).toBe("function");
      expect(typeof client.close).toBe("function");
    });

    it("should execute valid commands", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "test-1" };
      
      const result = await client.execute(SetValue.name, aggregateId, { value: 42 });
      
      expect(result).toBeDefined();
      expect(result.aggregate).toEqual(aggregateId);
      expect(result.state.value).toBe(42);
    });

    it("should fetch entities", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "test-2" };
      
      // First execute a command to create some state
      await client.execute(SetValue.name, aggregateId, { value: 100 });
      
      // Then fetch the entity
      const entity = await client.fetch(aggregateId);
      
      expect(entity).toBeDefined();
      expect(entity.aggregate).toEqual(aggregateId);
      expect(entity.state.value).toBe(100);
    });

    it("should handle multiple commands on same entity", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "test-3" };
      
      // Execute multiple commands
      await client.execute(SetValue.name, aggregateId, { value: 10 });
      await client.execute(SetStatus.name, aggregateId, { status: "inactive" });
      await client.execute(SetValue.name, aggregateId, { value: 20 });
      
      const entity = await client.fetch(aggregateId);
      expect(entity.state.value).toBe(20);
    });

    it("should throw UnknownCommandError for invalid commands", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "test-4" };
      
      await expect(
        client.execute("unknown-command", aggregateId, {})
      ).rejects.toThrow(UnknownCommandError);
    });

    it("should throw InvalidCommandPayloadError for invalid payloads", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "test-5" };
      
      await expect(
        client.execute(SetValue.name, aggregateId, { value: "not-a-number" })
      ).rejects.toThrow(InvalidCommandPayloadError);
    });

    it("should handle command with missing required fields", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "test-6" };
      
      await expect(
        client.execute(SetValue.name, aggregateId, {})
      ).rejects.toThrow(InvalidCommandPayloadError);
    });

    it("should close connection properly", async () => {
      expect(client).toBeDefined();
      
      await client.close();
      
      // After closing, operations should fail
      const aggregateId: AggregateId = { type: "test-entity", key: "test-7" };
      await expect(
        client.execute(SetValue.name, aggregateId, { value: 1 })
      ).rejects.toThrow();
    });

    it("should handle fetch for non-existent entity", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "non-existent" };
      
      const entity = await client.fetch(aggregateId);
      
      expect(entity).toBeDefined();
      expect(entity.aggregate).toEqual(aggregateId);
      expect(entity.state).toEqual(TestEntity.create());
    });

    it("should handle custom request options", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "test-8" };
      
      const result = await client.execute(
        SetValue.name, 
        aggregateId, 
        { value: 999 },
        { timeout: 10000 }
      );
      
      expect(result.state.value).toBe(999);
    });
  });

  describe("Error Handling", () => {
    it("should handle connection failure during client creation", async () => {
      await expect(
        NatsClient.create(testDescription).connect("nats://invalid-url:4222")
      ).rejects.toThrow();
    });
  });

  describe("Command Validation", () => {
    let client: NatsClient<TestEntity>;

    beforeEach(async () => {
      client = await NatsClient.create(testDescription).connect(natsUrl);
    });

    afterEach(async () => {
      if (client) {
        await client.close();
      }
    });

    it("should validate command exists before sending", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "validation-test" };
      
      const error = await client.execute("nonexistent", aggregateId, {}).catch(e => e);
      
      expect(error).toBeInstanceOf(UnknownCommandError);
      expect(error.command).toBe("nonexistent");
      expect(error.availableCommands).toContain(SetValue.name);
      expect(error.availableCommands).toContain(SetStatus.name);
    });

    it("should validate payload schema before sending", async () => {
      const aggregateId: AggregateId = { type: "test-entity", key: "validation-test-2" };
      
      const error = await client.execute(SetValue.name, aggregateId, { invalid: true }).catch(e => e);
      
      expect(error).toBeInstanceOf(InvalidCommandPayloadError);
      expect(error.command).toBe(SetValue.name);
    });
  });
});