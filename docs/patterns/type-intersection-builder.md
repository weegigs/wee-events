# Type Intersection Builder Pattern

## Overview

The Type Intersection Builder Pattern is a core architectural pattern in wee-events for creating composable, type-safe configuration builders. This pattern leverages TypeScript's intersection types (`&`) to progressively build up configuration objects while maintaining full type safety and avoiding optional fields.

## Key Principles

1. **No Optional Fields**: Each feature configuration is a complete type with all required fields
2. **Type Growth**: The builder's type parameter grows with each added feature using intersections
3. **Feature Detection**: Use TypeScript's `in` operator for runtime feature detection
4. **Composability**: Features can be mixed and matched in any combination

## Pattern Structure

### 1. Base Configuration Type

```typescript
// Always required configuration
export type BaseConfig = {
  serviceName: string;
  serviceVersion: string;
};
```

### 2. Feature Configuration Types

Each feature is a complete type with a single required property containing the feature's configuration:

```typescript
export type MonitoringConfig = {
  monitoring: {
    interval: number;
    includeMemoryStats: boolean;
    includeRequestStats: boolean;
  };
};

export type TelemetryConfig = {
  telemetry: {
    sampling: SamplingRates;
    exporterUrl?: string;
    environment: string;
  };
};
```

### 3. Generic Builder Class

The builder uses a generic type parameter that grows with each method call:

```typescript
export class ServiceBuilder<
  R extends Environment, 
  S extends State,
  C extends BaseConfig = BaseConfig  // Config type starts as BaseConfig
> {
  private config: C;
  
  constructor(
    private description: ServiceDescription<R, S>,
    config: BaseConfig
  ) {
    this.config = config as C;
  }
  
  // Each method returns a new builder with expanded type
  withMonitoring(monitoring: MonitoringConfig['monitoring']): ServiceBuilder<R, S, C & MonitoringConfig> {
    return new ServiceBuilder(
      this.description,
      { ...this.config, monitoring }
    );
  }
  
  withTelemetry(telemetry: TelemetryConfig['telemetry']): ServiceBuilder<R, S, C & TelemetryConfig> {
    return new ServiceBuilder(
      this.description,
      { ...this.config, telemetry }
    );
  }
  
  build(): ServiceInstance<C> {
    return new ServiceInstance(this.config);
  }
}
```

### 4. Runtime Feature Detection

```typescript
class ServiceInstance<C extends BaseConfig> {
  constructor(private config: C) {
    // Type-safe feature detection
    if ('monitoring' in config) {
      this.setupMonitoring(config.monitoring); // TypeScript knows monitoring exists
    }
    
    if ('telemetry' in config) {
      this.setupTelemetry(config.telemetry); // TypeScript knows telemetry exists
    }
  }
}
```

## Zod Integration

### Schema-First Type Definition

In wee-events, we define types through Zod schemas, which provides both runtime validation and TypeScript type inference. This ensures that our types always have corresponding validation logic.

### Basic Schema Pattern

```typescript
// Define schemas with field-level validation
export namespace BaseConfig {
  export const schema = z.object({
    serviceName: z.string()
      .min(1, "Service name cannot be empty")
      .max(50, "Service name too long")
      .regex(/^[a-z][a-z0-9-]*$/, "Service name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens"),
    
    serviceVersion: z.string()
      .regex(/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/, "Version must follow semver format (e.g., 1.0.0 or 1.0.0-beta.1)")
  });
  
  // Type is inferred from schema
  export type Type = z.infer<typeof schema>;
}

// Feature schemas with rich validation
export namespace MonitoringConfig {
  export const schema = z.object({
    monitoring: z.object({
      interval: z.number()
        .int("Interval must be an integer")
        .min(1000, "Interval must be at least 1 second")
        .max(300_000, "Interval cannot exceed 5 minutes")
        .default(30_000),
      
      includeMemoryStats: z.boolean()
        .default(true)
        .describe("Include memory usage statistics in monitoring data"),
      
      includeRequestStats: z.boolean()
        .default(true)
        .describe("Include request count and latency statistics"),
      
      customMetrics: z.array(
        z.object({
          name: z.string().regex(/^[a-z][a-z0-9_]*$/, "Metric names must be lowercase with underscores"),
          type: z.enum(["counter", "gauge", "histogram"]),
          help: z.string().min(1, "Metric help text is required"),
        })
      ).optional()
    })
  });
  
  export type Type = z.infer<typeof schema>;
}
```

