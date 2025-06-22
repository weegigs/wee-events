# @weegigs/events-nats

Production-ready NATS service infrastructure for wee-events aggregates. Build distributed, event-sourced microservices with type-safe configuration, horizontal scaling, and comprehensive observability.

## Features

- 🏗️ **Type Intersection Builder Pattern** - Composable, type-safe configuration
- 🔄 **Horizontal Scaling** - Queue groups for load balancing across service instances
- 📊 **Built-in Monitoring** - NATS micro service protocol with stats and health checks
- 🔍 **OpenTelemetry Integration** - Structured logging with trace context propagation
- 🧪 **Testcontainers Ready** - Real NATS integration tests, no mocks
- ⚡ **High Performance** - Minimal overhead with efficient message handling
- 🛡️ **Error Resilience** - Promise.allSettled for graceful shutdown

## Installation

```bash
pnpm add @weegigs/events-nats
```

## Quick Start

### 1. Define Your Service

```typescript
import { z } from "zod";
import { ServiceDescription } from "@weegigs/events-core";

// Entity schema
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  status: z.enum(["active", "inactive"]),
});

type User = z.infer<typeof userSchema>;

// Service description
const userServiceDescription: ServiceDescription<{}, User> = {
  info: () => ({
    name: "user-service",
    version: "1.0.0",
    description: "User management service",
    entity: { type: "user", schema: userSchema }
  }),
  
  commands: () => ({
    create: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    updateEmail: z.object({
      email: z.string().email(),
    }),
    deactivate: z.object({}),
  }),
  
  events: () => ({
    created: z.object({
      name: z.string(),
      email: z.string(),
    }),
    emailUpdated: z.object({
      oldEmail: z.string(),
      newEmail: z.string(),
    }),
    deactivated: z.object({
      reason: z.string().optional(),
    }),
  }),
  
  service: (store, environment) => ({
    // Command handlers
    execute: async (commandName, aggregateId, command) => {
      // Your business logic here
    },
    
    // Query handler
    load: async (aggregateId) => {
      // Your query logic here
    }
  })
};
```

### 2. Create a NATS Service

```typescript
import { create } from "@weegigs/events-nats";
import { createMemoryEventStore } from "@weegigs/events-core";

// Create service with progressive enhancement
const serviceFactory = create(userServiceDescription, {
  serviceName: "user-service",
  serviceVersion: "1.0.0",
  natsUrl: "nats://localhost:4222",
})
  .withQueueGroup({ name: "user-service-group" })  // Horizontal scaling
  .withMonitoring()                                // Stats and metrics
  .withHealth()                                    // Health checks
  .build();

// Start the service
const store = createMemoryEventStore();
const service = await serviceFactory(store, {});
await service.start();

console.log("User service running!");
```

### 3. Create a NATS Client

```typescript
import { createClient } from "@weegigs/events-nats";

// Create type-safe client
const client = createClient(userServiceDescription, {
  serviceName: "user-service",
  serviceVersion: "1.0.0",
  natsUrl: "nats://localhost:4222",
});

await client.connect();

// Execute commands
const result = await client.execute("create", "user-123", {
  name: "John Doe",
  email: "john@example.com",
});

// Fetch state
const user = await client.fetch("user-123");
console.log(user.state); // { id: "user-123", name: "John Doe", ... }

// Subscribe to events
await client.subscribeToEvents("created", async (event) => {
  console.log("User created:", event.data);
});
```

## Configuration Options

### Base Configuration

```typescript
interface NatsServiceConfig {
  serviceName: string;        // Service identifier (kebab-case)
  serviceVersion: string;     // Semantic version
  natsUrl?: string;          // Default: "nats://localhost:4222"
}
```

### Available Features

#### Queue Groups (Horizontal Scaling)

```typescript
.withQueueGroup({ name: "my-service-group" })
```

Enables multiple service instances to share the load. Commands are automatically distributed across healthy instances in the queue group.

#### Monitoring

