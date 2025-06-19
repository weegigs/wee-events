import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { MessageCodec, codecs, createCodec, MessageUtils, CompressionUtils, ContentType } from "./codec";
import { CommandRequest, CommandResponse, QueryRequest } from "../types";

describe("MessageCodec", () => {
  const testSchema = z.object({
    id: z.string(),
    value: z.number(),
    optional: z.string().optional(),
  });

  type TestMessage = z.infer<typeof testSchema>;

  let codec: MessageCodec<TestMessage>;

  beforeEach(() => {
    codec = createCodec(testSchema);
  });

  describe("encode", () => {
    it("should encode valid message to Uint8Array", () => {
      const message: TestMessage = {
        id: "test-123",
        value: 42,
      };

      const encoded = codec.encode(message);

      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(0);

      // Should be valid JSON
      const json = Buffer.from(encoded).toString("utf8");
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe("test-123");
      expect(parsed.value).toBe(42);
    });

    it("should include optional fields when provided", () => {
      const message: TestMessage = {
        id: "test-456",
        value: 100,
        optional: "optional-value",
      };

      const encoded = codec.encode(message);
      const json = Buffer.from(encoded).toString("utf8");
      const parsed = JSON.parse(json);

      expect(parsed.optional).toBe("optional-value");
    });

    it("should reject invalid message", () => {
      const invalidMessage = {
        id: "test",
        value: "not-a-number", // Should be number
      };

      expect(() => codec.encode(invalidMessage as any)).toThrow();
    });

    it("should reject missing required fields", () => {
      const invalidMessage = {
        id: "test",
        // Missing required 'value' field
      };

      expect(() => codec.encode(invalidMessage as any)).toThrow();
    });
  });

  describe("decode", () => {
    it("should decode valid Uint8Array to message", () => {
      const originalMessage: TestMessage = {
        id: "decode-test",
        value: 999,
        optional: "decoded",
      };

      const encoded = codec.encode(originalMessage);
      const decoded = codec.decode(encoded);

      expect(decoded).toEqual(originalMessage);
    });

    it("should reject invalid JSON", () => {
      const invalidJson = Buffer.from("{ invalid json", "utf8");

      expect(() => codec.decode(invalidJson)).toThrow();
    });

    it("should reject JSON that doesn't match schema", () => {
      const validJson = JSON.stringify({
        id: "test",
        value: "wrong-type",
      });
      const encoded = Buffer.from(validJson, "utf8");

      expect(() => codec.decode(encoded)).toThrow();
    });

    it("should handle empty optional fields", () => {
      const message = {
        id: "minimal",
        value: 1,
      };

      const json = JSON.stringify(message);
      const encoded = Buffer.from(json, "utf8");
      const decoded = codec.decode(encoded);

      expect(decoded.id).toBe("minimal");
      expect(decoded.value).toBe(1);
      expect(decoded.optional).toBeUndefined();
    });
  });

  describe("validateHeaders", () => {
    it("should validate empty headers", () => {
      const headers = codec.validateHeaders({});
      expect(headers).toEqual({});
    });

    it("should validate valid headers", () => {
      const inputHeaders = {
        "X-Correlation-Id": "corr-123",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      };

      const headers = codec.validateHeaders(inputHeaders);
      expect(headers["X-Correlation-Id"]).toBe("corr-123");
      expect(headers.traceparent).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    });

    it("should ignore unknown headers", () => {
      const inputHeaders = {
        "X-Correlation-Id": "corr-123",
        "Unknown-Header": "ignored",
      };

      const headers = codec.validateHeaders(inputHeaders);
      expect(headers["X-Correlation-Id"]).toBe("corr-123");
      expect((headers as any)["Unknown-Header"]).toBeUndefined();
    });

    it("should handle null/undefined headers", () => {
      expect(codec.validateHeaders(null)).toEqual({});
      expect(codec.validateHeaders(undefined)).toEqual({});
    });
  });
});

