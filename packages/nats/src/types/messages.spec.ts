import { describe, it, expect } from "vitest";
import {
  CommandRequest,
  CommandResponse,
  QueryRequest,
  QueryResponse,
  EventNotification,
  ServiceInfo,
  ServiceStats,
  HealthCheck,
  NatsHeaders,
} from "./messages";

describe("CommandRequest", () => {
  it("should validate valid command request", () => {
    const request: CommandRequest.Type = {
      aggregateId: {
        type: "receipt",
        key: "123",
      },
      command: {
        type: "create",
        data: { amount: 100 },
      },
      metadata: {
        messageId: "msg-001",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlation: {
          correlationId: "corr-123",
          causationId: "cmd-789",
        },
        authentication: {
          type: "jwt",
          token: "ey...",
        },
      },
    };

    const result = CommandRequest.schema.parse(request);
    expect(result.aggregateId.type).toBe("receipt");
    expect(result.metadata?.correlation?.correlationId).toBe("corr-123");
    expect(result.metadata?.authentication?.type).toBe("jwt");
  });

  it("should validate with minimal metadata", () => {
    const request: CommandRequest.Type = {
      aggregateId: {
        type: "receipt",
        key: "123",
      },
      command: {
        type: "create",
      },
      metadata: {
        messageId: "msg-002",
        timestamp: "2023-01-01T00:00:00.000Z",
      },
    };

    const result = CommandRequest.schema.parse(request);
    expect(result.metadata?.correlation).toBeUndefined();
    expect(result.metadata?.authentication).toBeUndefined();
  });

  it("should reject invalid timestamp", () => {
    const request = {
      aggregateId: {
        type: "receipt",
        key: "123",
      },
      command: {},
      metadata: {
        messageId: "msg-003",
        timestamp: "invalid-date",
      },
    };

    expect(() => CommandRequest.schema.parse(request)).toThrow();
  });
});

describe("CommandResponse", () => {
  it("should validate successful response", () => {
    const response: CommandResponse.Type = {
      success: true,
      result: { id: "123", status: "created" },
      duration: 150,
      metadata: {
        messageId: "resp-001",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlation: {
          correlationId: "corr-123",
        },
      },
    };

    const result = CommandResponse.schema.parse(response);
    expect(result.success).toBe(true);
    expect(result.duration).toBe(150);
    expect(result.error).toBeUndefined();
  });

  it("should validate error response", () => {
    const response: CommandResponse.Type = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid command data",
        details: { field: "amount", issue: "must be positive" },
      },
      duration: 50,
      metadata: {
        messageId: "resp-002",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlation: {
          correlationId: "corr-123",
        },
      },
    };

    const result = CommandResponse.schema.parse(response);
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe("VALIDATION_ERROR");
  });

  it("should reject negative duration", () => {
    const response: CommandResponse.Type = {
      success: true,
      duration: -10,
      metadata: {
        messageId: "resp-003",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlation: {
          correlationId: "corr-123",
        },
      },
    };

    expect(() => CommandResponse.schema.parse(response)).toThrow();
  });
});

describe("QueryRequest", () => {
  it("should validate valid query request", () => {
    const request: QueryRequest.Type = {
      aggregateId: {
        type: "receipt",
        key: "123",
      },
      metadata: {
        messageId: "query-001",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlation: {
          correlationId: "corr-query-123",
        },
        authentication: {
          type: "jwt",
          token: "ey...",
        },
      },
    };

    const result = QueryRequest.schema.parse(request);
    expect(result.aggregateId.key).toBe("123");
  });
});

describe("QueryResponse", () => {
  it("should validate successful query response", () => {
    const response: QueryResponse.Type = {
      success: true,
      entity: {
        id: { type: "receipt", key: "123" },
        state: { amount: 100, status: "paid" },
        revision: "abc123",
      },
      duration: 25,
      metadata: {
        messageId: "query-resp-001",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlation: {
          correlationId: "corr-query-123",
        },
      },
    };

    const result = QueryResponse.schema.parse(response);
    expect(result.success).toBe(true);
    expect(result.entity).toBeDefined();
  });
});