```typescript
.withMonitoring()
```

Provides NATS micro service protocol endpoints:
- `{serviceName}.$SRV.STATS` - Request/error statistics
- `{serviceName}.$SRV.INFO` - Service discovery information

#### Health Checks

```typescript
.withHealth()
```

Adds health check endpoint:
- `{serviceName}.$SRV.PING` - Service health status

#### OpenTelemetry Logging

```typescript
.withTelemetry()
```

Enables structured JSON logging with trace context propagation. Logs include:
- Correlation IDs
- User context
- Operation timing
- Error details

## Message Patterns

### Subject Structure

```
{serviceName}.command.{aggregateType}.{commandName}
{serviceName}.query.{aggregateType}.get
{serviceName}.events.{aggregateType}.{eventType}
{serviceName}.$SRV.INFO
{serviceName}.$SRV.STATS
{serviceName}.$SRV.PING
```

### Message Types

All messages are validated with Zod schemas:

```typescript
// Command Request
{
  aggregateId: string,
  command: unknown,          // Validated per command schema
  metadata: {
    correlationId: string,
    timestamp: string,
    userId?: string,
    causationId?: string,
  }
}

// Command Response
{
  success: boolean,
  result?: any,             // Command result on success
  error?: {                 // Error details on failure
    code: string,
    message: string,
  },
  metadata: {
    correlationId: string,
    timestamp: string,
    duration: number,       // Processing time in ms
  }
}
```

## Testing Strategy

### Unit Tests (Pure Functions)

Test configuration validation, message encoding/decoding, and business logic without external dependencies:

```typescript
// src/types/config.spec.ts
describe("Configuration Validation", () => {
  it("should validate service config", () => {
    const config = NatsServiceConfig.schema.parse({
      serviceName: "test-service",
      serviceVersion: "1.0.0",
    });
    expect(config.natsUrl).toBe("nats://localhost:4222");
  });
});
```

### Integration Tests (Testcontainers)

Test against real NATS server for distributed scenarios:

```typescript
// src/sample/docker.spec.ts
import { GenericContainer } from "testcontainers";

describe("NATS Integration Tests", () => {
  let natsContainer: StartedTestContainer;
  let natsUrl: string;

  beforeAll(async () => {
    natsContainer = await new GenericContainer("nats:2.10")
      .withExposedPorts(4222)
      .start();
    
    natsUrl = `nats://localhost:${natsContainer.getMappedPort(4222)}`;
  });

  afterAll(async () => {
    await natsContainer.stop();
  });

  it("should distribute commands across queue group", async () => {
    // Test multiple service instances with real NATS
  });
});
```

### Testing Philosophy

**No Mocks Policy**: All tests use real implementations or testcontainers to avoid testing assumptions.

- ✅ **Pure Functions**: Test configuration validation, codecs, patterns
- ✅ **Testcontainers**: Test service behavior, queue groups, events
- ❌ **Mocks**: Avoid mocking NATS, ServiceDescription, or business logic

### Running Tests

```bash
# Unit tests (fast)
pnpm test

# Integration tests with Docker (slow)
pnpm test:docker

# All tests
pnpm build  # Includes compile, test, and lint
```

## Examples

### Receipt Service (Complete Example)

The NATS package demonstrates how to reuse existing service descriptions from other packages. Instead of recreating business logic, import and use the existing fastify receipt service:

```typescript
// Import existing service description
import { description } from "@weegigs/events-fastify/src/sample/receipts";

// Use directly with NATS
const serviceFactory = create(description, {
  serviceName: "receipt-service",
  serviceVersion: "1.0.0", 
  natsUrl: "nats://localhost:4222",
})
  .withQueueGroup({ name: "receipt-workers" })
  .withMonitoring()
  .build();

