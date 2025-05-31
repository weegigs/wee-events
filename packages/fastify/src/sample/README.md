# Receipt Service Sample

A comprehensive event-sourced receipt management service demonstrating modern architectural patterns and best practices using the wee-events framework.

## Overview

This sample implements a complete receipt management system with event sourcing, CQRS, and domain-driven design principles. It showcases how to build scalable, maintainable event-driven services with proper separation of concerns.

## Features

### Core Functionality
- **Receipt Management**: Create, modify, and finalize receipts
- **Item Operations**: Add and remove items with automatic total calculation
- **Status Workflow**: Open → Closed/Voided state transitions
- **Business Rules**: Status-based operation validation
- **Error Handling**: Proper HTTP status codes for different error types

### Technical Features
- **Event Sourcing**: All state changes captured as immutable events
- **CQRS**: Separate command and query models
- **Type Safety**: Full TypeScript with Zod schema validation
- **REST API**: Auto-generated HTTP endpoints from service description
- **Modular Architecture**: Clean separation of concerns across files

## Architecture

### File Structure

```
src/sample/
├── README.md                 # This documentation
├── types.ts                  # Core domain types and schemas
├── commands/
│   ├── types.ts             # Command definitions with schemas
│   └── handlers.ts          # Command business logic
├── events/
│   ├── types.ts             # Event definitions with schemas
│   └── reducers.ts          # Event state transformation logic
├── errors.ts                # Custom business rule error classes
├── receipts.ts              # Main service configuration and wiring
└── receipts.spec.ts         # Comprehensive test suite
```

### Domain Model

#### Receipt Entity
```typescript
type Receipt = {
  id: string;           // Unique identifier from aggregate key
  status: "open" | "closed" | "voided";
  items: ReceiptItem[];
  total: number;        // Calculated from items
}
```

#### Receipt Item
```typescript
type ReceiptItem = {
  name: string;
  price: number;        // Unit price (see note below)
  quantity: number;     // Integer quantity
}
```

> **Note on Number Types**: This sample uses JavaScript's built-in `number` type for prices and monetary values to keep the implementation simple and avoid additional dependencies. In production applications dealing with financial data, consider using a dedicated decimal library (like `decimal.js`, `big.js`, or `dinero.js`) to avoid floating-point precision issues. The modular architecture makes it easy to swap in proper decimal types later.

### State Transitions

```
    [Receipt Created]
           ↓
       🟢 OPEN ←─────────────────┐
           │                     │
           │ finalize            │ add-item
           ↓                     │ remove-item
       🔵 CLOSED                 │
           │                     │
           │ void-receipt        │
           ↓                     │
       🔴 VOIDED ←───────────────┘
                    void-receipt
```

**Business Rules:**
- Only **open** receipts can be modified (add/remove items, finalize)
- **Closed** and **open** receipts can be voided
- **Voided** receipts cannot be modified further
- Empty receipts cannot be finalized

## Implementation Details

### Commands

Commands represent user intentions and contain validation logic:

| Command | Purpose | Validation |
|---------|---------|------------|
| `add-item` | Add item to receipt | Receipt must be open |
| `remove-item` | Remove item from receipt | Receipt must be open, item must exist |
| `finalize` | Close the receipt | Receipt must be open and have items |
| `void-receipt` | Cancel the receipt | Receipt cannot already be voided |

**Example Command:**
```typescript
// commands/types.ts
export namespace AddItem {
  export const name = "add-item" as const;
  export const schema = z.object({ 
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1)
  });
  export type Type = z.infer<typeof schema>;
}

// commands/handlers.ts
export const addItemHandler = async (
  environment: Publisher, 
  entity: Entity<Receipt>, 
  command: AddItem.Type
): Promise<void> => {
  ensureReceiptIsOpen(entity, "add-item");
  
  await environment.publish(entity.aggregate, { 
    type: ItemAdded.name, 
    data: { 
      name: command.name,
      price: command.price,
      quantity: command.quantity,
      lineTotal: command.price * command.quantity
    } 
  });
};
```

### Events

Events represent facts about what happened and drive state changes:

| Event | Purpose | Data |
|-------|---------|------|
| `item-added` | Item was added | name, price, quantity, lineTotal |
| `item-removed` | Item was removed | name, refundAmount |
| `receipt-finalized` | Receipt was closed | finalTotal, itemCount |
| `receipt-voided` | Receipt was cancelled | reason, voidedTotal |

**Example Event & Reducer:**
```typescript
// events/types.ts
export namespace ItemAdded {
  export const name = "item-added" as const;
  export const schema = z.object({ 
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
    lineTotal: z.number()
  });
}

// events/reducers.ts
export const itemAddedReducer = (
  state: Receipt, 
  event: DomainEvent<"item-added", ItemAdded.Type>
): Receipt => {
  const newItems = [...state.items, { 
    name: event.data.name, 
    price: event.data.price, 
    quantity: event.data.quantity 
  }];
  
  return {
    ...state,
    items: newItems,
    total: calculateTotal(newItems)  // Calculated, not stored
  };
};
```

### Error Handling

The sample demonstrates proper HTTP status code handling:

```typescript
// Custom error hierarchy
export class BusinessRuleViolationError extends Error
export class InvalidReceiptStateError extends BusinessRuleViolationError
export class ItemNotFoundError extends BusinessRuleViolationError

// Error mapping
export const receiptErrorMapper = (error: unknown): errors.HttpError => {
  if (error instanceof BusinessRuleViolationError) {
    return new errors.BadRequest(error.message);  // 400
  }
  return new errors.InternalServerError(...);     // 500
};
```

**HTTP Status Codes:**
- **200**: Successful operations
- **400**: Business rule violations (closed receipt, missing item, etc.)
- **500**: System errors (database failures, programming errors)

### Service Configuration

The main service wiring brings everything together:

```typescript
// receipts.ts
const loader = LoaderDescription.fromInitFunction<Receipt>(
  { type: "receipt", schema: Receipt.schema },
  Receipt.create  // Factory function with aggregate ID
)
  .reducer(ItemAdded.name, ItemAdded.schema, itemAddedReducer)
  .reducer(ItemRemoved.name, ItemRemoved.schema, itemRemovedReducer)
  .reducer(ReceiptFinalized.name, ReceiptFinalized.schema, receiptFinalizedReducer)
  .reducer(ReceiptVoided.name, ReceiptVoided.schema, receiptVoidedReducer)
  .description();

const dispatcher = DespatcherDescription.handler(AddItem.name, AddItem.schema, addItemHandler)
  .handler(RemoveItem.name, RemoveItem.schema, removeItemHandler)
  .handler(Finalize.name, Finalize.schema, finalizeHandler)
  .handler(VoidReceipt.name, VoidReceipt.schema, voidReceiptHandler)
  .description();

export const description = ServiceDescription.create(
  { title: "Receipt Service", description: "...", version: "1.0.0" },
  loader,
  dispatcher
);
```

## REST API

The service automatically generates REST endpoints:

### Endpoints

| Method | Endpoint | Purpose | Request Body |
|--------|----------|---------|--------------|
| `GET` | `/receipt/{id}` | Get receipt state | - |
| `POST` | `/receipt/{id}/add-item` | Add item | `{ name, price, quantity }` |
| `POST` | `/receipt/{id}/remove-item` | Remove item | `{ name }` |
| `POST` | `/receipt/{id}/finalize` | Close receipt | `{}` |
| `POST` | `/receipt/{id}/void-receipt` | Cancel receipt | `{ reason }` |

### Example Usage

```bash
# Get receipt (creates new if doesn't exist)
GET /receipt/order-12345
# → { state: { id: "order-12345", status: "open", items: [], total: 0 }, ... }

# Add items
POST /receipt/order-12345/add-item
Content-Type: application/json
{ "name": "Coffee", "price": 5.99, "quantity": 2 }
# → { state: { id: "order-12345", status: "open", items: [...], total: 11.98 }, ... }

# Finalize receipt
POST /receipt/order-12345/finalize
Content-Type: application/json
{}
# → { state: { id: "order-12345", status: "closed", items: [...], total: 11.98 }, ... }

# Business rule violation
POST /receipt/order-12345/add-item
Content-Type: application/json  
{ "name": "Tea", "price": 3.99, "quantity": 1 }
# → 400 Bad Request: "Cannot perform operation 'add-item' on closed receipt"
```