### Advanced Validation Patterns

```typescript
export namespace RateLimitConfig {
  export const schema = z.object({
    rateLimit: z.object({
      maxRequestsPerSecond: z.number()
        .positive("Rate limit must be positive")
        .int("Rate limit must be a whole number")
        .max(10_000, "Rate limit cannot exceed 10,000 RPS"),
      
      // Burst is computed based on max RPS if not provided
      burst: z.number()
        .positive()
        .int()
        .optional(),
      
      perClient: z.boolean().default(false),
      
      // Custom key extractor with validation
      keyExtractor: z.function()
        .args(z.any()) // Message type
        .returns(z.string().min(1, "Key cannot be empty"))
        .optional()
    }).refine(
      // Cross-field validation
      (data) => !data.burst || data.burst >= data.maxRequestsPerSecond,
      { 
        message: "Burst must be greater than or equal to maxRequestsPerSecond",
        path: ["burst"] 
      }
    ).transform((data) => ({
      // Apply defaults after validation
      ...data,
      burst: data.burst ?? data.maxRequestsPerSecond * 2
    }))
  });
  
  export type Type = z.infer<typeof schema>;
}
```

### Union Types with Validation

```typescript
export namespace AuthConfig {
  // Shared validation for all auth types
  const authBaseSchema = z.object({
    enabled: z.boolean().default(true),
    cacheTTL: z.number().min(0).default(300), // 5 minutes
  });
  
  export const schema = z.object({
    auth: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("none"),
        ...authBaseSchema.shape
      }),
      
      z.object({
        type: z.literal("jwt"),
        ...authBaseSchema.shape,
        publicKey: z.string()
          .min(1, "Public key is required")
          .refine(
            (key) => key.includes("BEGIN PUBLIC KEY") || key.includes("BEGIN CERTIFICATE"),
            "Invalid public key format"
          ),
        issuer: z.string().url("Issuer must be a valid URL"),
        audience: z.string().min(1).optional(),
        algorithms: z.array(z.enum(["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"]))
          .default(["RS256"])
      }),
      
      z.object({
        type: z.literal("nkey"),
        ...authBaseSchema.shape,
        seed: z.string()
          .regex(/^S[A-Z2-7]{55}$/, "Invalid NKEY seed format")
          .refine(
            (seed) => validateNKeySeed(seed),
            "Invalid NKEY seed checksum"
          )
      }),
      
      z.object({
        type: z.literal("basic"),
        ...authBaseSchema.shape,
        username: z.string()
          .min(3, "Username must be at least 3 characters")
          .max(20, "Username cannot exceed 20 characters"),
        password: z.string()
          .min(8, "Password must be at least 8 characters")
          .refine(
            (pwd) => /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd),
            "Password must contain uppercase, lowercase, and numbers"
          )
      })
    ])
  });
  
  export type Type = z.infer<typeof schema>;
}
```

### Environment Variable Configuration

