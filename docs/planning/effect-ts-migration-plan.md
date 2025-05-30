# Effect-TS Migration Plan: v0.60.4 → v3.x

## 🎯 Executive Summary

This document outlines a comprehensive migration strategy for upgrading Effect-TS from v0.60.4 to v3.x while preserving all existing functionality and architectural patterns. The migration involves significant API changes but maintains the sophisticated service-oriented architecture, dependency injection patterns, and domain-driven design principles currently implemented.

## 📊 Current State Analysis

### Architecture Strengths to Preserve
- ✅ **Service-oriented architecture** with clean boundaries
- ✅ **Sophisticated error handling** with domain-specific error types  
- ✅ **Dependency injection** using Has/tag patterns
- ✅ **Lambda handler abstractions** with queue-based processing
- ✅ **Event sourcing integration** with replay patterns
- ✅ **AWS SDK integration** with client lifecycle management
- ✅ **Comprehensive testing** with service provision patterns

### Critical Usage Patterns
- **23 TypeScript files** with Effect-TS usage in effects package
- **Service injection** with Has/tag system extensively used
- **Layer composition** with >>> operator throughout
- **Complex error union types** for domain modeling
- **Do-notation style** composition as primary pattern
- **Testing infrastructure** with service mocking

## 🗺️ Migration Strategy: Package-by-Package Approach

### Phase 3A: Foundation Migration
**Complexity**: 🟡 **Medium** - Requires careful dependency management and API bridge creation
**Target**: Core Effect-TS infrastructure without breaking existing functionality

#### Step 1: Create Compatibility Layer
Create `packages/effects/src/compat/` directory with v0.60.4 → v3.x bridge:

```typescript
// compat/effect.ts - Bridge old Effect APIs to new ones
export * from "effect/Effect"
export { pipe } from "effect/Function"

// compat/has.ts - Bridge Has system to new Context system  
export * from "effect/Context"

// compat/layer.ts - Bridge Layer APIs
export * from "effect/Layer"
```

#### Step 2: Update Dependencies
```json
{
  "dependencies": {
    "effect": "^3.10.0",
    "@effect/platform": "^0.63.0",
    "@effect/platform-node": "^0.58.0"
  }
}
```

#### Step 3: Core API Migration Mapping
```typescript
// v0.60.4 → v3.x API Mapping (VALIDATED AGAINST v3.x DOCS)

// Effect imports
- import * as T from "@effect-ts/core/Effect"
+ import { Effect } from "effect"

// Has system → Context system
- Has<ServiceType>
+ Context.Context<ServiceType>

- tag<Type>()
+ Context.Tag<Type>()

// Layer composition  
- L1[">>>"](L2)
+ Layer.merge(L1, L2)

// Service access
- T.service(Tag)
+ yield* Tag  // in Effect.gen() context

// Environment access  
- T.accessM((env) => ...)
+ Effect.gen(function* () { const service = yield* ServiceTag; ... })

// Effect composition patterns
- pipe(T.do, T.bind(...), T.map(...))
+ Effect.gen(function* () { const x = yield* effect; return result; })
```

### Phase 3B: Service Infrastructure Migration
**Complexity**: 🔴 **High** - Complex Has/tag → Context.Tag system transformation across 15+ service definitions
**Target**: Migrate service definitions and dependency injection

**Complexity Factors**:
- **Service Tag System**: Complete rewrite of 15+ service definitions using different API patterns
- **Circular Dependencies**: Need to rename interfaces to avoid circular references in new syntax
- **Layer Composition**: Replace all >>> operators with Layer.merge, requiring understanding of dependency order
- **Type System Changes**: Effect v3.x has stricter type requirements for service definitions

#### Service Tag Migration Pattern
```typescript
// Before (v0.60.4):
export const EventStore = tag<wee.EventStore>();
export const EventLoader = tag<EventLoader>();

// After (v3.x): (VALIDATED SYNTAX)
export class EventStore extends Context.Tag("EventStore")<
  EventStore,
  wee.EventStore
>() {}

export class EventLoader extends Context.Tag("EventLoader")<
  EventLoader, 
  EventLoaderInterface  // Note: renamed to avoid circular reference
>() {}
```

#### Layer Definition Migration
```typescript
// Before (v0.60.4):
export const layer = L.fromEffect(Dynamo)(T.succeedWith(() => new DynamoDBClient({})));

// After (v3.x): (VALIDATED SYNTAX)
export const DynamoLive = Layer.effect(
  Dynamo,
  Effect.sync(() => new DynamoDBClient({}))
);

// Layer merging (replaces >>> operator):
// Before: layer1[">>>"](layer2)
// After: Layer.merge(layer1, layer2)
```

