# OpenAPI Schema Generation for Fastify Services - Implementation Plan

## Executive Summary & Decision

**DECISION**: Implement self-describing Fastify services using `@asteasolutions/zod-to-openapi` + `@fastify/swagger` + **Scalar** for documentation UI.

### Why This Stack?

**TypeScript-First Philosophy**: This combination provides the most mature, type-safe, and developer-friendly approach that leverages our existing Zod schemas while maintaining full TypeScript integration throughout the pipeline.

**Key Decision Factors**:

1. **`@asteasolutions/zod-to-openapi`** - Despite being decorator-heavy, it's the most battle-tested library with comprehensive TypeScript support and handles complex Zod schemas that we use in event sourcing
2. **`@fastify/swagger`** - Official Fastify plugin ensures compatibility and long-term support 
3. **Scalar** - Next-generation documentation UI that's TypeScript-native, lightweight, and provides superior developer experience compared to legacy Swagger UI

### Architecture Decision

We'll extend our existing `ServiceDescription` pattern to automatically generate OpenAPI schemas from Zod schemas, without breaking existing services. The approach leverages TypeScript's type system for compile-time validation while providing runtime schema generation.

```typescript
// Target API - zero configuration for modern services
const server = createWithOpenAPI(receiptServiceDescription, {
  errorMapper: receiptErrorMapper  // Custom error handling
});

// Even simpler - OpenAPI enabled by default:
const server = createWithOpenAPI(receiptServiceDescription);

// Automatic endpoints:
// GET /openapi.json        - OpenAPI 3.1 schema
// GET /documentation       - Interactive Scalar UI
// GET /receipt/{id}        - Existing entity endpoint (now documented)
// POST /receipt/{id}/{cmd} - Existing command endpoints (now documented)
```

---

## Detailed Research & Implementation Plan

### Current State Analysis

#### Existing Architecture Strengths
- **Service Definition**: `ServiceDescription` already contains complete API structure
- **Schema-First**: Zod schemas provide validation and type information
- **Consistent Patterns**: Predictable REST endpoint generation
- **Type Safety**: Full TypeScript integration throughout

#### Current Gaps
- Services lack discoverability and interactive documentation
- Internal schemas not exposed as machine-readable contracts
- No automatic client generation capability
- Manual integration testing required

## Research Findings: Modern TypeScript-First Ecosystem

### Zod to OpenAPI Conversion (Comprehensive Analysis)

#### 1. `@asteasolutions/zod-to-openapi` ⭐ **SELECTED**
**Pros**:
- Most mature and production-ready (50k+ weekly downloads)
- Comprehensive OpenAPI 3.1 support with full Zod schema coverage
- Excellent TypeScript integration with type inference
- Handles complex schemas: unions, discriminated unions, recursive types
- Active maintenance with regular updates
- Supports Zod transforms, refinements, and custom validators

**Cons**:
- Requires schema augmentation with `.openapi()` decorators
- Slightly larger bundle size due to comprehensive features
- Learning curve for decorator syntax

**Why Selected**: Despite the decorator overhead, this is the only library that handles our complex event sourcing schemas reliably while maintaining type safety.

#### 2. `zod-openapi` (Hono Ecosystem)
**Pros**: 
- Modern API design, smaller footprint
- Good TypeScript integration
- Growing ecosystem

**Cons**: 
- Limited complex schema support (fails on discriminated unions)
- Newer project with smaller community
- Missing features for advanced Zod usage patterns

**Decision**: Too immature for our complex schemas

#### 3. `@anatine/zod-openapi`
**Pros**: Lightweight, simple
**Cons**: Basic features only, limited maintenance
**Decision**: Insufficient for production use

### Fastify Integration