## Key Architectural Patterns

### 1. Event Sourcing
- **Immutable Events**: All state changes captured as events
- **Event Store**: Persistent, append-only event log
- **State Reconstruction**: Current state rebuilt from event history
- **Audit Trail**: Complete history of all changes

### 2. CQRS (Command Query Responsibility Segregation)
- **Commands**: Write operations with business logic
- **Queries**: Read operations (state reconstruction)
- **Separate Models**: Different representations for reads/writes

### 3. Domain-Driven Design
- **Aggregates**: Receipt as consistency boundary
- **Domain Events**: Business-meaningful events
- **Ubiquitous Language**: Terms like "finalize", "void", "receipt"

### 4. Hexagonal Architecture
- **Domain Core**: Business logic in commands/events
- **Adapters**: HTTP/REST interface via Fastify
- **Ports**: ServiceDescription interface

### 5. Type-Driven Development
- **Schema First**: Zod schemas define contracts
- **Compile-Time Safety**: TypeScript prevents runtime errors
- **Runtime Validation**: Zod validates incoming data

## Testing Strategy

The sample includes comprehensive testing:

```typescript
describe("receipts sample", () => {
  // Structure validation
  it("should have proper command handlers")
  it("should have proper event reducers") 
  
  // Happy path scenarios
  it("should calculate total correctly when adding items")
  it("should close receipt when finalized")
  it("should void receipt and set status to voided")
  
  // Business rule validation
  it("should reject operations on closed receipts")  // 400
  it("should return 400 when trying to remove non-existent item")
  it("should return 400 when trying to finalize empty receipt")
  it("should return 400 when trying to void already voided receipt")
});
```

**Test Coverage:**
- ✅ 18 comprehensive test cases
- ✅ Happy path operations
- ✅ Business rule violations
- ✅ HTTP status code validation
- ✅ Error message verification

## Development Patterns

### Adding New Commands

1. **Define Command Type** (`commands/types.ts`):
```typescript
export namespace NewCommand {
  export const name = "new-command" as const;
  export const schema = z.object({ /* fields */ });
  export type Type = z.infer<typeof schema>;
}
```

2. **Implement Handler** (`commands/handlers.ts`):
```typescript
export const newCommandHandler = async (
  environment: Publisher,
  entity: Entity<Receipt>,
  command: NewCommand.Type
): Promise<void> => {
  // Business logic + event publishing
};
```

3. **Wire Up** (`receipts.ts`):
```typescript
const dispatcher = DespatcherDescription
  .handler(NewCommand.name, NewCommand.schema, newCommandHandler)
  // ... other handlers
  .description();
```

### Adding New Events

1. **Define Event Type** (`events/types.ts`):
2. **Implement Reducer** (`events/reducers.ts`):
3. **Wire Up** (`receipts.ts`):
4. **Update Commands** to publish the new event

## Benefits of This Architecture

### For Development
- **Modularity**: Easy to add new features
- **Testability**: Each component tested in isolation
- **Type Safety**: Compile-time error prevention
- **Maintainability**: Clear separation of concerns

### For Operations
- **Audit Trail**: Complete history of all changes
- **Debugging**: Event log shows exactly what happened
- **Scalability**: Read/write separation enables scaling
- **Consistency**: Strong consistency within aggregates

### For Business
- **Flexibility**: Easy to change business rules
- **Compliance**: Full audit trail for regulations
- **Analytics**: Rich event data for insights
- **Reliability**: Event sourcing provides strong guarantees

## Extending the Sample

This sample provides a foundation for building more complex event-sourced services:

- **Add more receipt operations** (discounts, taxes, tips)
- **Implement projections** for reporting and analytics
- **Add process managers** for multi-step workflows
- **Integrate with external services** (payment, inventory)
- **Add snapshot support** for performance optimization
- **Implement multi-tenant support** with proper isolation

The modular architecture makes extending functionality straightforward while maintaining the core architectural principles.