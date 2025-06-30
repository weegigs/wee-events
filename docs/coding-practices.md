# Coding Practices

This document captures the coding practices and design principles for this project. All contributors must read and acknowledge these practices before beginning work.

## Core Philosophy

### Start Minimal, Grow Deliberately
- **Begin with the simplest solution that works.** Avoid over-engineering or anticipating future requirements.
- **Add complexity only when explicitly needed.** Don't build "just in case" features.
- **Prefer obvious over clever.** Write simple code that clearly expresses its intent.

### Dependency Discipline
- **Challenge every import.** Can this be solved without a new dependency?
- **Use workspace catalogues.** All dependency versions are controlled via the pnpm workspace catalogue.
- **Import specifically, not broadly.** Avoid importing entire modules for a single function.

## Core Design Principles

### Separation of Concerns
Each class and function should have one clear purpose. Keep infrastructure and business logic separate.

**Example: Separating Infrastructure from Business Logic**

- **Infrastructure Layer**: Handles protocol-specific concerns like connection management, timeouts, and serialization. It should not contain business rules.
- **Application Layer**: Implements business logic, such as retries or circuit breakers, by composing calls to the infrastructure layer.

```typescript
// ✅ Infrastructure Layer: Protocol concerns only
class TransportClient {
  withTimeout(ms: number): TransportClient { /* ... */ }
  withHeader(key: string, value: string): TransportClient { /* ... */ }

  async execute(operation: string, data: unknown): Promise<Result> {
    // Pure transport logic: send a request using configured options.
    const options = this.modifiers.reduce((opts, modifier) => modifier(opts), defaults);
    return this.connection.send(operation, data, options);
  }
}

// ✅ Application Layer: Business concerns are composed externally
import { Policy } from 'external-resilience-library';

const businessPolicy = Policy
  .handle(Error)
  .retry().attempts(3);

// Compose layers externally
const result = await businessPolicy.execute(() =>
  transportClient
    .withTimeout(5000)     // Infrastructure concern
    .withHeader("trace", id) // Infrastructure concern
    .execute(operation, data)
);
```

### Error Handling: Use Domain-Specific Errors
Always throw custom, domain-specific errors that capture structured data. This enables callers to handle specific failure modes programmatically.

- **Capture structured data as fields**, not in error messages.
- **Keep messages clean and focused.**
- **End class names with `Error`** (e.g., `ValidationError`).

```typescript
// ❌ Never do this
throw new Error(`Unknown command: ${command}.`);

// ✅ Always do this
export class UnknownCommandError extends Error {
  constructor(
    public readonly command: string,
    public readonly availableCommands: string[]
  ) {
    super(`Unknown command: ${command}`);
    this.name = "UnknownCommandError";
  }
}
```

### Type Safety: Use Strict TypeScript
- **Never use `any`.** Always find or create proper types.
- **Use `interface` for services, `type` for data.** An interface defines a contract for behavior (what a service *does*), while a type defines a shape for data (what data *is*). Never use an interface for data structures.
- **Prefer unions over optional fields.** Instead of making fields optional (`field?: T`), model different states explicitly with a discriminated union. This makes it impossible to represent an invalid state.
- **Leverage existing types** with TypeScript's utility types like `ReturnType<T>`.
- **Map types explicitly** when converting between domains.

### Validation: Validate Early and Often
- **Validate on the client-side** to catch errors before network calls.
- **Use existing schemas** and validation logic where possible.
- **Fail fast** and provide clear, actionable error messages.

### Class Design: Pre-compute in Constructors
Perform expensive operations or computations once in the constructor, not on every method call. This makes objects more efficient and ready to use immediately after instantiation.