```typescript
export namespace EnvironmentConfig {
  // Parse and validate environment variables
  export const schema = z.object({
    // Required environment variables
    NATS_SERVICE_NAME: z.string().min(1),
    NATS_SERVICE_VERSION: z.string(),
    
    // Optional with defaults and parsing
    NATS_URL: z.string().url().default("nats://localhost:4222"),
    NATS_QUEUE_GROUP: z.string().optional(),
    NATS_MONITORING_ENABLED: z
      .string()
      .transform((v) => v === "true")
      .default("true"),
    NATS_MONITORING_INTERVAL: z
      .string()
      .transform((v) => parseInt(v, 10))
      .pipe(z.number().min(1000))
      .default("30000"),
    NATS_RATE_LIMIT_RPS: z
      .string()
      .transform((v) => parseInt(v, 10))
      .pipe(z.number().positive())
      .optional(),
  }).transform((env) => {
    // Transform flat env vars into nested config structure
    const config: BaseConfig.Type = {
      serviceName: env.NATS_SERVICE_NAME,
      serviceVersion: env.NATS_SERVICE_VERSION,
    };
    
    const features: Array<[string, any]> = [];
    
    if (env.NATS_MONITORING_ENABLED) {
      features.push(["monitoring", {
        interval: env.NATS_MONITORING_INTERVAL,
        includeMemoryStats: true,
        includeRequestStats: true
      }]);
    }
    
    if (env.NATS_QUEUE_GROUP) {
      features.push(["queueGroup", {
        name: env.NATS_QUEUE_GROUP,
        maxConcurrency: 10
      }]);
    }
    
    if (env.NATS_RATE_LIMIT_RPS) {
      features.push(["rateLimit", {
        maxRequestsPerSecond: env.NATS_RATE_LIMIT_RPS
      }]);
    }
    
    return { config, features };
  });
  
  export type Type = z.infer<typeof schema>;
}
```

### Builder Integration with Validation

```typescript
export class ServiceBuilder<
  R extends Environment, 
  S extends State,
  C extends BaseConfig.Type = BaseConfig.Type
> {
  private config: C;
  
  constructor(
    private description: ServiceDescription<R, S>,
    config: unknown // Accept unknown input
  ) {
    // Validate base config
    this.config = BaseConfig.schema.parse(config) as C;
  }
  
  withMonitoring(options: unknown = {}): ServiceBuilder<R, S, C & MonitoringConfig.Type> {
    // Parse partial input with defaults
    const validated = MonitoringConfig.schema.parse({ monitoring: options });
    return new ServiceBuilder(
      this.description,
      { ...this.config, ...validated }
    );
  }
  
  withRateLimit(options: unknown): ServiceBuilder<R, S, C & RateLimitConfig.Type> {
    // Validate and transform
    const validated = RateLimitConfig.schema.parse({ rateLimit: options });
    return new ServiceBuilder(
      this.description,
      { ...this.config, ...validated }
    );
  }
}
```

### Validation Error Handling

```typescript
// Create service with validation
try {
  const service = create(description, {
    serviceName: "my service", // Invalid: contains space
    serviceVersion: "1.0" // Invalid: missing patch version
  })
    .withMonitoring({
      interval: 500 // Invalid: less than 1000ms
    })
    .withRateLimit({
      maxRequestsPerSecond: -10 // Invalid: negative
    })
    .build();
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Configuration validation failed:");
    error.errors.forEach((err) => {
      console.error(`- ${err.path.join(".")}: ${err.message}`);
    });
    // Output:
    // - serviceName: Service name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens
    // - serviceVersion: Version must follow semver format (e.g., 1.0.0 or 1.0.0-beta.1)
    // - monitoring.interval: Interval must be at least 1 second
    // - rateLimit.maxRequestsPerSecond: Rate limit must be positive
  }
}
```

### Best Practices for Zod Schemas

1. **Always Define Schemas in Namespaces**: Group schema and type together
   ```typescript
   export namespace ConfigName {
     export const schema = z.object({ /* ... */ });
     export type Type = z.infer<typeof schema>;
   }
   ```

2. **Provide Descriptive Error Messages**: Include context in validation messages
   ```typescript
   z.string().min(1, "Service name cannot be empty")
   ```

