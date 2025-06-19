import { describe, it, expect } from "vitest";
import {
  NatsServiceConfig,
  QueueGroupConfig,
  MonitoringConfig,
  TelemetryConfig,
  RateLimitConfig,
  CircuitBreakerConfig,
  AuthConfig,
  HealthConfig,
} from "./config";

describe("NatsServiceConfig", () => {
  describe("valid configurations", () => {
    it("should validate minimal valid config", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      };

      const result = NatsServiceConfig.schema.parse(config);
      expect(result).toEqual({
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        natsUrl: "nats://localhost:4222",
      });
    });

    it("should validate config with custom NATS URL", () => {
      const config = {
        serviceName: "my-service",
        serviceVersion: "2.1.0-beta.1",
        natsUrl: "nats://nats.example.com:4222",
      };

      const result = NatsServiceConfig.schema.parse(config);
      expect(result.natsUrl).toBe("nats://nats.example.com:4222");
    });
  });

  describe("invalid configurations", () => {
    it("should reject empty service name", () => {
      const config = {
        serviceName: "",
        serviceVersion: "1.0.0",
      };

      expect(() => NatsServiceConfig.schema.parse(config)).toThrow("Service name cannot be empty");
    });

    it("should reject service name with uppercase", () => {
      const config = {
        serviceName: "Test-Service",
        serviceVersion: "1.0.0",
      };

      expect(() => NatsServiceConfig.schema.parse(config)).toThrow("Service name must start with lowercase letter");
    });

    it("should reject invalid semver", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0",
      };

      expect(() => NatsServiceConfig.schema.parse(config)).toThrow("Version must follow semver format");
    });

    it("should reject invalid NATS URL", () => {
      const config = {
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        natsUrl: "not-a-url",
      };

      expect(() => NatsServiceConfig.schema.parse(config)).toThrow("NATS URL must be a valid URL");
    });
  });
});

describe("QueueGroupConfig", () => {
  it("should validate valid queue group config", () => {
    const config = {
      queueGroup: {
        name: "worker-group",
        maxConcurrency: 20,
      },
    };

    const result = QueueGroupConfig.schema.parse(config);
    expect(result.queueGroup.maxConcurrency).toBe(20);
  });

  it("should apply default max concurrency", () => {
    const config = {
      queueGroup: {
        name: "worker-group",
      },
    };

    const result = QueueGroupConfig.schema.parse(config);
    expect(result.queueGroup.maxConcurrency).toBe(10);
  });

  it("should reject invalid queue group name", () => {
    const config = {
      queueGroup: {
        name: "Worker-Group",
      },
    };

    expect(() => QueueGroupConfig.schema.parse(config)).toThrow("Queue group name must start with lowercase letter");
  });
});

describe("MonitoringConfig", () => {
  it("should validate with defaults", () => {
    const config = {
      monitoring: {},
    };

    const result = MonitoringConfig.schema.parse(config);
    expect(result.monitoring.interval).toBe(30_000);
    expect(result.monitoring.includeMemoryStats).toBe(true);
    expect(result.monitoring.includeRequestStats).toBe(true);
  });

  it("should validate custom metrics", () => {
    const config = {
      monitoring: {
        customMetrics: [
          {
            name: "custom_counter",
            type: "counter",
            help: "A custom counter metric",
          },
        ],
      },
    };

    const result = MonitoringConfig.schema.parse(config);
    expect(result.monitoring.customMetrics).toHaveLength(1);
    expect(result.monitoring.customMetrics![0].name).toBe("custom_counter");
  });

  it("should reject invalid metric names", () => {
    const config = {
      monitoring: {
        customMetrics: [
          {
            name: "CustomCounter",
            type: "counter",
            help: "Invalid metric name",
          },
        ],
      },
    };

    expect(() => MonitoringConfig.schema.parse(config)).toThrow("Metric names must be lowercase with underscores");
  });
});

describe("TelemetryConfig", () => {
  it("should validate with default sampling rates", () => {
    const config = {
      telemetry: {
        sampling: {},
      },
    };

    const result = TelemetryConfig.schema.parse(config);
    expect(result.telemetry.sampling.commands).toBe(1.0);
    expect(result.telemetry.sampling.events).toBe(0.1);
    expect(result.telemetry.sampling.queries).toBe(0.5);
    expect(result.telemetry.environment).toBe("development");
  });

  it("should validate custom sampling rates", () => {
    const config = {
      telemetry: {
        sampling: {
          commands: 0.8,
          events: 0.2,
          queries: 0.3,
        },
        environment: "production",
        exporterUrl: "http://jaeger:14268/api/traces",
      },
    };

    const result = TelemetryConfig.schema.parse(config);
    expect(result.telemetry.sampling.commands).toBe(0.8);
    expect(result.telemetry.environment).toBe("production");
  });
});

