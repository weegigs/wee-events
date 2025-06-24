import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { connect, NatsConnection } from "@nats-io/transport-node";
import { MemoryStore, DispatcherDescription, LoaderDescription, ServiceDescription } from "@weegigs/events-core";
import { NatsService } from "./nats-service";
import { z } from "zod";

// Simplified receipt type for testing
const Receipt = {
  schema: z.object({
    status: z.enum(["open", "closed", "voided"]),
    items: z.array(z.object({
      name: z.string(),
      price: z.number(),
      quantity: z.number()
    })),
    total: z.number()
  }),
  create: () => ({
    status: "open" as const,
    items: [],
    total: 0
  })
};

type Receipt = z.infer<typeof Receipt.schema>;

// Simplified service description for testing
const description = ServiceDescription.create(
  { 
    title: "Test Receipt Service", 
    description: "Test service for NATS discovery", 
    version: "1.0.0" 
  },
  LoaderDescription.fromInitFunction<Receipt>(
    { type: "receipt", schema: Receipt.schema },
    Receipt.create
  ).description(),
  DispatcherDescription.handler("test", z.object({}), async () => {}).description()
);

interface ServiceDiscoveryResponse {
  name: string;
  type: string;
  version?: string;
  endpoints?: Array<{ subject: string }>;
  started?: string;
}

/**
 * Test to verify NATS microservices subject naming conventions and service discovery
 */
describe("NATS Service Discovery", () => {
  let natsContainer: StartedTestContainer;
  let natsUrl: string;
  let connection: NatsConnection;
  let service: NatsService<Receipt>;

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
    if (natsContainer !== undefined) {
      await natsContainer.stop();
    }
  });

  beforeEach(async () => {
    // Create NATS connection
    connection = await connect({
      servers: natsUrl,
      timeout: 5000,
      maxReconnectAttempts: 10,
      reconnectTimeWait: 2000,
    });

    // Create and start service
    const store = new MemoryStore();
    service = await NatsService.create(description).connect(connection, store, {}) as NatsService<Receipt>;
    await service.start();

    // Add delay for service to register
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000); // 10 second timeout for beforeEach

  afterEach(async () => {
    if (service !== undefined) {
      await service.shutdown();
    }
    if (connection !== undefined) {
      await connection.close();
    }
  }, 10000); // 10 second timeout for afterEach

  it("should respond to $SRV.PING", async () => {
    const pingResponse = await connection.request("$SRV.PING", "", { timeout: 1000 });
    const pingData = pingResponse.json() as ServiceDiscoveryResponse;
    
    expect(pingData.name).toBe("receipt");
    expect(pingData.type).toBe("io.nats.micro.v1.ping_response");
  });

  it("should respond to $SRV.INFO with service metadata", async () => {
    const infoResponse = await connection.request("$SRV.INFO", "", { timeout: 1000 });
    const infoData = infoResponse.json() as ServiceDiscoveryResponse;
    
    expect(infoData.name).toBe("receipt");
    expect(infoData.version).toBe("1.0.0");
    expect(infoData.endpoints).toHaveLength(2); // 1 test command + 1 fetch
    
    // Verify expected endpoints are present with service prefix
    expect(infoData.endpoints).toBeDefined();
    const endpointSubjects = infoData.endpoints?.map((ep: { subject: string }) => ep.subject) ?? [];
    expect(endpointSubjects).toContain("receipt.commands.test");
    expect(endpointSubjects).toContain("receipt.fetch");
  });

  it("should respond to $SRV.STATS with service statistics", async () => {
    const statsResponse = await connection.request("$SRV.STATS", "", { timeout: 1000 });
    const statsData = statsResponse.json() as ServiceDiscoveryResponse;
    
    expect(statsData.name).toBe("receipt");
    expect(statsData.type).toBe("io.nats.micro.v1.stats_response");
    expect(typeof statsData.started).toBe("string");
  });

  it("should respond to targeted $SRV.PING.receipt", async () => {
    const targetedPingResponse = await connection.request("$SRV.PING.receipt", "", { timeout: 1000 });
    const targetedPingData = targetedPingResponse.json() as ServiceDiscoveryResponse;
    
    expect(targetedPingData.name).toBe("receipt");
  });

  it("should use service-prefixed subject naming pattern", async () => {
    const infoResponse = await connection.request("$SRV.INFO", "", { timeout: 1000 });
    const infoData = infoResponse.json() as ServiceDiscoveryResponse;
    expect(infoData.endpoints).toBeDefined();
    const endpointSubjects = infoData.endpoints?.map((ep: { subject: string }) => ep.subject) ?? [];
    
    // Verify expected endpoints are present with service prefix
    expect(endpointSubjects).toContain("receipt.commands.test");
    expect(endpointSubjects).toContain("receipt.fetch");
    
    // Verify direct endpoints (without service prefix) are NOT present
    expect(endpointSubjects).not.toContain("commands.test");
    expect(endpointSubjects).not.toContain("fetch");
  });
});