3. **Use Transform for Normalization**: Apply defaults and compute derived values
   ```typescript
   .transform((data) => ({
     ...data,
     computed: data.value * 2
   }))
   ```

4. **Leverage Refinements for Complex Validation**: Cross-field and business logic validation
   ```typescript
   .refine(
     (data) => data.min <= data.max,
     { message: "Min must be less than max", path: ["min"] }
   )
   ```

5. **Document with Descriptions**: Use `.describe()` for API documentation
   ```typescript
   z.boolean()
     .default(true)
     .describe("Enable request statistics collection")
   ```

## Usage Examples

### Basic Usage

```typescript
const service = create(description, {
  serviceName: "my-service",
  serviceVersion: "1.0.0"
})
  .withMonitoring({
    interval: 30000,
    includeMemoryStats: true,
    includeRequestStats: true
  })
  .withTelemetry({
    sampling: { commands: 1.0, events: 0.1 },
    environment: "production"
  })
  .build();

// TypeScript knows the exact shape of the configuration
// Type: BaseConfig & MonitoringConfig & TelemetryConfig
```

### Type Aliases for Common Combinations

```typescript
// Define common configuration combinations
export type ProductionConfig = BaseConfig & MonitoringConfig & TelemetryConfig & RateLimitConfig;
export type DevelopmentConfig = BaseConfig & MonitoringConfig;
export type TestConfig = BaseConfig;

// Factory functions for common setups
export const productionService = <R extends Environment, S extends State>(
  description: ServiceDescription<R, S>,
  name: string,
  version: string
): ServiceBuilder<R, S, ProductionConfig> => {
  return create(description, { serviceName: name, serviceVersion: version })
    .withMonitoring({ interval: 60000, includeMemoryStats: true, includeRequestStats: true })
    .withTelemetry({ sampling: { commands: 1.0, events: 0.1 }, environment: "production" })
    .withRateLimit({ maxRequestsPerSecond: 1000, burst: 2000, perClient: true });
};
```

## Benefits

1. **Type Safety**: Full IntelliSense support and compile-time checking
2. **No Optional Fields**: Eliminates nullable checks and makes configuration explicit
3. **Progressive Enhancement**: Start simple, add features as needed
4. **Self-Documenting**: The type signature shows exactly what features are configured
5. **Testability**: Easy to create minimal configurations for testing
6. **Consistency**: Same pattern can be used across all wee-events packages

## Anti-Patterns to Avoid

### ❌ Optional Fields

```typescript
// Don't do this
type Config = {
  serviceName: string;
  monitoring?: MonitoringOptions;  // Optional fields make types less distinct
  telemetry?: TelemetryOptions;
};
```

### ❌ Single Monolithic Configuration

```typescript
// Don't do this
type ServiceConfig = {
  serviceName: string;
  monitoringInterval?: number;
  telemetryEnabled?: boolean;
  rateLimitMax?: number;
  // ... dozens of optional fields
};
```

### ✅ Use Type Intersections Instead

```typescript
// Do this
type Config = BaseConfig & MonitoringConfig & TelemetryConfig;
```

## Implementation Checklist

When implementing this pattern:

- [ ] Define a minimal `BaseConfig` type with only required fields
- [ ] Create separate types for each feature, with the feature name as the property key
- [ ] Implement Zod schemas for runtime validation
- [ ] Use generics in the builder to track configuration growth
- [ ] Return new builder instances (immutability)
- [ ] Use `in` operator for runtime feature detection
- [ ] Provide factory functions for common configurations
- [ ] Document which features are compatible/incompatible

## Related Patterns

- **ServiceDescription Builder**: Uses similar chaining for building service descriptions
- **Command/Event Namespaces**: Uses similar type patterns for organizing domain objects
- **Zod Schema Composition**: Leverages Zod for runtime validation of configurations

This pattern is fundamental to how we build extensible, type-safe APIs in wee-events and should be used consistently across all packages.
