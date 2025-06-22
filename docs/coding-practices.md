# Coding Practices

This document captures the coding practices and design principles for this project. All contributors must read and acknowledge these practices before beginning work.

## Core Design Philosophy

### Start Minimal, Grow Deliberately
- **Begin with the simplest solution that works** - Avoid anticipating future requirements
- **Add complexity only when explicitly needed** - Don't build "just in case" features  
- **Question every assumption** - "Does this really need logging? Telemetry? Complex lifecycle?"
- **Prefer obvious over clever** - Simple code that clearly expresses intent
- **Most programming problems are simpler than we make them** - Start minimal, let real requirements drive complexity

### Dependency Discipline
- **Challenge every import** - Can this be solved without this dependency?
- **Research before adding** - Use Context7 or documentation to understand correct packages
- **Use workspace catalogues** - All dependency versions controlled via pnpm workspace catalogue
- **Import specifically, not broadly** - Avoid importing entire modules for one function
- **Minimize surface area** - Fewer dependencies = fewer failure modes

## Error Handling Patterns

### Always Use Domain-Specific Errors
```typescript
// ❌ Never do this
throw new Error(`Unknown command: ${command}. Available: ${commands.join(', ')}`);

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

### Error Design Principles
- **Capture structured data as fields** - Not in error messages
- **Keep messages clean and focused** - Details go in separate fields
- **Make errors programmatically useful** - Enable specific error handling
- **Use consistent naming** - End with "Error" (e.g., `ValidationError`, `TimeoutError`)
- **Include relevant context** - What failed, why it failed, what was expected

## Constructor and Class Design

### Pre-compute in Constructors
```typescript
// ❌ Avoid repeated computation
class Client {
  constructor(private description: ServiceDescription) {}
  
  execute(command: string) {
    const commands = this.description.commands(); // Called every time!
    if (!(command in commands)) { ... }
  }
}

// ✅ Extract what you need once
class Client {
  private readonly commands: Record<string, { schema: ZodSchema }>;
  
  constructor(description: ServiceDescription) {
    // Extract only what we need, when we need it
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

### Constructor Principles
- **Extract only needed fields** - Don't store entire objects when you need specific fields
- **Use proper TypeScript types** - Never use `any`, leverage existing type definitions
- **Pre-compute expensive operations** - Do work once in constructor, not on every method call
- **Make objects ready to use** - Avoid complex initialization after construction

## Validation Strategy

### Validate Early and Often
- **Client-side validation** - Catch errors before network calls
- **Use existing schemas** - Leverage service descriptions and existing validation logic
- **Provide immediate feedback** - Clear, actionable error messages
- **Fail fast** - Don't continue with invalid data

```typescript
// ✅ Validate before sending
async execute(command: string, payload: Payload) {
  // Validate command exists
  if (!(command in this.commands)) {
    throw new UnknownCommandError(command, Object.keys(this.commands));
  }
  
  // Validate payload
  const validation = this.commands[command].schema.safeParse(payload);
  if (!validation.success) {
    throw new InvalidCommandPayloadError(command, validation.error.message);
  }
  
  // Now send with confidence
  return this.sendRequest(command, validation.data);
}
```

## Interface Design

### Design for the Common Case
- **Start with calling code** - How would you want to use this API?
- **Make wrong usage hard** - Guide users toward correct patterns
- **Match actual capabilities** - Align with server implementation, not idealized APIs
- **Prefer composition over configuration** - Pass behavior, not complex option objects

### Factory Patterns
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

// Usage: const client = await NatsClient.create(desc).connect(url);
```

## Type Safety Practices

### Strict TypeScript Usage
- **Never use `any`** - Always find or create proper types
- **Leverage existing types** - Use `ReturnType<T>`, service description types, etc.
- **Map types explicitly** - When converting between domains, be explicit about type mapping
- **Use strict compilation** - Fix all TypeScript errors immediately

```typescript
// ✅ Use proper types from existing definitions
private readonly commands: ReturnType<ServiceDescription<Environment, S>["commands"]>;

// ✅ Map types explicitly when needed
const aggregateId = { 
  type: parsed.data.target.type, 
  key: parsed.data.target.key 
} as AggregateId;
```

## Separation of Concerns

### Single Responsibility
- **Each class/function has one clear purpose** - If you can't explain it in one sentence, split it
- **Infrastructure separate from business logic** - Don't mix plumbing with domain concepts
- **Avoid god objects** - Classes that know too much or do too much
- **Use appropriate abstractions** - Different domains have different patterns

### Import Organization
- **Import what you need where you need it** - Don't create unnecessary layers
- **Group related imports** - External, internal, relative imports in separate groups
- **No circular dependencies** - Design clear dependency hierarchies

## Build and Quality Standards

### Compilation Requirements
- **Zero TypeScript errors** - All code must compile cleanly
- **Fix issues immediately** - Don't accumulate technical debt
- **Exclude problematic files** - Use tsconfig exclude for sample/test files if needed
- **Verify builds succeed** - Run `pnpm run build` before claiming completion

### Testing Practices
- **Tests co-located with source** - In same directory structure, not separate `tests/` folders
- **Prefer testcontainers over mocks** - Use real dependencies in Docker containers
- **Understand test failures** - Never update snapshots without understanding why they changed
- **Verify logical correctness** - Tests should pass AND make logical sense

## Project Conventions

### Package Management
- **Use pnpm exclusively** - Never npm or bun
- **Use workspace catalogues** - All dependency versions controlled centrally
- **Add dependencies via catalogue** - Research versions first, add to catalogue, then use `catalog:`
- **Use mise for tool management** - Node.js and tool versions managed via `.mise.toml`

### Code Style
- **Always add newlines at end of files** - Consistent file formatting
- **Use project prettier/eslint config** - Don't override formatting rules
- **Follow existing patterns** - Match the style and structure of existing code

## Implementation Workflow

### Before Starting Work
1. **Read and acknowledge these practices** - Confirm understanding
2. **Understand the existing codebase** - Read related code, understand patterns
3. **Research dependencies** - Use Context7 for unfamiliar libraries
4. **Plan the minimal solution** - Start simple, add complexity only when needed

### During Development
1. **Start with tests/interfaces** - Define the API you want before implementing
2. **Implement incrementally** - Small, working steps
3. **Validate continuously** - Compile, test, lint frequently
4. **Fix errors immediately** - Don't accumulate compilation or test failures

### Before Completion
1. **Run full build pipeline** - `pnpm run build`, `pnpm run test`, `pnpm run lint`
2. **Verify logical correctness** - Tests pass AND make sense
3. **Check error handling** - All error paths use domain-specific errors
4. **Review type safety** - No `any` types, proper TypeScript usage

---

**Remember**: These practices exist to create maintainable, understandable code. When in doubt, prefer the simpler solution that clearly expresses intent.