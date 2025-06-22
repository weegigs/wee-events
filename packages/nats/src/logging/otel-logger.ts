import { trace, SpanStatusCode } from "@opentelemetry/api";

/**
 * Log levels supported by the OpenTelemetry logger
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Context data for structured logging
 */
export type LogContext = Record<string, unknown>;

/**
 * OpenTelemetry-aware logger interface
 */
export interface ILogger {
  child(context: LogContext): ILogger;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string | Error, context?: LogContext): void;
  fatal(message: string | Error, context?: LogContext): void;
}

/**
 * Configuration for the OpenTelemetry logger
 */
export type LoggerConfig = {
  serviceName: string;
  serviceVersion: string;
  environment?: string;
  minLevel?: LogLevel;
};

/**
 * Structured log entry format
 */
export type LogEntry = LogContext & {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: {
    name: string;
    version: string;
    environment?: string;
  };
  trace?: {
    traceId: string;
    spanId: string;
    traceFlags: number;
  };
};

/**
 * Simple OpenTelemetry-aware logger implementation
 * Automatically includes trace context when available
 */
export class OTelLogger implements ILogger {
  private readonly config: LoggerConfig;
  private readonly baseContext: LogContext;

  constructor(config: LoggerConfig, baseContext: LogContext = {}) {
    this.config = config;
    this.baseContext = baseContext;
  }

  child(context: LogContext): ILogger {
    return new OTelLogger(this.config, {
      ...this.baseContext,
      ...context,
    });
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string | Error, context?: LogContext): void {
    const errorMessage = message instanceof Error ? message.message : message;
    const errorContext =
      message instanceof Error ? { ...context, error: { name: message.name, stack: message.stack } } : context;

    this.log("error", errorMessage, errorContext);

    // Set span status to error if we're in an active span
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
    }
  }

  fatal(message: string | Error, context?: LogContext): void {
    const errorMessage = message instanceof Error ? message.message : message;
    const errorContext =
      message instanceof Error ? { ...context, error: { name: message.name, stack: message.stack } } : context;

    this.log("fatal", errorMessage, errorContext);

    // Set span status to error if we're in an active span
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Skip if below minimum level
    if (!this.shouldLog(level)) {
      return;
    }

    // Build structured log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: {
        name: this.config.serviceName,
        version: this.config.serviceVersion,
        environment: this.config.environment,
      },
      ...this.baseContext,
      ...context,
      ...this.getTraceContext(),
    };

    // Output to console with structured format
    // In production, this would be sent to an OpenTelemetry logs exporter
    this.outputLog(level, logEntry as LogEntry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error", "fatal"] as const;
    const minLevel = this.config.minLevel ?? "info";

    const levelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(minLevel);

    return levelIndex >= minLevelIndex;
  }

  private getTraceContext(): LogContext {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return {};
    }

    const spanContext = activeSpan.spanContext();
    return {
      trace: {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags,
      },
    };
  }

  private outputLog(level: LogLevel, logEntry: LogEntry): void {
    const formatted = JSON.stringify(logEntry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.log(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
      case "fatal":
        console.error(formatted);
        break;
    }
  }
}

/**
 * Create a new OpenTelemetry logger instance
 */
export function createOTelLogger(config: LoggerConfig): ILogger {
  return new OTelLogger(config);
}
