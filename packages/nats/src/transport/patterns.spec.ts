import { describe, it, expect } from "vitest";
import {
  generateSubjectPatterns,
  createCommandSubject,
  createQuerySubject,
  createEventSubject,
  createDiscoverySubject,
  createHealthSubject,
  parseSubject,
  isSubjectForService,
  extractServiceName,
  generateWildcardPatterns,
  SubjectValidation,
} from "./patterns";

describe("Subject Pattern Generation", () => {
  describe("generateSubjectPatterns", () => {
    it("should generate all subject patterns for a service", () => {
      const options = {
        serviceName: "receipt-service",
        aggregateType: "receipt",
        commands: ["create", "update", "delete"],
        events: ["created", "updated", "deleted"],
      };

      const patterns = generateSubjectPatterns(options);

      expect(patterns.commands).toEqual({
        create: "receipt-service.command.receipt.create",
        update: "receipt-service.command.receipt.update",
        delete: "receipt-service.command.receipt.delete",
      });

      expect(patterns.query).toBe("receipt-service.query.receipt.get");

      expect(patterns.events).toEqual({
        created: "receipt-service.events.receipt.created",
        updated: "receipt-service.events.receipt.updated",
        deleted: "receipt-service.events.receipt.deleted",
      });

      expect(patterns.discovery).toEqual({
        info: "receipt-service.$SRV.INFO",
        stats: "receipt-service.$SRV.STATS",
        ping: "receipt-service.$SRV.PING",
      });

      expect(patterns.health).toBe("receipt-service.health");
    });

    it("should handle empty command and event arrays", () => {
      const options = {
        serviceName: "simple-service",
        aggregateType: "item",
        commands: [],
        events: [],
      };

      const patterns = generateSubjectPatterns(options);

      expect(patterns.commands).toEqual({});
      expect(patterns.events).toEqual({});
      expect(patterns.query).toBe("simple-service.query.item.get");
    });

    it("should reject invalid options", () => {
      expect(() =>
        generateSubjectPatterns({
          serviceName: "",
          aggregateType: "test",
          commands: [],
          events: [],
        })
      ).toThrow("serviceName is required");

      expect(() =>
        generateSubjectPatterns({
          serviceName: "test",
          aggregateType: "",
          commands: [],
          events: [],
        })
      ).toThrow("aggregateType is required");

      expect(() =>
        generateSubjectPatterns({
          serviceName: "test",
          aggregateType: "item",
          commands: "not-array" as any,
          events: [],
        })
      ).toThrow("commands must be an array");
    });
  });

  describe("createCommandSubject", () => {
    it("should create valid command subject", () => {
      const subject = createCommandSubject("order-service", "order", "create");
      expect(subject).toBe("order-service.command.order.create");
    });

    it("should reject invalid components", () => {
      expect(() => createCommandSubject("", "order", "create")).toThrow();
      expect(() => createCommandSubject("order-service", "", "create")).toThrow();
      expect(() => createCommandSubject("order-service", "order", "")).toThrow();
    });

    it("should reject components with invalid characters", () => {
      expect(() => createCommandSubject("order.service", "order", "create")).toThrow();
      expect(() => createCommandSubject("order-service", "order type", "create")).toThrow();
      expect(() => createCommandSubject("order-service", "order", "create/update")).toThrow();
    });
  });

  describe("createQuerySubject", () => {
    it("should create valid query subject", () => {
      const subject = createQuerySubject("user-service", "user");
      expect(subject).toBe("user-service.query.user.get");
    });
  });

  describe("createEventSubject", () => {
    it("should create valid event subject", () => {
      const subject = createEventSubject("payment-service", "payment", "processed");
      expect(subject).toBe("payment-service.events.payment.processed");
    });
  });

  describe("createDiscoverySubject", () => {
    it("should create valid discovery subjects", () => {
      expect(createDiscoverySubject("test-service", "INFO")).toBe("test-service.$SRV.INFO");
      expect(createDiscoverySubject("test-service", "STATS")).toBe("test-service.$SRV.STATS");
      expect(createDiscoverySubject("test-service", "PING")).toBe("test-service.$SRV.PING");
    });
  });

  describe("createHealthSubject", () => {
    it("should create valid health subject", () => {
      const subject = createHealthSubject("health-service");
      expect(subject).toBe("health-service.health");
    });
  });
});

