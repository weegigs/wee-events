# @weegigs/events-fastify

Fastify server factory for wee-events service descriptions. Create HTTP APIs from event-sourced services with automatic OpenAPI documentation.

## Installation

```bash
npm install @weegigs/events-fastify
```

## Quick Start

```typescript
import { create } from "@weegigs/events-fastify";
import { MemoryStore } from "@weegigs/events-core";

// Create server factory from service description
const serverFactory = create(serviceDescription);

// Create server instance
const server = await serverFactory(new MemoryStore(), {});

// Start server
await server.listen({ port: 3000 });
console.log("Server running on http://localhost:3000");
```

## API Reference

### `create(description, options?)`

Creates a Fastify server factory from a service description.

**Parameters:**
- `description: ServiceDescription` - Event-sourced service description
- `options?: ServerOptions` - Optional configuration

**Returns:** `(store: EventStore, environment: Environment) => Promise<FastifyInstance>`

### Server Options

```typescript
interface ServerOptions {
  openAPI?: boolean;           // Enable OpenAPI docs (default: true)
  errorMapper?: (error: unknown) => HttpError;  // Custom error mapping
}
```

## Features

### Automatic REST Endpoints

For a service with entity type `receipt`, the following endpoints are automatically created:

- `GET /receipt/{id}` - Load entity by ID
- `POST /receipt/{id}/{command}` - Execute command on entity

### OpenAPI Documentation

OpenAPI is enabled by default and provides:

- **Schema endpoint**: `/openapi/schema.json` - OpenAPI 3.1 specification
- **Documentation UI**: `/openapi/documentation` - Interactive API explorer

```typescript
// OpenAPI enabled (default)
const serverFactory = create(serviceDescription);

// OpenAPI disabled
const serverFactory = create(serviceDescription, { openAPI: false });
```

### Error Handling

Customize error responses with a custom error mapper:

```typescript
const customErrorMapper = (error: unknown) => {
  if (error instanceof MyBusinessError) {
    return new BadRequest(error.message);
  }
  return new InternalServerError("Something went wrong");
};

const serverFactory = create(serviceDescription, {
  errorMapper: customErrorMapper
});
```

## Example

```typescript
import { z } from "zod";
import { create } from "@weegigs/events-fastify";
import { 
  ServiceDescription, 
  LoaderDescription, 
  DispatcherDescription,
  MemoryStore 
} from "@weegigs/events-core";

// Define entity schema
const ItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  price: z.number()
});

// Create service description
const description = ServiceDescription.create(
  { 
    title: "Inventory Service", 
    description: "Manage inventory items",
    version: "1.0.0" 
  },
  LoaderDescription.fromInitFunction(
    { type: "item", schema: ItemSchema },
    () => ({ name: "", quantity: 0, price: 0 })
  ).description(),
  DispatcherDescription.handler(
    "update", 
    ItemSchema, 
    async (env, entity, command) => {
      await env.publish(entity.aggregate, { 
        type: "updated", 
        data: command 
      });
    }
  ).description()
);

// Create and start server
const serverFactory = create(description);
const server = await serverFactory(new MemoryStore(), {});

await server.listen({ port: 3000 });

// API is now available:
// GET /item/123 - Load item
// POST /item/123/update - Update item
// GET /openapi/schema.json - OpenAPI spec
// GET /openapi/documentation - API docs
```

## TypeScript Support

Full TypeScript support with proper type inference:

```typescript
import type { ServerOptions } from "@weegigs/events-fastify";

const options: ServerOptions = {
  openAPI: true,
  errorMapper: (error) => new InternalServerError(String(error))
};
```

## License

MIT