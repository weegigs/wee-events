# NATS Service Package Enhancements Plan

## 1. Overview

This plan outlines the steps to enhance the `@weegigs/events-nats` package based on the previous review. The focus is on fully implementing all features exposed by the `NatsServiceBuilder`, deepening OpenTelemetry integration, ensuring documentation accuracy, and aligning the package with overall project standards and conventions.

## 2. Goals

1.  **Feature Completeness**: Ensure all configuration options in `NatsServiceBuilder` are fully implemented and functional in `NatsServiceImpl`.
2.  **Enhanced Observability**: Deepen OpenTelemetry integration for comprehensive tracing of NATS client and server operations, including newly implemented features.
3.  **Documentation Accuracy**: Update the `README.md` and any relevant examples to accurately reflect the package's capabilities and align with project tooling standards (pnpm).
4.  **Robustness**: Add thorough tests for all new and existing features, maintaining high code quality.

## 3. Scope

This plan covers the following areas within the `@weegigs/events-nats` package:

*   Redefinition of message metadata structures in `wee-events/packages/nats/src/types/messages.ts` to support structured, extensible metadata including dedicated blocks for correlation and an initial focus on JWT for authentication.
*   Introduction of a request interceptor framework in `NatsServiceBuilder` and `NatsServiceImpl`.
*   Implementation of message-level JWT authentication as a request interceptor, configured via `AuthConfig` and `withAuth()`.
*   Definition and usage of a "request context" object, enriched by interceptors and passed to handlers.
*   Updates to `NatsClientImpl` to construct and allow specification of the new structured metadata, including JWT tokens.
*   Implementation of Rate Limiting and Circuit Breaker features in `NatsServiceImpl` (using `Cockatiel`), potentially leveraging the authenticated principal from the request context.
*   Integration of `TelemetryManager` for client-side (`NatsClientImpl`) and server-side (`NatsServiceImpl`) operations, including tracing for interceptors and attributes from the request context.
*   Updates to `README.md` to document the interceptor framework, JWT authentication, new metadata structure, and alignment with project conventions.
*   Addition of new unit and integration tests for all updated and implemented features.
*   Explicit clarification that NATS connection-level authentication is outside the scope of `AuthConfig` and this package's service builder.

## 4. Detailed Plan

### Phase 1: Structured Metadata and Message-Level Authentication

This phase focuses on redefining message structures, introducing an interceptor framework, and implementing message-level JWT authentication.

**Task 1.1: Redefine Message Metadata Structures**
*   **File**: `wee-events/packages/nats/src/types/messages.ts`
*   **Action**:
    *   Create `CorrelationMetadataBlock.schema` (for `correlationId`, `causationId`).
    *   Create `AuthenticationMetadataBlock.schema` (initially for `type: 'jwt'`, `token: string`). This schema can be a discriminated union for future extension.
    *   Define a new top-level `MessageMetadata.schema` including `messageId` (ULID), `timestamp` (ISO string), optional `correlation` (`CorrelationMetadataBlock`), optional `authentication` (`AuthenticationMetadataBlock`), and optional `context: z.record(z.string(), z.unknown())`. The entire `MessageMetadata.schema` will be optional in message definitions.
    *   Update `CommandRequest.schema`, `QueryRequest.schema`, `CommandResponse.schema`, `EventNotification.schema` to use `MessageMetadata.schema.optional()` for their `metadata` field.
*   **Testing**: Unit tests for new Zod schemas.

**Task 1.2: Design and Implement Request Interceptor Framework**
*   **Files**: `wee-events/packages/nats/src/server.ts` (primarily `NatsServiceBuilder` and `NatsServiceImpl`), potentially new `interceptors.ts`.
*   **Action**:
    *   Define an `Interceptor` interface (e.g., `(message: NatsMessage, context: RequestContext, next: NextInterceptor) => Promise<void | NatsResponse>`).
    *   Define a `RequestContext` object type. This context will be created per message and can be enriched by interceptors.
    *   Modify `NatsServiceBuilder` to allow adding interceptors (e.g., `withInterceptor(interceptor: Interceptor)`). Interceptors will be executed in the order they are added.
    *   Modify `NatsServiceImpl` message handling logic to create the `RequestContext` and run the configured interceptor chain before invoking the actual command/query handler.
*   **Testing**: Unit tests for the interceptor chain logic.