#### Service Composition Migration
```typescript
// Before (v0.60.4):
const program = pipe(
  T.do,
  T.bind("loader", () => T.service(EventLoader)),
  T.bind("events", ({ loader }) => /* ... */),
  T.map(({ events }) => events)
);

// After (v3.x): (VALIDATED GENERATOR SYNTAX)
const program = Effect.gen(function* () {
  const loader = yield* EventLoader  // Direct service access
  const events = yield* loader.load(/* ... */)
  return events
});
```

### Phase 3C: Business Logic Migration  
**Complexity**: 🔴 **Very High** - Critical business logic transformation with zero tolerance for functional changes
**Target**: Migrate domain services while preserving all business logic

**Complexity Factors**:
- **Do-Notation → Generator Transformation**: 50+ complex effect compositions must be converted from pipe/bind to generator syntax
- **Error Union Preservation**: Complex error type unions (6-8 error types per function) must maintain exact same semantics
- **Event Sourcing Logic**: Critical replay and state reconstruction logic cannot be altered in any way
- **Service Interaction Patterns**: Complex service orchestration in receipts, entity loaders, and dispatchers
- **Zero Tolerance for Business Logic Changes**: Any deviation breaks domain invariants

#### Entity Loader Migration
```typescript
// Preserve exact functionality:
export interface EntityLoader<A extends State> {
  load(id: wee.AggregateId): Effect.Effect<
    wee.Entity<A>,
    store.LoaderError | EntityNotAvailableError,
    EventLoader
  >;
  events(): Record<string, z.Schema>;
}
```

#### Command Dispatcher Migration  
```typescript
// Preserve handler signature intent:
export type Handler<R, E, S extends Payload, C extends Command> = (
  entity: wee.Entity<S>,
  command: C
) => Effect.Effect<void, E, R>;
```

#### Error Type Preservation
```typescript
// Keep all existing error types unchanged:
export class CommandValidationError extends Error {
  constructor(public readonly error: ValidationError) {
    super("command validation failed");
    this.name = "CommandValidationError";
    Object.setPrototypeOf(this, CommandValidationError.prototype);
  }
}

// Maintain error union patterns:
Effect.Effect<
  wee.Entity<S>,
  E | HandlerNotFound | EntityNotAvailableError | LoaderError | CommandValidationError,
  R & EventLoader
>
```

### Phase 3D: AWS Integration Migration
**Complexity**: 🟡 **Medium-High** - AWS service layer migration with client lifecycle preservation
**Target**: Update AWS SDK integration without changing client behavior

**Complexity Factors**:
- **Client Lifecycle Management**: Complex DynamoDB, CloudWatch, and EventBridge client initialization patterns
- **Configuration Management**: Environment-based configuration with Effect.gen integration
- **Resource Management**: Proper client disposal and connection pooling must be preserved
- **Error Handling**: AWS SDK error types must maintain same error propagation patterns

#### AWS Service Layer Migration
```typescript
// Before (v0.60.4):
export const Dynamo = tag<DynamoDBClient>(DynamoSymbol);
export const layer = L.fromEffect(Dynamo)(T.succeedWith(() => new DynamoDBClient({})));

// After (v3.x):
export class Dynamo extends Context.Tag("Dynamo")<Dynamo, DynamoDBClient>() {}
export const layer = Layer.effect(Dynamo, Effect.sync(() => new DynamoDBClient({})));
```

#### Lambda Handler Migration
```typescript
// Preserve complex lambda abstractions:
export type EventHandler<R, E, I, O> = (event: I) => Effect.Effect<O, E, R>;

export const create = <R, E, I, O>(handler: EventHandler<R, E, I, O>) => {
  // Migrate queue-based implementation while preserving:
  // - Fiber-based concurrency
  // - Graceful shutdown
  // - Middy middleware integration
  // - Error handling patterns
};
```

### Phase 3E: Testing Infrastructure Migration
**Complexity**: 🟡 **Medium** - Test service provision pattern updates with coverage preservation
**Target**: Update test patterns while maintaining test coverage

**Complexity Factors**:
- **Service Mocking Patterns**: Update 20+ test files with new Layer.succeed patterns for service provision
- **Error Testing**: Ensure all error expectation patterns still work with new Effect.gen syntax
- **Test Layer Composition**: Complex test environment setup with multiple mock services
- **Snapshot Preservation**: All existing test snapshots and expectations must remain valid

#### Test Service Provision Migration (VALIDATED)
```typescript
// Before (v0.60.4):
const program = pipe(
  receipts.service.load(id), 
  T.provideService(store.EventLoader)(ms)
);

// After (v3.x):
const program = receipts.service.load(id).pipe(
  Effect.provide(Layer.succeed(EventLoader, ms))
);

// Alternative pattern for multiple services:
const testLayer = Layer.merge(
  Layer.succeed(EventLoader, mockLoader),
  Layer.succeed(EventPublisher, mockPublisher)
);
const program = receipts.service.load(id).pipe(Effect.provide(testLayer));
```