describe("EventNotification", () => {
  it("should validate valid event notification", () => {
    const event: EventNotification.Type = {
      aggregate: {
        type: "receipt",
        key: "123",
      },
      revision: "abc123",
      id: "evt-456",
      type: "ReceiptCreated",
      timestamp: "2023-01-01T00:00:00.000Z", // Timestamp of the event itself
      data: {
        amount: 100,
        currency: "USD",
      },
      metadata: {
        messageId: "event-msg-001",
        timestamp: "2023-01-01T00:00:05.000Z", // Timestamp of the NATS message envelope
        correlation: {
          correlationId: "corr-123",
          causationId: "cmd-789",
        },
      },
    };

    const result = EventNotification.schema.parse(event);
    expect(result.type).toBe("ReceiptCreated");
    expect(result.metadata?.correlation?.correlationId).toBe("corr-123");
  });
});

describe("ServiceInfo", () => {
  it("should validate NATS service info", () => {
    const info = {
      type: "io.nats.micro.v1.info_response",
      name: "receipt-service",
      id: "receipt-service-001",
      version: "1.0.0",
      description: "Receipt management service",
      endpoints: [
        {
          name: "CreateReceipt",
          subject: "receipt-service.command.receipt.create",
          queue_group: "receipt-workers",
        },
        {
          name: "GetReceipt",
          subject: "receipt-service.query.receipt.get",
        },
      ],
    };

    const result = ServiceInfo.schema.parse(info);
    expect(result.name).toBe("receipt-service");
    expect(result.endpoints).toHaveLength(2);
  });

  it("should reject invalid type", () => {
    const info = {
      type: "invalid-type",
      name: "test-service",
      id: "test-001",
      version: "1.0.0",
      endpoints: [],
    };

    expect(() => ServiceInfo.schema.parse(info)).toThrow();
  });
});

describe("ServiceStats", () => {
  it("should validate service stats", () => {
    const stats = {
      type: "io.nats.micro.v1.stats_response",
      name: "receipt-service",
      id: "receipt-service-001",
      version: "1.0.0",
      started: "2023-01-01T00:00:00.000Z",
      endpoints: [
        {
          name: "CreateReceipt",
          subject: "receipt-service.command.receipt.create",
          num_requests: 1000,
          num_errors: 5,
          last_error: "Validation failed",
          processing_time: 150000,
          average_processing_time: 150,
        },
      ],
    };

    const result = ServiceStats.schema.parse(stats);
    expect(result.endpoints[0].num_requests).toBe(1000);
    expect(result.endpoints[0].average_processing_time).toBe(150);
  });

  it("should reject negative request count", () => {
    const stats = {
      type: "io.nats.micro.v1.stats_response",
      name: "test-service",
      id: "test-001",
      version: "1.0.0",
      started: "2023-01-01T00:00:00.000Z",
      endpoints: [
        {
          name: "Test",
          subject: "test",
          num_requests: -1,
          num_errors: 0,
          processing_time: 0,
          average_processing_time: 0,
        },
      ],
    };

    expect(() => ServiceStats.schema.parse(stats)).toThrow();
  });
});

describe("HealthCheck", () => {
  it("should validate health check response", () => {
    const health = {
      type: "io.nats.micro.v1.ping_response",
      name: "receipt-service",
      id: "receipt-service-001",
      version: "1.0.0",
      status: "ok",
      data: {
        checks: [
          {
            name: "database",
            status: "ok",
          },
          {
            name: "cache",
            status: "error",
            message: "Connection timeout",
          },
        ],
      },
    };

    const result = HealthCheck.schema.parse(health);
    expect(result.status).toBe("ok");
    expect(result.data!.checks).toHaveLength(2);
  });

  it("should validate minimal health check", () => {
    const health = {
      type: "io.nats.micro.v1.ping_response",
      name: "test-service",
      id: "test-001",
      version: "1.0.0",
      status: "ok",
    };

    const result = HealthCheck.schema.parse(health);
    expect(result.data).toBeUndefined();
  });
});

describe("NatsHeaders", () => {
  it("should validate W3C trace context headers", () => {
    const headers = {
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      tracestate: "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE",
    };

    const result = NatsHeaders.schema.parse(headers);
    expect(result.traceparent).toBeDefined();
    expect(result["X-Correlation-Id"]).toBeUndefined();
  });

  it("should validate NATS message headers", () => {
    const headers = {
      "Nats-Msg-Id": "msg-123",
      "Nats-Expected-Stream": "EVENTS",
      "X-Service-Name": "receipt-service",
      "X-Service-Version": "1.0.0",
    };

    const result = NatsHeaders.schema.parse(headers);
    expect(result["Nats-Msg-Id"]).toBe("msg-123");
    expect(result["X-Service-Name"]).toBe("receipt-service");
  });

  it("should validate empty headers", () => {
    const headers = {};

    const result = NatsHeaders.schema.parse(headers);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