const service = await serviceFactory(store, {});
await service.start();
```

This approach provides:
- **Single Source of Truth**: Same business logic for HTTP and NATS
- **No Duplication**: Reuse existing types, validation, commands, events
- **Consistency**: Identical behavior across transport protocols
- **Maintainability**: Changes in one place benefit all transports

### Multi-Instance Queue Groups

```typescript
// Start multiple service instances
const instances = [];
for (let i = 0; i < 3; i++) {
  const service = await create(serviceDescription, {
    serviceName: "distributed-service",
    serviceVersion: "1.0.0",
    natsUrl,
  })
    .withQueueGroup({ name: "worker-pool" })
    .build()(store, {});
  
  await service.start();
  instances.push(service);
}

// Commands automatically load-balanced across instances
```

### Event Subscriptions

```typescript
// Subscribe to specific events
await client.subscribeToEvents("userCreated", async (event) => {
  await sendWelcomeEmail(event.data.email);
});

// Subscribe to all events for an aggregate
await client.subscribeToAggregateEvents("user", async (event) => {
  await updateSearchIndex(event);
});
```

## Service Discovery

### Get Service Information

```typescript
const info = await client.getServiceInfo();
console.log(info);
// {
//   name: "user-service",
//   version: "1.0.0", 
//   description: "User management service",
//   endpoints: [
//     { name: "GetUser", subject: "user-service.query.user.get" },
//     { name: "CreateUser", subject: "user-service.command.user.create" },
//     ...
//   ]
// }
```

### Get Service Statistics

```typescript
const stats = await client.getServiceStats();
console.log(stats);
// {
//   name: "user-service",
//   uptime_ms: 3600000,
//   total_requests: 1500,
//   total_errors: 12,
//   error_rate: 0.008,
//   average_processing_time: 45,
//   endpoints: [ ... ]
// }
```

### Health Checks

```typescript
const health = await client.checkHealth();
console.log(health);
// {
//   name: "user-service",
//   status: "ok",
//   version: "1.0.0"
// }
```

## Error Handling

### Business Rule Violations

```typescript
// Custom error types with codes
export class InvalidStateError extends Error {
  constructor(currentState: string, operation: string) {
    super(`Cannot ${operation} in ${currentState} state`);
    this.name = "InvalidStateError";
  }
}

// Errors are automatically mapped to NATS responses
try {
  await client.execute("finalize", "receipt-123", {});
} catch (error) {
  console.log(error.message); // "Cannot finalize in closed state"
}
```

### Connection Handling

```typescript
// Automatic reconnection
const client = createClient(serviceDescription, {
  serviceName: "my-service",
  serviceVersion: "1.0.0",
  maxReconnect: 10,
  reconnectTimeWait: 2000,
});

// Check connection status
if (!client.isConnected()) {
  await client.connect();
}
```

### Graceful Shutdown

```typescript
// Services drain subscriptions gracefully
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await service.stop();  // Drains all subscriptions
  await client.disconnect();
  process.exit(0);
});
```

## Performance Considerations

### Message Size

- Commands and queries should be < 1MB
- Use aggregate IDs for large payloads
- Consider pagination for large result sets

### Concurrency

- Queue groups automatically distribute load
- Each service instance handles requests concurrently
- Use appropriate pool sizes for your workload

### Monitoring

- Track request latency via stats endpoint
- Monitor error rates per endpoint
- Use OpenTelemetry for distributed tracing

## Production Deployment

### Environment Variables

```bash
NATS_URL=nats://nats-cluster:4222
NODE_ENV=production
LOG_LEVEL=info
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

### Kubernetes Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    spec:
      containers:
      - name: user-service
        image: user-service:latest
        env:
        - name: NATS_URL
          value: "nats://nats-service:4222"
        - name: QUEUE_GROUP
          value: "user-service-production"
```

## Contributing

1. **No Mocks**: Use testcontainers for integration tests
2. **Co-located Tests**: Place `.spec.ts` files alongside source code
3. **Type Safety**: All configurations must have Zod schemas
4. **Error Handling**: Use structured errors with codes
5. **Documentation**: Update README for new features

## License

MIT License - see LICENSE file for details.