**Task 1.3: Implement JWT Authentication as an Interceptor**
*   **Files**: New file e.g., `wee-events/packages/nats/src/features/auth-interceptor.ts`, updates to `NatsServiceBuilder` (`withAuth` method).
*   **Action**:
    *   Create a JWT authentication interceptor.
    *   The `NatsServiceBuilder.withAuth(authConfig: AuthConfig)` method will now configure and add this JWT authentication interceptor.
    *   `AuthConfig.schema` (in `types/config.ts`) will be refined to allow specification of a JWT validation strategy and its parameters (e.g., JWKS URI or public key, expected issuer/audience for a basic validator).
    *   A basic, configurable JWT validator will be provided as part of the package.
    *   The interceptor will:
        *   Extract the JWT token from `message.metadata.authentication.token`.
        *   Delegate validation to the configured JWT validation strategy (using the basic validator by default if configured with standard JWT parameters).
        *   If valid, extract principal information (e.g., `sub` claim) and add it to the `RequestContext` as `requestContext.principal`.
        *   If invalid or missing when required by `AuthConfig`, the interceptor will short-circuit and respond with an authentication error.
*   **Testing**: Unit tests for the interceptor and basic validator logic; integration tests for JWT authentication scenarios.
*   **Telemetry**: The interceptor will add authentication-related attributes/events to the main message processing span.

**Task 1.4: Update Client-Side Metadata Construction for JWT**
*   **File**: `wee-events/packages/nats/src/client.ts` (`NatsClientImpl`)
*   **Action**:
    *   Modify client methods (`execute`, `query`) to allow users to provide a JWT token, which will be placed in `message.metadata.authentication`.
    *   Update construction of `MessageMetadata` to include `messageId`, `timestamp`, optional `correlation`, optional `authentication` (with JWT), and `context`.
    *   Auto-generate `correlationId` if not provided.
*   **Testing**: Unit and integration tests for client sending messages with JWT authentication metadata.

**Task 1.5: Clarify NATS Connection-Level Authentication**
*   **Action**: Explicitly document (e.g., in `README.md` and `AuthConfig` comments) that NATS connection-level authentication (client-to-NATS-server) is distinct from message-level authentication and should be configured directly using the NATS client library options, not through `withAuth()`.

### Phase 2: Implement Resilience Features and Deepen OpenTelemetry Integration

This phase focuses on the remaining `NatsServiceBuilder` features and enhancing observability.

**Task 2.1: Implement Rate Limiting as an Interceptor (or applied post-interceptor chain)**
*   **Files**: New file e.g., `wee-events/packages/nats/src/features/rate-limit-interceptor.ts`, `NatsServiceBuilder` (`withRateLimit` method).
*   **Action**: Implement rate limiting using `Cockatiel`. `NatsServiceBuilder.withRateLimit()` will configure and add this as an interceptor (or apply it around the final handler call after other interceptors).
*   **Considerations**:
    *   Utilize `RateLimitConfig.schema`.
    *   For `perClient` rate limiting, the client identity will default to the authenticated principal ID (e.g., JWT `sub` claim) available in the `RequestContext`. The behavior if no principal is found (e.g., fallback to IP, or error if identity is strictly required) needs to be defined.
    *   Implement `keyExtractor` logic, which would operate on the `RequestContext` and/or message.
*   **Testing**: Unit tests for config; integration tests for rate limiting behavior using the request context.
*   **Telemetry**: OTel attributes indicating rate limit checks, identity used, and outcomes.

**Task 2.2: Implement Circuit Breaker**
*   **File**: `wee-events/packages/nats/src/server.ts` (`NatsServiceImpl`), potentially new `circuit-breaker-logic.ts`.
*   **Action**: Integrate circuit breaker functionality using `Cockatiel`. This would typically wrap the execution of the actual business logic (the target command/query handler) *after* the interceptor chain.
*   **Considerations**:
    *   Utilize `CircuitBreakerConfig.schema`.
    *   Circuit breakers might be per command/query type or global for the service instance.
*   **Testing**: Unit tests for config; integration tests for circuit breaker states.
*   **Telemetry**: Add OTel attributes/events for circuit breaker state changes.

**Task 2.3: Integrate `TelemetryManager` with Interceptor Framework and Request Context**
*   **Action**:
    *   `NatsServiceImpl`: When processing a message, ensure the main span for message handling is created.
    *   Interceptors: Interceptors will primarily add relevant attributes and events to the main parent span for message processing. This helps in reducing span volume while still capturing the necessary details of the interceptor's execution.
    *   Trace Context Propagation: W3C trace context headers (e.g., `traceparent`) in NATS headers are primary for cross-service propagation. The `telemetryManager.extractTraceContext(msg.headers)` will be used to link incoming traces.
    *   `RequestContext`: The `RequestContext` can carry the active OTel `Context` object.
    *   `telemetryManager.addCorrelationAttributes()`: Use with data from the new structured `message.metadata.correlation`.
