import { MemoryStore } from "@weegigs/events-core";
import { create } from "../index";
import { description, receiptErrorMapper } from "./receipts";

async function startServer() {
  const store = new MemoryStore();
  const serverFactory = create(description, { errorMapper: receiptErrorMapper });
  const server = await serverFactory(store, {});

  // Add health check endpoint
  server.get('/healthz', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Start server
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`Receipt service running on http://${host}:${port}`);
    console.log(`OpenAPI docs available at http://${host}:${port}/openapi/documentation`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});