#### Test Error Expectations (Unchanged)
```typescript
// Preserve all existing test expectations:
expect(Effect.runPromise(program)).rejects.toBeInstanceOf(HandlerNotFound);
expect(Effect.runPromise(program)).rejects.toBeInstanceOf(InsufficientBalanceError);
```

## 🛠️ Implementation Guidelines

### Migration Principles
1. **Preserve All Business Logic**: No changes to domain rules or calculations
2. **Maintain Error Handling**: Keep all existing error types and patterns
3. **Preserve Service Boundaries**: Maintain clean architectural separation
4. **Keep Testing Patterns**: Ensure all existing tests continue to pass
5. **Incremental Migration**: One service at a time with rollback capability

### Code Transformation Patterns

#### Import Migration (VALIDATED)
```typescript
// Global find/replace patterns:
- import * as T from "@effect-ts/core/Effect"
+ import { Effect } from "effect"

- import * as L from "@effect-ts/core/Layer"  
+ import { Layer } from "effect"

- import { Has, tag } from "@effect-ts/core/Has"
+ import { Context } from "effect"

- import { pipe } from "@effect-ts/core/Function"
+ import { pipe } from "effect"  // Still available for functional composition
```

#### Effect Construction Migration (VALIDATED)
```typescript
// Pattern transformations:
- T.succeed(value)
+ Effect.succeed(value)

- T.fail(error)  
+ Effect.fail(error)

- T.tryCatchPromise(promise, mapError)
+ Effect.tryPromise({ try: promise, catch: mapError })

// Major pattern shift - do-notation → generators:
- pipe(T.do, T.bind("x", () => effect1), T.bind("y", ({x}) => effect2), T.map(({x,y}) => result))
+ Effect.gen(function* () {
+   const x = yield* effect1
+   const y = yield* effect2  
+   return result
+ })
```

#### Service Definition Migration (VALIDATED)
```typescript
// Service tag pattern:
- export const ServiceName = tag<ServiceType>();
+ export class ServiceName extends Context.Tag("ServiceName")<ServiceName, ServiceType>() {}

// Service access pattern:
- T.service(ServiceName)
+ yield* ServiceName  // In Effect.gen() context

// Service provision pattern:
- T.provideService(ServiceName)(implementation)
+ Effect.provide(Layer.succeed(ServiceName, implementation))
```

## ⚠️ Risk Mitigation

### High-Risk Areas (By Complexity Analysis)

#### 🔴 **Critical Risk - Very High Complexity**
1. **Business Logic Transformation**: 50+ effect compositions with zero tolerance for functional changes
   - **Risk**: Subtle behavioral changes in event sourcing logic
   - **Impact**: Domain invariant violations, data corruption
   - **Mitigation**: Extensive unit testing, property-based testing, manual verification

#### 🔴 **High Risk - High Complexity**  
2. **Service Dependency Graph**: 15+ interconnected services with complex dependency chains
   - **Risk**: Circular dependencies, service resolution failures
   - **Impact**: Runtime errors, initialization failures
   - **Mitigation**: Dependency mapping, gradual migration, extensive integration testing

#### 🟡 **Medium Risk - Medium Complexity**
3. **AWS Client Lifecycle**: Complex initialization and resource management patterns
   - **Risk**: Resource leaks, connection issues
   - **Impact**: Performance degradation, AWS billing impact
   - **Mitigation**: Resource monitoring, load testing

4. **Lambda Handler Abstractions**: Queue-based processing with fiber management
   - **Risk**: Concurrency bugs, graceful shutdown issues  
   - **Impact**: Request processing failures, data loss
   - **Mitigation**: Stress testing, graceful shutdown verification

### Mitigation Strategies (Complexity-Driven)

#### **For Very High Complexity (Phase 3C)**
1. **Property-Based Testing**: Generate edge cases for event sourcing logic
2. **Behavioral Verification**: Compare old vs new implementations with identical inputs
3. **Staged Rollout**: Migrate one entity type at a time
4. **Shadow Mode**: Run both implementations in parallel during validation

#### **For High Complexity (Phase 3B)**  
1. **Dependency Mapping**: Create visual graph of service relationships
2. **Incremental Service Migration**: One service at a time with immediate testing
3. **Type-Driven Development**: Let TypeScript guide the migration process
4. **Service Contract Testing**: Verify each service maintains its interface contract

#### **For Medium Complexity (Phases 3A, 3D, 3E)**
1. **Automated Testing**: Comprehensive test suite execution after each change
2. **Compatibility Layer**: Bridge old and new APIs during transition
3. **Gradual Migration**: Coexist old and new patterns temporarily
4. **Performance Monitoring**: Track resource usage and performance metrics