*   **Testing**: Verify trace context propagation through interceptors and correct span hierarchy.

**Task 2.4: Integrate `TelemetryManager` in `NatsClientImpl` (Client-Side)**
*   **Action**:
    *   In `NatsClientImpl` methods (`execute`, `query`, service discovery methods):
        *   Use `telemetryManager.startRequestSpan()` to create a client span.
        *   Use `telemetryManager.createTraceHeaders()` to generate trace propagation headers.
        *   Merge these headers with other message headers (e.g., via `MessageUtils.createHeaders`).
        *   Use `telemetryManager.withSpan()` to wrap the NATS request logic.
*   **Testing**: Verify client-side span creation and propagation of trace context to the NATS server/service, including new metadata attributes.

**Task 2.5: Review and Add Specific OTel Attributes for NATS Operations**
*   **Action**: Enhance span attributes to include NATS-specific information:
    *   `messaging.nats.subject`, `messaging.nats.queue_group`
    *   For features: `nats.feature.ratelimit.triggered`, `nats.feature.circuitbreaker.state`, `nats.feature.auth.status`.
    *   Consider attributes from the OpenTelemetry `messaging` semantic conventions.
*   **Testing**: Validate that these attributes appear correctly in exported spans.

**Task 2.6: Update and Verify Telemetry Tests**
*   **Action**: Review `wee-events/packages/nats/src/features/telemetry.spec.ts` and other relevant tests.
*   **Considerations**: The current `telemetry.spec.ts` uses a `NoopTracer`. For more effective testing, consider using an `InMemorySpanExporter` (as suggested in `wee-events-otel-feature.md`) to assert span creation and attributes.
*   **Testing**: Ensure tests cover new span creation points and attribute additions.

### Phase 3: Documentation and Alignment

**Task 3.1: Update `wee-events/packages/nats/README.md`**
*   **Action**:
    *   Document the new structured `MessageMetadata` (correlation, authentication, context blocks).
    *   Explain the message-level authentication strategy and how to configure it using `withAuth()`.
    *   Document newly implemented features (Rate Limiting, Circuit Breaker).
    *   Provide clear examples for configuring and using all features with the `NatsServiceBuilder`.
    *   Ensure the README reflects the full capabilities of the package.
    *   Detail the OpenTelemetry integration, including new metadata attributes being traced.

**Task 3.2: Align README with Project Tooling Standards**
*   **Action**: Ensure all examples in `wee-events/packages/nats/README.md` use `pnpm`, consistent with `CLAUDE.md` and current project standards.

**Task 3.3: Update Sample Code**
*   **Action**: If applicable, update `wee-events/packages/nats/src/sample/` to demonstrate new features or improved OpenTelemetry integration.

### Phase 4: Comprehensive Testing and Validation

**Task 4.1: Add New Integration Tests**
*   **Action**: Create new Testcontainer-based integration tests (`docker.spec.ts` style) for:
    *   Message-level authentication scenarios (valid, invalid, missing auth metadata).
    *   Rate Limiting behavior under load, including `perClient` if based on authenticated identity.
    *   Circuit Breaker state transitions and recovery.
    *   NATS connection-level authentication scenarios (if distinguished and configurable).
*   **Testing**: These are the tests themselves.

**Task 4.2: Full Test Suite Execution and Validation**
*   **Action**: Run `pnpm run test` for the `@weegigs/events-nats` package and `pnpm run test` for the entire monorepo.
*   **Testing**: Ensure all existing and new tests pass. Verify there are no regressions.

**Task 4.3: Review Test Coverage**
*   **Action**: Analyze test coverage reports.
*   **Testing**: Identify and address any significant gaps in test coverage for new or modified code.

## 5. Decision Points & Discussion

To proceed effectively, I need your input on the following, keeping the new interceptor-based, message-level JWT auth strategy in mind:

1.  **JWT Validation within Auth Interceptor**:
    *   **Decision**: The JWT authentication interceptor will delegate to a configured validation implementation. A basic, configurable JWT validator (handling signature, expiry, issuer, audience via `AuthConfig`) will be provided as part of the package. `AuthConfig` will specify the validator and its parameters. The validated principal will be added to the `RequestContext`.

