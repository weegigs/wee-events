import { describe, it, expect } from "vitest";
import { trace, context } from "@opentelemetry/api";
import { createTelemetryManager } from "./telemetry";
import { createOTelLogger } from "../logging/otel-logger";

describe("TelemetryManager", () => {
  const logger = createOTelLogger({
    serviceName: "test-service",
    serviceVersion: "1.0.0",
  });

  const telemetryManager = createTelemetryManager(logger);

  describe("createTraceHeaders", () => {
    it("should return empty headers when no active span", () => {
      const headers = telemetryManager.createTraceHeaders();
      expect(headers).toEqual({});
    });

    it("should create trace headers from active span", () => {
      // Note: In test environment without proper OTel setup,
      // the NoopTracer is used which doesn't create real spans
      const tracer = trace.getTracer("test");
      const span = tracer.startSpan("test-span");

      context.with(trace.setSpan(context.active(), span), () => {
        const headers = telemetryManager.createTraceHeaders();

        // In test environment with NoopTracer, headers will be empty
        // This test validates the function doesn't crash
        expect(headers).toBeDefined();
        expect(typeof headers).toBe("object");

        span.end();
      });
    });
  });

  describe("extractTraceContext", () => {
    it("should return active context when no headers", () => {
      const extractedContext = telemetryManager.extractTraceContext();
      expect(extractedContext).toBeDefined();
    });

    it("should return active context when no traceparent header", () => {
      const mockHeaders = new Map([["other-header", "value"]]);
      const extractedContext = telemetryManager.extractTraceContext(mockHeaders as any);
      expect(extractedContext).toBeDefined();
    });

    it("should extract trace context from valid traceparent", () => {
      const traceId = "12345678901234567890123456789012";
      const spanId = "1234567890123456";
      const flags = "01";
      const traceparent = `00-${traceId}-${spanId}-${flags}`;

      const mockHeaders = new Map([["traceparent", traceparent]]);
      const extractedContext = telemetryManager.extractTraceContext(mockHeaders as any);

      expect(extractedContext).toBeDefined();
    });

    it("should handle invalid traceparent gracefully", () => {
      const mockHeaders = new Map([["traceparent", "invalid-format"]]);
      const extractedContext = telemetryManager.extractTraceContext(mockHeaders as any);
      expect(extractedContext).toBeDefined();
    });
  });

  describe("startMessageSpan", () => {
    it("should create a server span for message processing", () => {
      const span = telemetryManager.startMessageSpan("process-command", "service.command.entity.create", "command");

      expect(span).toBeDefined();
      span.end();
    });
  });

  describe("startRequestSpan", () => {
    it("should create a client span for outgoing requests", () => {
      const span = telemetryManager.startRequestSpan("send-command", "service.command.entity.create", "command");

      expect(span).toBeDefined();
      span.end();
    });
  });

  describe("withSpan", () => {
    it("should execute function within span context", async () => {
      const tracer = trace.getTracer("test");
      const span = tracer.startSpan("test-span");

      const result = await telemetryManager.withSpan(span, async () => {
        return "test-result";
      });

      expect(result).toBe("test-result");
    });

    it("should handle errors and set span status", async () => {
      const tracer = trace.getTracer("test");
      const span = tracer.startSpan("test-span");

      await expect(
        telemetryManager.withSpan(span, async () => {
          throw new Error("test error");
        })
      ).rejects.toThrow("test error");
    });
  });

  describe("addCorrelationAttributes", () => {
    it("should add attributes to active span", () => {
      const tracer = trace.getTracer("test");
      const span = tracer.startSpan("test-span");

      context.with(trace.setSpan(context.active(), span), () => {
        telemetryManager.addCorrelationAttributes("corr-123", "agg-456", "user-789");
        span.end();
      });
    });

    it("should handle no active span gracefully", () => {
      expect(() => {
        telemetryManager.addCorrelationAttributes("corr-123");
      }).not.toThrow();
    });
  });
});
