# Receipt Service Sample

This directory contains a comprehensive sample implementation of a receipt management service demonstrating event sourcing patterns with multiple transport connectors.

## Architecture

The sample is organized into three main parts:

- **`core/`** - Core service definition with domain logic, commands, events, and business rules
- **`http/`** - HTTP connector using Fastify for REST API access
- **`nats/`** - NATS connector for message-based communication

## Core Service (`core/`)

The core service defines the receipt domain model and business logic:

- **`receipts.ts`** - Main service description combining commands, events, and configuration
- **`types.ts`** - Domain types and schemas (Receipt, ReceiptItem, ReceiptStatus)
- **`errors.ts`** - Domain-specific error types
- **`commands/`** - Command definitions and handlers (AddItem, RemoveItem, Finalize, VoidReceipt)
- **`events/`** - Event definitions and reducers (ItemAdded, ItemRemoved, ReceiptFinalized, ReceiptVoided)
- **`receipts.spec.ts`** - Unit tests for the core service logic

## HTTP Connector (`http/`)

Provides REST API access to the receipt service:

- **`server.ts`** - Fastify server implementation with OpenAPI documentation
- **`docker.spec.ts`** - Docker integration tests

### Running the HTTP Service

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run --filter @samples/receipts build

# Start the HTTP server
pnpm run --filter @samples/receipts http:server
```

The server will start on `http://localhost:3000` with:
- OpenAPI documentation at `/openapi/documentation`
- OpenAPI schema at `/openapi/schema.json`
- Health check at `/healthz`

### HTTP API Endpoints

```bash
# Get a receipt (creates empty one if it doesn't exist)
curl http://localhost:3000/receipt/my-receipt

# Add an item
curl -X POST http://localhost:3000/receipt/my-receipt/add-item \
  -H "Content-Type: application/json" \
  -d '{"name": "Coffee", "price": 4.99, "quantity": 2}'

# Remove an item
curl -X POST http://localhost:3000/receipt/my-receipt/remove-item \
  -H "Content-Type: application/json" \
  -d '{"name": "Coffee"}'

# Finalize the receipt
curl -X POST http://localhost:3000/receipt/my-receipt/finalize \
  -H "Content-Type: application/json" \
  -d '{}'

# Void the receipt
curl -X POST http://localhost:3000/receipt/my-receipt/void-receipt \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer cancellation"}'
```

## NATS Connector (`nats/`)

Provides message-based access to the receipt service:

- **`server.ts`** - NATS service implementation
- **`client.ts`** - Example NATS client usage
- **`docker.spec.ts`** - Docker integration tests

### Running the NATS Service

```bash
# Start NATS server (requires Docker)
docker run -p 4222:4222 -p 8222:8222 nats:latest -js -m 8222

# In another terminal, start the NATS service
pnpm run --filter @samples/receipts nats:server

# In another terminal, run the example client
pnpm run --filter @samples/receipts nats:client
```

## Docker Support

The sample includes Docker support for both connectors via the main repository Dockerfile:

### Build and Run HTTP Service
```bash
# Build the receipt HTTP service image
docker build --target receipt-http-sample -t receipt-http .

# Run the HTTP service
docker run -p 3000:3000 receipt-http
```

### Build and Run NATS Service
```bash
# Build the receipt NATS service image
docker build --target receipt-nats-sample -t receipt-nats .

# Run with NATS server
docker run --network host receipt-nats
```

### Using Docker Compose
```bash
# Create a docker-compose.yaml file in this directory
cd samples/receipts
docker-compose up
```

## Testing

The sample includes comprehensive tests at multiple levels:

```bash
# Run all tests
pnpm run --filter @samples/receipts test

# Run only Docker integration tests (requires Docker)
pnpm run --filter @samples/receipts test:docker

# Run with coverage
pnpm run --filter @samples/receipts test --coverage
```

### Test Types

- **Unit Tests** (`core/receipts.spec.ts`) - Test the core business logic
- **HTTP Integration Tests** (`http/docker.spec.ts`) - Test the complete HTTP service in Docker
- **NATS Integration Tests** (`nats/docker.spec.ts`) - Test NATS client/server communication

## Business Rules

The receipt service implements the following business rules:

- Receipts start in "open" status
- Items can only be added/removed when status is "open"
- Receipts must have at least one item before being finalized
- Finalized receipts cannot be modified
- Voided receipts cannot be modified
- Item removal requires the item to exist on the receipt

## Sample Data Flow

1. **Create Receipt**: GET `/receipt/{id}` or NATS fetch returns empty receipt with `status: "open"`
2. **Add Items**: POST `/receipt/{id}/add-item` or NATS `add-item` command with item details
3. **Remove Items**: POST `/receipt/{id}/remove-item` or NATS `remove-item` command with item name
4. **Finalize**: POST `/receipt/{id}/finalize` or NATS `finalize` command sets status to "closed"
5. **Void**: POST `/receipt/{id}/void-receipt` or NATS `void-receipt` command sets status to "voided"

## Event Sourcing Patterns

This sample demonstrates several event sourcing patterns:

- **Command/Event Separation**: Commands represent intent, events represent facts
- **Event Reducers**: Pure functions that apply events to aggregate state
- **Domain Events**: Structured events with business meaning
- **Aggregate Reconstruction**: Building current state from event history
- **Command Validation**: Business rule enforcement before event publication

## Extending the Sample

To add new features:

1. **Add Command**: Create command type in `core/commands/types.ts` and handler in `core/commands/handlers.ts`
2. **Add Event**: Create event type in `core/events/types.ts` and reducer in `core/events/reducers.ts`
3. **Update Service**: Register new command/event in `core/receipts.ts`
4. **Add Tests**: Test business logic in `core/receipts.spec.ts`

Both HTTP and NATS connectors will automatically support new commands and events without modification.