2.  **Client Identity for `perClient` Rate Limiting**:
    *   **Decision**: Yes, with message-level JWT authentication populating the `RequestContext` with the principal (e.g., JWT `sub`), this authenticated principal ID will be the default and primary way to identify a "client" when `perClient` rate limiting is enabled. Behavior if no principal is available (and `perClient` is true) needs to be defined (e.g., error, or fallback to a global limit).

3.  **Specific OpenTelemetry Attributes for New Features**:
    *   **From `MessageMetadata`**: Yes, attributes `messaging.message_id`, `messaging.correlation_id`, and `messaging.causation_id` (if present in metadata) are desirable on the main message processing span.
    *   **For Interceptors**: Decision: Interceptors will primarily add attributes and events to the parent (main) message processing span.
    *   **For JWT Message-Level Authentication (attributes added by the auth interceptor to the main span)**:
        *   `auth.message.method: 'jwt'`
        *   `auth.message.status: 'success' | 'failure' | 'token_not_provided'`
        *   If successful: `auth.message.principal_id: <subject_from_jwt>`
    *   **For Rate Limiting Identity Type**: An attribute like `ratelimit.identity_type: 'jwt_sub'` (or the actual principal ID type) on the main span if `perClient` rate limiting is active and an identity was used.

## 6. Success Criteria

*   Message metadata structures (`CommandRequest`, `QueryRequest`, etc.) are updated to include optional, structured `correlation` and `authentication` (initially JWT) blocks, alongside `messageId`, `timestamp`, and `context`.
*   A request interceptor framework is implemented in `NatsServiceBuilder` and `NatsServiceImpl`.
*   `AuthConfig` (via `withAuth()`) configures a JWT authentication interceptor that validates tokens from message metadata and enriches a `RequestContext` with principal information.
*   NATS connection-level authentication is explicitly out of scope for `AuthConfig` / `withAuth()`.
*   `NatsClientImpl` allows construction of messages with the new structured metadata, including JWT tokens.
*   Rate Limiting and Circuit Breaker features are implemented using `Cockatiel`, potentially as interceptors or leveraging the `RequestContext` (especially for `perClient` rate limiting).
*   OpenTelemetry integration traces interceptor execution and includes attributes from the `RequestContext` and structured metadata.
*   The `wee-events/packages/nats/README.md` is updated to reflect all these changes, including the interceptor pattern and JWT auth.
*   Robust unit and integration tests cover the interceptor framework, JWT authentication, rate limiting, and circuit breaker functionalities.
*   The package continues to align with the overall `wee-events` architecture and quality standards.

## 6. Success Criteria

*   All methods on `NatsServiceBuilder` (including `withRateLimit`, `withCircuitBreaker`, `withAuth`) are fully implemented and their configurations are respected by `NatsServiceImpl`.
*   OpenTelemetry integration is deepened:
    *   `NatsClientImpl` creates client spans and propagates trace context.
    *   `NatsServiceImpl` extracts trace context and creates server spans for message handling.
    *   Spans include relevant NATS-specific attributes and attributes for the newly implemented features.
*   The `wee-events/packages/nats/README.md` is updated, accurate, comprehensive, and uses `pnpm` for all examples.
*   Robust unit and integration tests (using Testcontainers) cover all implemented features, including edge cases and failure modes.
*   The package continues to align with the overall `wee-events` architecture and quality standards.

## 7. Risk Assessment

*   **Increased Complexity**: Implementing the interceptor framework and features like message-level auth can increase package complexity. Mitigation: Phased approach, clear interfaces, thorough testing.
*   **Performance Overhead**: New features like rate limiting or detailed tracing might introduce performance overhead. Mitigation: Benchmark and optimize; make telemetry attribute collection configurable.
*   **Dependency Management**: If external libraries like `Cockatiel` are introduced, manage them via the workspace catalog.

## 8. High-Level Timeline (Sequence)

1.  **Clarify Decision Points**: Resolve the discussion items listed above.
2.  **Phase 1 Execution**: Implement structured metadata and message-level authentication.
3.  **Phase 2 Execution**: Implement resilience features (Rate Limiting, Circuit Breaker) and deepen OpenTelemetry integration.
4.  **Phase 3 Execution**: Update documentation and align examples.
5.  **Phase 4 Execution**: Add comprehensive tests and validate.
6.  **Final Review**: Ensure all goals and success criteria are met.

This plan provides a structured approach to evolving the `@weegigs/events-nats` package. I await your guidance on the decision points to refine the implementation details.