#### `@fastify/swagger` + `@fastify/swagger-ui` ⭐ **SELECTED**
- Official Fastify plugins ensure compatibility
- Mature, stable, well-documented
- Full OpenAPI 3.1 support
- Allows custom UI integration (we'll use Scalar instead of default Swagger UI)

### Documentation UI Research

#### 1. Scalar ⭐ **SELECTED** 
**Why This is Perfect for Us**:
- **TypeScript-Native**: Built from ground up for modern TypeScript APIs
- **Performance**: Lightweight, fast rendering, mobile-responsive
- **Modern UX**: Clean, intuitive interface that developers actually want to use
- **Advanced Features**: Built-in code generation, multiple language examples
- **Fastify Integration**: `@scalar/fastify-api-reference` plugin available
- **Future-Proof**: Active development, modern architecture

#### 2. Swagger UI (Traditional Choice)
**Cons for Our Use Case**:
- Large bundle size (500kb+)
- Legacy React architecture
- Customization complexity
- Not optimized for TypeScript-first APIs

#### 3. Redoc (Performance Alternative)
**Cons for Our Use Case**:
- Read-only documentation (no interactive testing)
- Less modern UI compared to Scalar
- Limited customization options

## Implementation Approach

### Phase 1: Core Infrastructure

#### 1.1 Enhanced Service Creation
```typescript
// Minimal server options - add more as needed
interface ServerOptions {
  openAPI?: boolean;           // Default: true
  errorMapper?: ErrorMapper;   // Default: standard mapper
}

export function createWithOpenAPI<R, S>(
  description: ServiceDescription<R, S>,
  options?: ServerOptions
) {
  // OpenAPI enabled by default - modern services should be self-documenting
  // Uses Scalar UI by default (our chosen modern standard)
  // Backward compatible: createWithOpenAPI(description) just works
}
```

#### 1.2 Automatic Schema Enhancement
```typescript
// Extend existing Zod schemas with OpenAPI metadata
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Global setup - done once
extendZodWithOpenApi(z);

// Enhanced command schemas (in receipt sample)
export namespace AddItem {
  export const schema = z.object({
    name: z.string().openapi({ 
      description: 'Item name',
      example: 'Coffee' 
    }),
    price: z.number().min(0).openapi({ 
      description: 'Unit price in dollars',
      example: 5.99 
    }),
    quantity: z.number().int().min(1).openapi({ 
      description: 'Quantity to add',
      example: 2 
    })
  }).openapi({
    title: 'Add Item Command',
    description: 'Adds an item to an open receipt'
  });
}
```

### Phase 2: Automatic API Generation

#### 2.1 OpenAPI Schema Generator
```typescript
class OpenAPIGenerator {
  constructor(private description: ServiceDescription) {}

  generateSchema(): OpenAPIObject {
    const info = this.description.info();
    
    return {
      openapi: '3.1.0',
      info: {
        title: info.title || `${info.entity.type} Service`,
        version: info.version,
        description: info.description
      },
      paths: this.generatePaths(),
      components: {
        schemas: this.generateSchemas()
      }
    };
  }

  private generatePaths() {
    const entityType = this.description.info().entity.type;
    const commands = this.description.commands();
    
    return {
      [`/${entityType}/{id}`]: {
        get: {
          summary: `Get ${entityType} by ID`,
          parameters: [this.idParameter()],
          responses: {
            200: { $ref: '#/components/responses/EntityResponse' },
            404: { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      ...this.generateCommandPaths(entityType, commands)
    };
  }
}
```

#### 2.2 Response Schema Generation
```typescript
// Generate response schemas from entity definitions
const generateResponseSchemas = (description: ServiceDescription) => {
  const entitySchema = description.info().entity.schema;
  
  return {
    EntityResponse: {
      type: 'object',
      properties: {
        aggregate: { $ref: '#/components/schemas/AggregateId' },
        type: { 
          type: 'string', 
          example: description.info().entity.type 
        },
        state: generateOpenApiSchema(entitySchema), // Zod -> OpenAPI
        revision: { $ref: '#/components/schemas/Revision' }
      },
      required: ['aggregate', 'type', 'state', 'revision']
    }
  };
};
```

### Phase 3: Enhanced Developer Experience

#### 3.1 Scalar Integration
```typescript
// Register Scalar documentation UI
app.register(require('@scalar/fastify-api-reference'), {
  routePrefix: '/documentation',
  configuration: {
    theme: 'purple',
    spec: {
      url: '/openapi.json',
    },
    metaData: {
      title: `${description.info().title} API Documentation`,
      description: description.info().description
    }
  }
});
```

#### 3.2 Enhanced Error Documentation
```typescript
// Map business errors to OpenAPI error responses
const errorSchemas = {
  BusinessRuleViolation: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'InvalidReceiptStateError' },
      message: { type: 'string', example: 'Cannot perform operation add-item on closed receipt' },
      statusCode: { type: 'number', example: 400 }
    },
    examples: {
      closedReceipt: {
        summary: 'Operation on closed receipt',
        value: { 
          error: 'InvalidReceiptStateError', 
          message: 'Cannot perform operation add-item on closed receipt',
          statusCode: 400
        }
      }
    }
  }
};
```

## Implementation Strategy

### Phase 1: Foundation (Medium Complexity)
- Add dependencies and core OpenAPI generator
- Implement basic schema generation from ServiceDescription  
- Create enhanced server factory with OpenAPI option
- **Key Challenge**: Zod to OpenAPI schema conversion accuracy

### Phase 2: Integration (Low-Medium Complexity)
- Add Scalar UI integration
- Implement automatic endpoint documentation
- Update receipt sample with OpenAPI metadata
- **Key Challenge**: Fastify plugin integration and routing

### Phase 3: Enhancement (Medium-High Complexity)
- Add comprehensive error documentation
- Implement response schema generation
- Add interactive examples and testing
- **Key Challenge**: Complex schema types and error mapping

### Phase 4: Production Readiness (Medium Complexity)
- Performance optimization and caching
- Comprehensive testing suite  
- Documentation and migration guide
- **Key Challenge**: Backward compatibility and performance impact

## Expected Developer Experience

### Before (Current State)
```typescript
// Receipt service - no documentation
const server = create(receiptServiceDescription, receiptErrorMapper);
// Developers must manually discover endpoints and schemas
```

### After (Target State)
```typescript
// Receipt service - self-documenting by default
const server = createWithOpenAPI(receiptServiceDescription, {
  errorMapper: receiptErrorMapper
});

// Or even simpler with defaults:
const server = createWithOpenAPI(receiptServiceDescription);

// Automatic endpoints:
// GET /documentation     - Scalar UI (our chosen standard)
// GET /openapi.json      - Machine-readable schema
// All existing endpoints now documented with:
//   - Request/response schemas
//   - Examples and validation rules
//   - Error codes and messages
//   - Interactive testing capability
```

## Appendix: Research References

### Core Libraries
- [@asteasolutions/zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi) - Zod to OpenAPI conversion
- [@fastify/swagger](https://github.com/fastify/fastify-swagger) - Official Fastify OpenAPI plugin
- [@scalar/fastify-api-reference](https://github.com/scalar/scalar/tree/main/packages/fastify-api-reference) - Modern API documentation

### Standards and Specifications
- [OpenAPI 3.1.0 Specification](https://spec.openapis.org/oas/v3.1.0) - Latest standard with JSON Schema compatibility
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/release-notes.html) - Schema specification used by OpenAPI 3.1

### TypeScript Integration
- [Zod Documentation](https://zod.dev/) - Schema validation library
- [TypeScript 5.0+ Features](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/) - Latest language features
- [Fastify TypeScript Guide](https://fastify.dev/docs/latest/Reference/TypeScript/) - Official TypeScript support