describe("Pre-configured codecs", () => {
  describe("commandRequest codec", () => {
    it("should encode/decode command request", () => {
      const request: CommandRequest.Type = {
        aggregateId: {
          type: "test",
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
          },
        },
      };

      const encoded = codecs.commandRequest.encode(request);
      const decoded = codecs.commandRequest.decode(encoded);

      expect(decoded).toEqual(request);
      expect(decoded.aggregateId.type).toBe("test");
      expect(decoded.metadata?.correlation?.correlationId).toBe("corr-123");
    });

    it("should validate command request schema", () => {
      const invalidRequest = {
        aggregateId: { type: "test" }, // Missing key
        command: {},
        metadata: { messageId: "msg-002" }, // Missing timestamp
      };

      expect(() => codecs.commandRequest.encode(invalidRequest as any)).toThrow();
    });
  });

  describe("commandResponse codec", () => {
    it("should encode/decode successful command response", () => {
      const response: CommandResponse.Type = {
        success: true,
        result: { id: "created-123" },
        duration: 150,
        metadata: {
          messageId: "resp-001",
          timestamp: "2023-01-01T00:00:00.000Z",
          correlation: {
            correlationId: "corr-123",
          },
        },
      };

      const encoded = codecs.commandResponse.encode(response);
      const decoded = codecs.commandResponse.decode(encoded);

      expect(decoded).toEqual(response);
      expect(decoded.success).toBe(true);
      expect(decoded.duration).toBe(150);
    });

    it("should encode/decode error command response", () => {
      const response: CommandResponse.Type = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: { field: "amount" },
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

      const encoded = codecs.commandResponse.encode(response);
      const decoded = codecs.commandResponse.decode(encoded);

      expect(decoded.success).toBe(false);
      expect(decoded.error?.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("queryRequest codec", () => {
    it("should encode/decode query request", () => {
      const request: QueryRequest.Type = {
        aggregateId: {
          type: "receipt",
          key: "rec-789",
        },
        metadata: {
          messageId: "query-001",
          timestamp: "2023-01-01T12:00:00.000Z",
          correlation: {
            correlationId: "query-corr-456",
          },
        },
      };

      const encoded = codecs.queryRequest.encode(request);
      const decoded = codecs.queryRequest.decode(encoded);

      expect(decoded).toEqual(request);
      expect(decoded.aggregateId.key).toBe("rec-789");
    });
  });
});

describe("MessageUtils", () => {
  const codec = createCodec(
    z.object({
      message: z.string(),
      value: z.number(),
    })
  );

  describe("safeEncode", () => {
    it("should return success for valid message", () => {
      const message = { message: "test", value: 42 };
      const result = MessageUtils.safeEncode(codec, message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(Uint8Array);
      }
    });

    it("should return error for invalid message", () => {
      const invalidMessage = { message: "test", value: "not-number" };
      const result = MessageUtils.safeEncode(codec, invalidMessage as any);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
        expect(typeof result.error).toBe("string");
      }
    });
  });

  describe("safeDecode", () => {
    it("should return success for valid data", () => {
      const message = { message: "test", value: 42 };
      const encoded = codec.encode(message);
      const result = MessageUtils.safeDecode(codec, encoded);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toEqual(message);
      }
    });

    it("should return error for invalid data", () => {
      const invalidData = Buffer.from("invalid json", "utf8");
      const result = MessageUtils.safeDecode(codec, invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("getMessageSize", () => {
    it("should return correct size in bytes", () => {
      const message = { message: "hello", value: 123 };
      const encoded = codec.encode(message);
      const size = MessageUtils.getMessageSize(encoded);

      expect(size).toBe(encoded.length);
      expect(size).toBeGreaterThan(0);
    });
  });

  describe("exceedsLimit", () => {
    it("should return true when message exceeds limit", () => {
      const message = { message: "x".repeat(1000), value: 1 };
      const encoded = codec.encode(message);

      expect(MessageUtils.exceedsLimit(encoded, 100)).toBe(true);
      expect(MessageUtils.exceedsLimit(encoded, 10000)).toBe(false);
    });
  });

  describe("generateCorrelationId", () => {
    it("should generate unique correlation IDs", () => {
      const id1 = MessageUtils.generateCorrelationId();
      const id2 = MessageUtils.generateCorrelationId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(0);
    });

    it("should generate valid ULID format", () => {
      const id = MessageUtils.generateCorrelationId();

      // ULID format: 26 characters, base32 encoded
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(id.length).toBe(26);
    });

    it("should generate ULID with provided timestamp", () => {
      const timestamp = new Date("2023-01-01T00:00:00.000Z");
      const id1 = MessageUtils.generateCorrelationId(timestamp);
      const id2 = MessageUtils.generateCorrelationId(timestamp);

      // Both should have same timestamp component (first 10 characters)
      expect(id1.substring(0, 10)).toBe(id2.substring(0, 10));

      // But should be different overall due to random component
      expect(id1).not.toBe(id2);

      // Should still be valid ULID format
      expect(id1).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(id2).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
  });

  describe("generateTimestamp", () => {
    it("should generate valid ISO timestamp", () => {
      const timestamp = MessageUtils.generateTimestamp();
      const date = new Date(timestamp);

      expect(isNaN(date.getTime())).toBe(false);
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe("createHeaders", () => {
    it("should create headers with provided options", () => {
      const headers = MessageUtils.createHeaders({
        serviceName: "test-service",
        traceParent: "00-trace-span-01",
      });

      expect(headers["X-Service-Name"]).toBe("test-service");
      expect(headers.traceparent).toBe("00-trace-span-01");
    });

    it("should create empty headers when no options provided", () => {
      const headers = MessageUtils.createHeaders();
      expect(Object.keys(headers)).toHaveLength(0);
    });

    it("should only include provided options", () => {
      const headers = MessageUtils.createHeaders({
        serviceName: "test-service-only",
      });

      expect(headers["X-Service-Name"]).toBe("test-service-only");
      expect(headers.traceparent).toBeUndefined();
    });
  });

  describe("getCorrelationId", () => {
    it("should return undefined as correlation ID is no longer in headers", () => {
      const headers = { "X-Correlation-Id": "extracted-corr-123" };
      const correlationId = MessageUtils.getCorrelationId(headers);

      expect(correlationId).toBeUndefined();
    });
  });

  describe("getTraceParent", () => {
    it("should extract trace parent from headers", () => {
      const headers = {
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      };
      const traceParent = MessageUtils.getTraceParent(headers);

      expect(traceParent).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    });

    it("should return undefined if no trace parent", () => {
      const headers = { "X-Correlation-Id": "corr-123" };
      const traceParent = MessageUtils.getTraceParent(headers);

      expect(traceParent).toBeUndefined();
    });
  });
});

describe("CompressionUtils", () => {
  describe("shouldCompress", () => {
    it("should recommend compression for large messages", () => {
      const largeData = new Uint8Array(2048);
      const smallData = new Uint8Array(512);

      expect(CompressionUtils.shouldCompress(largeData, 1024)).toBe(true);
      expect(CompressionUtils.shouldCompress(smallData, 1024)).toBe(false);
    });

    it("should use default threshold of 1024 bytes", () => {
      const data = new Uint8Array(1500);
      expect(CompressionUtils.shouldCompress(data)).toBe(true);

      const smallData = new Uint8Array(500);
      expect(CompressionUtils.shouldCompress(smallData)).toBe(false);
    });
  });

  describe("compress/decompress", () => {
    it("should return same data (placeholder implementation)", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      const compressed = await CompressionUtils.compress(data);
      const decompressed = await CompressionUtils.decompress(compressed);

      expect(compressed).toEqual(data);
      expect(decompressed).toEqual(data);
    });
  });
});

describe("ContentType", () => {
  it("should provide standard content type constants", () => {
    expect(ContentType.JSON).toBe("application/json");
    expect(ContentType.BINARY).toBe("application/octet-stream");
    expect(ContentType.TEXT).toBe("text/plain");
  });
});
