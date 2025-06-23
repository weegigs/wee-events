import { MemoryStore } from "@weegigs/events-core";
import { connect } from "@nats-io/transport-node";
import { NatsService } from "@weegigs/events-nats";
import { description } from "../core/receipts";

async function startServer() {
  const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
  
  // Connect to NATS
  const connection = await connect({
    servers: natsUrl,
    timeout: 5000,
    maxReconnectAttempts: 10,
    reconnectTimeWait: 2000,
  });

  // Create store and environment
  const store = new MemoryStore();
  const environment = {};

  // Create NATS service using new static method
  const service = await NatsService.create(description).connect(connection, store, environment);

  try {
    await service.start();
    console.log(`Receipt service running on NATS ${natsUrl}`);
    console.log(`Service type: ${description.info().entity.type}`);
    console.log(`Version: ${description.info().version}`);
    console.log(`Commands: ${Object.keys(description.commands()).join(', ')}`);
  } catch (err) {
    console.error("Failed to start NATS service:", err);
    await connection.close();
    process.exit(1);
  }

  return { service, connection };
}

async function run() {
  const { service, connection } = await startServer();

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully`);
    if (service) {
      await service.shutdown();
    }
    await connection.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

run().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
