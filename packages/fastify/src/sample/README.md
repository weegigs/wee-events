# Sample Receipt Service

This directory contains a complete sample implementation of a receipt management service using the @weegigs/events-fastify package.

## Files

- `receipts.ts` - Service description with commands, events, and business logic
- `server.ts` - Standalone server that can be run or containerized
- `Dockerfile` - Container definition for the sample service
- `docker.spec.ts` - Integration tests using testcontainers
- `receipts.spec.ts` - Unit tests for the receipt service logic

## Running the Sample

### Local Development

```bash
# Compile the TypeScript
pnpm compile

# Run the server
node lib/sample/server.js
```

The server will start on `http://localhost:3000` with:
- OpenAPI documentation at `/openapi/documentation`
- OpenAPI schema at `/openapi/schema.json`
- Health check at `/healthz`

### Docker

Build and run the containerized version:

```bash
# Build the image
docker build -f src/sample/Dockerfile -t receipt-service .

# Run the container
docker run -p 3000:3000 receipt-service
```

### Testing with Docker

The Docker integration tests require Docker to be running and can take several minutes to complete as they build the container image. Run them with:

```bash
# Run Docker integration tests (requires Docker daemon)
pnpm exec jest src/sample/docker.spec.ts --testTimeout=600000
```

## API Endpoints

Once running, you can test the receipt service:

```bash
# Get a receipt (creates empty one if it doesn't exist)
curl http://localhost:3000/receipt/my-receipt

# Add an item
curl -X POST http://localhost:3000/receipt/my-receipt/add-item \
  -H "Content-Type: application/json" \
  -d '{"name": "Coffee", "price": 4.99, "quantity": 2}'

# Finalize the receipt
curl -X POST http://localhost:3000/receipt/my-receipt/finalize \
  -H "Content-Type: application/json" \
  -d '{}'

# View OpenAPI documentation
open http://localhost:3000/openapi/documentation
```

## Sample Data Flow

1. **Create Receipt**: GET `/receipt/{id}` returns empty receipt with `status: "open"`
2. **Add Items**: POST `/receipt/{id}/add-item` with item details
3. **Remove Items**: POST `/receipt/{id}/remove-item` with item name
4. **Finalize**: POST `/receipt/{id}/finalize` sets status to "closed"
5. **Void**: POST `/receipt/{id}/void-receipt` sets status to "voided"

## Business Rules

- Receipts start in "open" status
- Items can only be added/removed when status is "open"
- Receipts must have items before being finalized
- Finalized receipts cannot be modified
- Voided receipts cannot be modified
EOF < /dev/null