describe("Subject Parsing", () => {
  describe("parseSubject", () => {
    it("should parse command subjects", () => {
      const parsed = parseSubject("order-service.command.order.create");

      expect(parsed).toEqual({
        serviceName: "order-service",
        category: "command",
        aggregateType: "order",
        commandName: "create",
      });
    });

    it("should parse query subjects", () => {
      const parsed = parseSubject("user-service.query.user.get");

      expect(parsed).toEqual({
        serviceName: "user-service",
        category: "query",
        aggregateType: "user",
        operation: "get",
      });
    });

    it("should parse event subjects", () => {
      const parsed = parseSubject("payment-service.events.payment.processed");

      expect(parsed).toEqual({
        serviceName: "payment-service",
        category: "event",
        aggregateType: "payment",
        eventType: "processed",
      });
    });

    it("should parse discovery subjects", () => {
      const parsed = parseSubject("test-service.$SRV.INFO");

      expect(parsed).toEqual({
        serviceName: "test-service",
        category: "discovery",
        discoveryOperation: "INFO",
      });
    });

    it("should parse health subjects", () => {
      const parsed = parseSubject("health-service.health");

      expect(parsed).toEqual({
        serviceName: "health-service",
        category: "health",
      });
    });

    it("should return null for invalid subjects", () => {
      expect(parseSubject("")).toBeNull();
      expect(parseSubject("invalid")).toBeNull();
      expect(parseSubject("service.invalid.format")).toBeNull();
      expect(parseSubject("service.command")).toBeNull(); // Too few parts
      expect(parseSubject("service.command.order.create.extra")).toBeNull(); // Too many parts
      expect(parseSubject("service.$SRV.INVALID")).toBeNull(); // Invalid discovery operation
    });

    it("should handle null and undefined", () => {
      expect(parseSubject(null as any)).toBeNull();
      expect(parseSubject(undefined as any)).toBeNull();
    });
  });

  describe("isSubjectForService", () => {
    it("should return true for matching service names", () => {
      expect(isSubjectForService("order-service.command.order.create", "order-service")).toBe(true);
      expect(isSubjectForService("order-service.health", "order-service")).toBe(true);
      expect(isSubjectForService("order-service.$SRV.INFO", "order-service")).toBe(true);
    });

    it("should return false for non-matching service names", () => {
      expect(isSubjectForService("order-service.command.order.create", "user-service")).toBe(false);
      expect(isSubjectForService("invalid.subject", "order-service")).toBe(false);
    });
  });

  describe("extractServiceName", () => {
    it("should extract service name from valid subjects", () => {
      expect(extractServiceName("payment-service.command.payment.process")).toBe("payment-service");
      expect(extractServiceName("user-service.health")).toBe("user-service");
      expect(extractServiceName("notification-service.$SRV.STATS")).toBe("notification-service");
    });

    it("should return null for invalid subjects", () => {
      expect(extractServiceName("invalid")).toBeNull();
      expect(extractServiceName("")).toBeNull();
    });
  });
});

describe("Wildcard Patterns", () => {
  describe("generateWildcardPatterns", () => {
    it("should generate wildcard patterns for service", () => {
      const patterns = generateWildcardPatterns("order-service");

      expect(patterns.allCommands).toBe("order-service.command.>");
      expect(patterns.allQueries).toBe("order-service.query.>");
      expect(patterns.allEvents).toBe("order-service.events.>");
      expect(patterns.allDiscovery).toBe("order-service.$SRV.>");
      expect(patterns.allForService).toBe("order-service.>");
      expect(patterns.specificAggregate).toBe("order-service.>");
    });

    it("should generate wildcard patterns for specific aggregate", () => {
      const patterns = generateWildcardPatterns("order-service", "order");

      expect(patterns.allCommands).toBe("order-service.command.order.>");
      expect(patterns.allQueries).toBe("order-service.query.order.>");
      expect(patterns.allEvents).toBe("order-service.events.order.>");
      expect(patterns.specificAggregate).toBe("order-service.*.order.>");
    });

    it("should reject invalid service name", () => {
      expect(() => generateWildcardPatterns("")).toThrow();
      expect(() => generateWildcardPatterns("invalid.service")).toThrow();
    });
  });
});