describe("RateLimitConfig", () => {
  it("should validate and compute default burst", () => {
    const config = {
      rateLimit: {
        maxRequestsPerSecond: 100,
      },
    };

    const result = RateLimitConfig.schema.parse(config);
    expect(result.rateLimit.burst).toBe(200); // 2x max RPS
    expect(result.rateLimit.perClient).toBe(false);
  });

  it("should validate custom burst", () => {
    const config = {
      rateLimit: {
        maxRequestsPerSecond: 100,
        burst: 300,
        perClient: true,
      },
    };

    const result = RateLimitConfig.schema.parse(config);
    expect(result.rateLimit.burst).toBe(300);
  });

  it("should reject burst less than max RPS", () => {
    const config = {
      rateLimit: {
        maxRequestsPerSecond: 100,
        burst: 50,
      },
    };

    expect(() => RateLimitConfig.schema.parse(config)).toThrow(
      "Burst must be greater than or equal to maxRequestsPerSecond"
    );
  });
});

describe("CircuitBreakerConfig", () => {
  it("should validate with defaults", () => {
    const config = {
      circuitBreaker: {},
    };

    const result = CircuitBreakerConfig.schema.parse(config);
    expect(result.circuitBreaker.failureThreshold).toBe(5);
    expect(result.circuitBreaker.recoveryTimeout).toBe(30_000);
    expect(result.circuitBreaker.monitoringWindow).toBe(60_000);
  });
});

describe("AuthConfig", () => {
  it("should validate 'none' auth type", () => {
    const config = { auth: { type: "none" } };
    const result = AuthConfig.schema.parse(config);
    expect(result.auth.type).toBe("none");
  });

  describe("JWT auth type", () => {
    const validPublicKey =
      "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----";

    it("should validate with public key", () => {
      const config = {
        auth: {
          type: "jwt",
          validationParams: {
            algorithms: ["RS256"],
            publicKey: validPublicKey,
            issuer: "https://auth.example.com",
            audience: "my-service",
          },
        },
      };
      const result = AuthConfig.schema.parse(config);
      expect(result.auth.type).toBe("jwt");
      if (result.auth.type === "jwt") {
        expect(result.auth.validationParams.publicKey).toBe(validPublicKey);
        expect(result.auth.required).toBe(true); // default
      }
    });

    it("should validate with JWKS URI", () => {
      const config = {
        auth: {
          type: "jwt",
          validationParams: {
            algorithms: ["RS256", "RS512"],
            jwksUri: "https://auth.example.com/.well-known/jwks.json",
          },
          required: false,
        },
      };
      const result = AuthConfig.schema.parse(config);
      expect(result.auth.type).toBe("jwt");
      if (result.auth.type === "jwt") {
        expect(result.auth.validationParams.jwksUri).toBe("https://auth.example.com/.well-known/jwks.json");
        expect(result.auth.required).toBe(false);
      }
    });

    it("should reject if neither publicKey nor jwksUri is provided", () => {
      const config = {
        auth: {
          type: "jwt",
          validationParams: {
            algorithms: ["RS256"],
          },
        },
      };
      expect(() => AuthConfig.schema.parse(config)).toThrow(
        "Either jwksUri or publicKey must be provided for JWT validation"
      );
    });

    it("should reject if algorithms array is empty", () => {
      const config = {
        auth: {
          type: "jwt",
          validationParams: {
            algorithms: [],
            publicKey: validPublicKey,
          },
        },
      };
      expect(() => AuthConfig.schema.parse(config)).toThrow(
        "At least one algorithm must be specified for JWT validation"
      );
    });

    it("should reject invalid issuer URL", () => {
      const config = {
        auth: {
          type: "jwt",
          validationParams: {
            algorithms: ["RS256"],
            publicKey: validPublicKey,
            issuer: "not-a-url",
          },
        },
      };
      expect(() => AuthConfig.schema.parse(config)).toThrow("Issuer must be a valid URL");
    });
  });
});

describe("HealthConfig", () => {
  it("should validate with defaults", () => {
    const config = {
      health: {},
    };

    const result = HealthConfig.schema.parse(config);
    expect(result.health.enabled).toBe(true);
    expect(result.health.interval).toBe(30_000);
    expect(result.health.timeout).toBe(5_000);
  });

  it("should validate custom health checks", () => {
    const customCheck = async () => true;
    const config = {
      health: {
        customChecks: [
          {
            name: "database",
            check: customCheck,
          },
        ],
      },
    };

    const result = HealthConfig.schema.parse(config);
    expect(result.health.customChecks).toHaveLength(1);
    expect(result.health.customChecks![0].name).toBe("database");
  });
});
