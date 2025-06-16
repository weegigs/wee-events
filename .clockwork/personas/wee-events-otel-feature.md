# Automatic OpenTelemetry Instrumentation for wee-events

## Feature Overview

Enhance the wee-events `ServiceDescription` to automatically instrument all command handlers, event reducers, and aggregate operations with OpenTelemetry tracing, eliminating the need for manual instrumentation.

## Goals

1. **Zero-Configuration Observability**: Services get distributed tracing out-of-the-box
2. **Consistent Trace Context**: Automatic propagation across all operations
3. **Rich Metadata**: Capture command/event types, aggregate states, and business context
4. **Performance Monitoring**: Built-in metrics for command processing times and event throughput
5. **Error Tracking**: Automatic exception recording and error spans

## API Design

### Basic Usage

```typescript
import { ServiceDescription } from '@weegigs/wee-events';

export const accountService = ServiceDescription
  .create(metadata, loader, dispatcher)
  .withTelemetry({
    serviceName: 'account-service',
    serviceVersion: '1.0.0'
  });
```

### Advanced Configuration

```typescript
export const accountService = ServiceDescription
  .create(metadata, loader, dispatcher)
  .withTelemetry({
    serviceName: 'account-service',
    serviceVersion: '1.0.0',
    
    // Custom attribute extractors
    commandAttributes: (command, entity) => ({
      'account.id': entity.id,
      'account.balance': entity.state.type === 'open' ? entity.state.balance : null,
      'command.amount': command.type === 'deposit-funds' ? command.amount : null
    }),
    
    eventAttributes: (event, previousState, newState) => ({
      'event.aggregate_version': event.aggregateVersion,
      'state.transition': `${previousState.type} -> ${newState.type}`
    }),
    
    // Sampling configuration
    sampling: {
      commands: 1.0,      // Sample all commands
      events: 0.1,        // Sample 10% of events
      queries: 0.05       // Sample 5% of queries
    },
    
    // Custom span naming
    spanNaming: {
      command: (cmd) => `command.${cmd.type}`,
      event: (evt) => `event.${evt.type}`,
      reducer: (evt) => `reducer.${evt.type}`
    }
  });
```

## Implementation Details

### Automatic Instrumentation Points

1. **Command Processing**
   ```
   command.{command-type}
   ├── validate.command
   ├── load.aggregate
   ├── execute.handler
   │   ├── business.logic
   │   └── emit.events
   └── store.events
   ```

2. **Event Replay**
   ```
   replay.aggregate
   ├── load.events
   └── apply.reducers
       ├── event.{event-type-1}
       ├── event.{event-type-2}
       └── ...
   ```

3. **Query Processing**
   ```
   query.{query-type}
   ├── load.aggregate
   └── execute.projection
   ```

### Trace Context Propagation

```typescript
// Automatic context propagation through the event processing pipeline
export interface TracedPublisher extends Publisher {
  // Inherits trace context from parent span
  publish(events: DomainEvent[]): Promise<void>;
}

export interface TracedEntity<T> extends Entity<T> {
  // Carries trace context for aggregate operations
  readonly traceContext: TraceContext;
}
```

### Built-in Metrics

The feature should automatically emit these metrics:

```typescript
// Command metrics
'wee_events.command.duration' // Histogram of command processing time
'wee_events.command.count'    // Counter of commands processed
'wee_events.command.errors'   // Counter of command failures

// Event metrics  
'wee_events.event.count'      // Counter of events emitted
'wee_events.event.size'       // Histogram of event payload sizes

// Aggregate metrics
'wee_events.aggregate.load_time'    // Time to load aggregate from events
'wee_events.aggregate.event_count'  // Number of events per aggregate
'wee_events.aggregate.version'      // Current aggregate version
```

### Error Handling and Exceptions

```typescript
// Automatic exception recording
export const instrumentedHandler = (originalHandler) => {
  return tracer.startActiveSpan(`command.${command.type}`, async (span) => {
    try {
      span.setAttributes({
        'command.type': command.type,
        'aggregate.id': entity.id,
        'aggregate.type': entity.aggregateType
      });
      
      const result = await originalHandler(publisher, entity, command);
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setAttributes({
        'error.type': error.constructor.name,
        'error.message': error.message
      });
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error.message 
      });
      throw error;
    }
  });
};
```

## Integration with Durable Execution

When using with Temporal.io or Restate.dev, automatically integrate with their tracing:

```typescript
// Temporal integration
export const withTemporalTracing = (service: ServiceDescription) => {
  return service.withTelemetry({
    contextPropagation: 'temporal',
    parentSpanExtractor: (workflowContext) => {
      return workflowContext.info.workflowExecution.workflowId;
    }
  });
};

// Restate integration  
export const withRestateTracing = (service: ServiceDescription) => {
  return service.withTelemetry({
    contextPropagation: 'restate',
    parentSpanExtractor: (restateContext) => {
      return restateContext.request.id;
    }
  });
};
```

## Configuration Options

### Environment Variables

```bash
# OpenTelemetry standard variables
OTEL_SERVICE_NAME=account-service
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:14268/api/traces

# wee-events specific
WEE_EVENTS_TELEMETRY_ENABLED=true
WEE_EVENTS_TELEMETRY_SAMPLE_RATE=1.0
WEE_EVENTS_TELEMETRY_INCLUDE_PAYLOADS=false  # For security
```

### Configuration File

```typescript
// telemetry.config.ts
export const telemetryConfig = {
  enabled: process.env.NODE_ENV !== 'test',
  
  tracers: {
    default: {
      serviceName: 'wee-events-service',
      resource: {
        'service.name': 'wee-events-service',
        'service.version': '1.0.0',
        'deployment.environment': process.env.NODE_ENV
      }
    }
  },
  
  exporters: {
    console: process.env.NODE_ENV === 'development',
    otlp: {
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: {
        'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`
      }
    }
  },
  
  sampling: {
    parentBased: true,
    traceIdRatio: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0')
  }
};
```

## Security Considerations

1. **Sensitive Data Filtering**
   ```typescript
   const sensitiveFields = ['password', 'ssn', 'creditCard'];
   
   const sanitizeAttributes = (obj: any) => {
     return Object.fromEntries(
       Object.entries(obj).filter(([key]) => 
         !sensitiveFields.some(field => 
           key.toLowerCase().includes(field.toLowerCase())
         )
       )
     );
   };
   ```

2. **Payload Inclusion Control**
   ```typescript
   export const telemetryConfig = {
     includePayloads: {
       commands: false,     // Never include command payloads (may contain PII)
       events: true,        // Include event payloads (sanitized)
       queries: false       // Never include query results
     }
   };
   ```

## Testing Support

```typescript
// Test utilities for verifying telemetry
export const createTestTelemetry = () => {
  const spans: TestSpan[] = [];
  
  return {
    service: ServiceDescription
      .create(metadata, loader, dispatcher)
      .withTelemetry({
        serviceName: 'test-service',
        exporter: new InMemorySpanExporter(spans)
      }),
    
    getSpans: () => spans,
    getSpan: (name: string) => spans.find(s => s.name === name),
    assertSpanExists: (name: string) => {
      expect(spans.some(s => s.name === name)).toBe(true);
    }
  };
};

// Usage in tests
describe('Account Service Telemetry', () => {
  it('should create spans for command processing', async () => {
    const { service, assertSpanExists } = createTestTelemetry();
    
    await service.execute('open-account', accountId, {
      owner: 'John Doe',
      initialDeposit: 100
    });
    
    assertSpanExists('command.open-account');
    assertSpanExists('event.account-opened');
  });
});
```

## Migration Path

For existing services, provide a gradual migration:

```typescript
// Phase 1: Opt-in telemetry
export const accountService = ServiceDescription
  .create(metadata, loader, dispatcher)
  .withTelemetry(); // Basic telemetry

// Phase 2: Enhanced configuration  
export const accountService = ServiceDescription
  .create(metadata, loader, dispatcher)
  .withTelemetry({
    // Custom configuration
  });

// Phase 3: Full observability
export const accountService = ServiceDescription
  .create(metadata, loader, dispatcher)
  .withTelemetry()
  .withMetrics()
  .withHealthChecks();
```

## Implementation Complexity

**Complexity: Medium-High**

### Technical Challenges
1. **Performance Impact**: Ensure tracing overhead is minimal
2. **Context Propagation**: Maintain trace context across async boundaries
3. **Memory Management**: Prevent span leaks in long-running processes
4. **Configuration Complexity**: Balance simplicity with flexibility
5. **Integration Testing**: Verify telemetry works with various backends

### Development Approach
1. Start with basic command/event tracing
2. Add automatic attribute extraction
3. Implement metric collection
4. Add advanced configuration options
5. Create comprehensive test utilities

This feature would significantly improve the operational experience of wee-events services by providing production-ready observability out of the box.