describe("Subject Validation", () => {
  describe("isValidNatsSubject", () => {
    it("should validate correct NATS subjects", () => {
      expect(SubjectValidation.isValidNatsSubject("simple")).toBe(true);
      expect(SubjectValidation.isValidNatsSubject("service.command.order.create")).toBe(true);
      expect(SubjectValidation.isValidNatsSubject("service_name.command-type.order")).toBe(true);
      expect(SubjectValidation.isValidNatsSubject("service$name.command")).toBe(true);
    });

    it("should reject invalid NATS subjects", () => {
      expect(SubjectValidation.isValidNatsSubject("")).toBe(false);
      expect(SubjectValidation.isValidNatsSubject(".service")).toBe(false);
      expect(SubjectValidation.isValidNatsSubject("service.")).toBe(false);
      expect(SubjectValidation.isValidNatsSubject("service..command")).toBe(false);
      expect(SubjectValidation.isValidNatsSubject("service command")).toBe(false);
      expect(SubjectValidation.isValidNatsSubject("service/command")).toBe(false);
      expect(SubjectValidation.isValidNatsSubject(null as any)).toBe(false);
    });
  });

  describe("isWeeEventsSubject", () => {
    it("should validate wee-events convention subjects", () => {
      expect(SubjectValidation.isWeeEventsSubject("service.command.order.create")).toBe(true);
      expect(SubjectValidation.isWeeEventsSubject("service.query.user.get")).toBe(true);
      expect(SubjectValidation.isWeeEventsSubject("service.events.payment.processed")).toBe(true);
      expect(SubjectValidation.isWeeEventsSubject("service.$SRV.INFO")).toBe(true);
      expect(SubjectValidation.isWeeEventsSubject("service.health")).toBe(true);
    });

    it("should reject non-wee-events subjects", () => {
      expect(SubjectValidation.isWeeEventsSubject("random.subject")).toBe(false);
      expect(SubjectValidation.isWeeEventsSubject("service.invalid.format")).toBe(false);
      expect(SubjectValidation.isWeeEventsSubject("service")).toBe(false);
    });
  });

  describe("validateSubject", () => {
    it("should return empty array for valid subjects", () => {
      const errors = SubjectValidation.validateSubject("service.command.order.create");
      expect(errors).toEqual([]);
    });

    it("should return errors for invalid subjects", () => {
      let errors = SubjectValidation.validateSubject("");
      expect(errors).toContain("Subject must be a non-empty string");

      errors = SubjectValidation.validateSubject("service..command");
      expect(errors).toContain("Subject contains invalid characters or formatting");

      errors = SubjectValidation.validateSubject("random.subject");
      expect(errors).toContain("Subject does not follow wee-events conventions");
    });

    it("should return multiple errors for badly formed subjects", () => {
      const errors = SubjectValidation.validateSubject("bad..subject");
      expect(errors.length).toBeGreaterThan(1);
    });
  });
});

describe("Component Validation", () => {
  const testCases = [
    { name: "valid-service", valid: true },
    { name: "service_name", valid: true },
    { name: "Service123", valid: true },
    { name: "my-service", valid: true },
    { name: "", valid: false },
    { name: "123service", valid: false }, // Cannot start with number
    { name: "service.name", valid: false }, // Contains dot
    { name: "service name", valid: false }, // Contains space
    { name: "service/name", valid: false }, // Contains slash
    { name: "a".repeat(51), valid: false }, // Too long
  ];

  testCases.forEach(({ name, valid }) => {
    it(`should ${valid ? "accept" : "reject"} component: "${name}"`, () => {
      if (valid) {
        expect(() => createCommandSubject(name, "order", "create")).not.toThrow();
      } else {
        expect(() => createCommandSubject(name, "order", "create")).toThrow();
      }
    });
  });

  it("should validate all components in subject generation", () => {
    const options = {
      serviceName: "valid-service",
      aggregateType: "valid_type",
      commands: ["valid-command", "another_command"],
      events: ["valid-event", "another_event"],
    };

    expect(() => generateSubjectPatterns(options)).not.toThrow();

    // Test with invalid command
    const invalidOptions = {
      ...options,
      commands: ["invalid.command"],
    };

    expect(() => generateSubjectPatterns(invalidOptions)).toThrow();
  });
});