```typescript
// ❌ Avoid repeated computation
class Client {
  constructor(private description: ServiceDescription) {}

  execute(command: string) {
    // This is called every time!
    const commands = this.description.commands();
    if (!(command in commands)) { /* ... */ }
  }
}

// ✅ Extract what you need once
class Client {
  private readonly commands: Record<string, { schema: ZodSchema }>;

  constructor(description: ServiceDescription) {
    // Extract and compute command definitions just once.
    const commandDefs = description.commands();
    this.commands = Object.fromEntries(
      Object.entries(commandDefs).map(([name, def]) => [
        name,
        { schema: def.schema }
      ])
    );
  }
}
```

## Key Pattern: Composable Fluent APIs
To avoid a combinatorial explosion of classes for configurable behaviors (e.g., `TimeoutClient`, `RetriesClient`, `TimeoutRetriesClient`), use function composition with a fluent, immutable API.

### The Pattern: Function Composition
Instead of creating a new class for every combination of features, define features as functions (`OptionsModifier`) and apply them in a sequence.

```typescript
// ✅ Linear growth with composition
type OptionsModifier<T> = (options: T) => T;

class Client<T> {
  constructor(
    private readonly implementation: Implementation,
    private readonly modifiers: OptionsModifier<T>[] = []
  ) {}

  // Each `with...` method returns a *new* immutable instance.
  withTimeout(ms: number): Client<T> {
    return this.withModifier(options => ({ ...options, timeout: ms }));
  }

  private withModifier(modifier: OptionsModifier<T>): Client<T> {
    return new Client(this.implementation, [...this.modifiers, modifier]);
  }

  execute(operation: string): Promise<Result> {
    // Apply all modifiers to the default options
    const options = this.modifiers.reduce((opts, modify) => modify(opts), defaults);
    return this.implementation.execute(operation, options);
  }
}
```

### Fluent API Design Principles
- **Immutable Transformations**: Methods like `withTimeout` return a new `Client` instance instead of mutating the existing one.
- **Return Types**:
    - **Concrete Types for Chaining**: Fluent configuration methods (`with...`) should return the concrete class (`Client`) to enable method chaining.
    - **Interface Types for Operations**: Core operational methods (`execute`) should return a generic interface type (`Promise<Result>`) to enable composition and testing.
- **Factory Patterns**: Use static factory methods to provide a clean entry point for creating and connecting a client.
  ```typescript
  // ✅ Static factory methods can be cleaner
  class NatsClient {
    static create(description: ServiceDescription) {
      return {
        async connect(url: string): Promise<NatsClient> {
          const connection = await connect(url);
          return new NatsClient(connection, description);
        }
      };
    }
  }
  ```

## Build and Quality Standards

### Compilation and Linting
- **Zero Errors**: Code must compile with zero TypeScript errors and pass all linting checks.
- **Fix Immediately**: Do not accumulate technical debt. Fix all build and lint errors as they appear.
- **Verify Locally**: Run `just build` before claiming a task is complete.

### Testing
- **Co-location**: Tests are located in the same directory as the source files they cover.
- **Prefer Testcontainers**: Use real dependencies (like databases or message brokers) in Docker containers instead of mocks to avoid testing incorrect assumptions.
- **Understand Failures**: Never update snapshots without understanding the root cause of the change. A failing test often indicates a regression, not an invalid test.

## Project Conventions

### Package Management
- **Use pnpm exclusively.**
- **Use workspace catalogues** for all dependency versions.
- **Use mise** for Node.js and other tool version management.

### Code Style
- **Add newlines at the end of files.**
- **Follow project's Prettier/ESLint configuration.**
- **Match the style and structure of existing code.**

## Implementation Workflow

1.  **Before Starting**: Read and acknowledge these practices. Understand the existing codebase and plan the minimal viable solution.
2.  **During Development**: Start with tests, types and interfaces. Implement incrementally and validate your work continuously (compile, test, lint).
3.  **Before Completion**: Run the full quality pipeline (`just build`) and verify that all checks pass and the results are logically correct.

---

**Remember**: These practices exist to create maintainable, understandable code. When in doubt, prefer the simpler solution that clearly expresses intent.