### Validation Checklist
- [ ] All existing tests pass without modification
- [ ] Error handling behavior unchanged
- [ ] Service boundaries preserved  
- [ ] AWS integration functionality intact
- [ ] Lambda handler behavior identical
- [ ] Performance characteristics maintained

## 📊 Complexity Analysis and Execution Order

### Migration Phases by Complexity

#### 🟢 **Low Complexity**
- **Step 1** (Phase 3A): Dependency updates and import changes
- **Step 2** (Phase 3A): Basic Effect constructor migrations (succeed, fail, etc.)

#### 🟡 **Medium Complexity**  
- **Phase 3A**: Compatibility layer creation - Moderate complexity due to API bridging requirements
- **Phase 3D**: AWS integration - Established patterns with clear transformation paths
- **Phase 3E**: Testing infrastructure - Systematic but straightforward pattern updates

#### 🔴 **High Complexity**
- **Phase 3B**: Service infrastructure - Complete paradigm shift from Has/tag to Context.Tag system

#### 🔴 **Very High Complexity**  
- **Phase 3C**: Business logic migration - Critical path with zero tolerance for functional changes

### Execution Milestones

#### Phase 3A: Foundation 
- [ ] Create compatibility layer
- [ ] Update dependencies  
- [ ] Define migration patterns
- [ ] Basic import/export updates
- [ ] Validate compilation with new dependencies

#### Phase 3B: Service Infrastructure
- [ ] Migrate service tags and definitions (15+ services)
- [ ] Update layer composition patterns (10+ layers)
- [ ] Migrate basic service access patterns
- [ ] Validate service injection works
- [ ] Test dependency resolution

#### Phase 3C: Business Logic  
- [ ] Migrate entity loaders (highest risk)
- [ ] Migrate command dispatchers  
- [ ] Migrate event sourcing logic (critical path)
- [ ] Preserve all domain rules
- [ ] Comprehensive business logic testing

#### Phase 3D: AWS Integration
- [ ] Migrate AWS service layers (5+ clients)
- [ ] Update lambda handler abstractions
- [ ] Validate client lifecycle management
- [ ] Test configuration patterns
- [ ] Verify resource management

#### Phase 3E: Testing & Validation
- [ ] Migrate test infrastructure (20+ test files)
- [ ] Update test service provision patterns
- [ ] Comprehensive validation suite
- [ ] Performance regression testing
- [ ] Final integration testing

## 💪 Development Effort Analysis (By Complexity)

### **Phase 3A - Foundation (🟡 Medium Complexity)**
- **Effort**: Moderate - dependency management and API bridging
- **Risk**: Low - mostly mechanical transformations
- **Validation**: TypeScript compilation + basic functionality

### **Phase 3B - Service Infrastructure (🔴 High Complexity)**  
- **Effort**: High - complete paradigm shift across 15+ services
- **Risk**: High - service resolution and dependency injection changes
- **Validation**: Full service graph testing + integration tests

### **Phase 3C - Business Logic (🔴 Very High Complexity)**
- **Effort**: Very High - 50+ critical effect transformations  
- **Risk**: Critical - zero tolerance for behavioral changes
- **Validation**: Extensive testing + property-based verification + shadow deployment

### **Phase 3D - AWS Integration (🟡 Medium-High Complexity)**
- **Effort**: Medium-High - client lifecycle and configuration patterns
- **Risk**: Medium - resource management and error handling
- **Validation**: Load testing + resource monitoring + error injection

### **Phase 3E - Testing Infrastructure (🟡 Medium Complexity)**
- **Effort**: Medium - systematic pattern updates across 20+ test files
- **Risk**: Low-Medium - test patterns are well-understood
- **Validation**: Test suite execution + coverage analysis

## 🔍 Success Criteria

### Functional Requirements
- [ ] All existing tests pass without modification
- [ ] Business logic behavior unchanged
- [ ] Error handling patterns preserved
- [ ] Service composition functionality intact

### Non-Functional Requirements  
- [ ] Performance characteristics maintained or improved
- [ ] Memory usage patterns similar
- [ ] Build times not significantly impacted
- [ ] Type safety enhanced or maintained

### Quality Assurance
- [ ] Code coverage maintained at current levels
- [ ] No new ESLint errors introduced
- [ ] TypeScript compilation successful
- [ ] All packages build and test successfully

## 🚀 Post-Migration Cleanup

After successful migration:
1. Remove compatibility layer
2. Update documentation
3. Remove old Effect-TS dependencies  
4. Optimize for new Effect-TS v3.x patterns
5. Consider performance improvements available in v3.x

---

This migration plan ensures that the sophisticated Effect-TS architecture in wee-events is preserved while upgrading to the modern v3.x API. The incremental approach minimizes risk while maintaining full functionality throughout the process.