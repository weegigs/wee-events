import { describe, it, expect } from "vitest";
import {
  TimeoutError,
  ValidationError,
  EntityNotFoundError,
  ServiceError,
  ServiceUnavailableError,
  UnknownCommandError,
  InvalidCommandPayloadError,
  InvalidResponseFormatError,
  mapNatsError,
  mapResponseError,
} from "./errors";

describe("Client Errors", () => {
  describe("TimeoutError", () => {
    it("should create with default message", () => {
      const error = new TimeoutError();
      
      expect(error.name).toBe("TimeoutError");
      expect(error.message).toBe("Request timeout");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create with custom message", () => {
      const error = new TimeoutError("Custom timeout message");
      
      expect(error.name).toBe("TimeoutError");
      expect(error.message).toBe("Custom timeout message");
    });
  });

  describe("ValidationError", () => {
    it("should create with default message", () => {
      const error = new ValidationError();
      
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Validation failed");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create with custom message", () => {
      const error = new ValidationError("Field is required");
      
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Field is required");
    });
  });

  describe("EntityNotFoundError", () => {
    it("should create with default message", () => {
      const error = new EntityNotFoundError();
      
      expect(error.name).toBe("EntityNotFoundError");
      expect(error.message).toBe("Entity not found");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create with custom message", () => {
      const error = new EntityNotFoundError("User with id 123 not found");
      
      expect(error.name).toBe("EntityNotFoundError");
      expect(error.message).toBe("User with id 123 not found");
    });
  });

  describe("ServiceError", () => {
    it("should create with default message", () => {
      const error = new ServiceError();
      
      expect(error.name).toBe("ServiceError");
      expect(error.message).toBe("Service error");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create with custom message", () => {
      const error = new ServiceError("Internal server error");
      
      expect(error.name).toBe("ServiceError");
      expect(error.message).toBe("Internal server error");
    });
  });

  describe("ServiceUnavailableError", () => {
    it("should create with default message", () => {
      const error = new ServiceUnavailableError();
      
      expect(error.name).toBe("ServiceUnavailableError");
      expect(error.message).toBe("Service unavailable");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create with custom message", () => {
      const error = new ServiceUnavailableError("Service is down for maintenance");
      
      expect(error.name).toBe("ServiceUnavailableError");
      expect(error.message).toBe("Service is down for maintenance");
    });
  });

  describe("UnknownCommandError", () => {
    it("should create with command and available commands", () => {
      const error = new UnknownCommandError("invalid-cmd", ["add", "remove", "update"]);
      
      expect(error.name).toBe("UnknownCommandError");
      expect(error.message).toBe("Unknown command: invalid-cmd");
      expect(error.command).toBe("invalid-cmd");
      expect(error.availableCommands).toEqual(["add", "remove", "update"]);
      expect(error).toBeInstanceOf(Error);
    });

    it("should handle empty available commands", () => {
      const error = new UnknownCommandError("test", []);
      
      expect(error.availableCommands).toEqual([]);
    });
  });

  describe("InvalidCommandPayloadError", () => {
    it("should create with command and validation message", () => {
      const error = new InvalidCommandPayloadError("add-item", "Price must be positive");
      
      expect(error.name).toBe("InvalidCommandPayloadError");
      expect(error.message).toBe("Invalid payload for command 'add-item'");
      expect(error.command).toBe("add-item");
      expect(error.validationMessage).toBe("Price must be positive");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("InvalidResponseFormatError", () => {
    it("should create with operation and validation message", () => {
      const error = new InvalidResponseFormatError("fetch", "Missing required field 'entity'");
      
      expect(error.name).toBe("InvalidResponseFormatError");
      expect(error.message).toBe("Invalid response format from fetch");
      expect(error.operation).toBe("fetch");
      expect(error.validationMessage).toBe("Missing required field 'entity'");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("mapNatsError", () => {
    it("should map timeout errors", () => {
      const natsError = new Error("Request timeout occurred");
      const mapped = mapNatsError(natsError);
      
      expect(mapped).toBeInstanceOf(TimeoutError);
      expect(mapped.message).toBe("Request timeout occurred");
    });

    it("should map TIMEOUT errors (uppercase)", () => {
      const natsError = new Error("TIMEOUT: No response received");
      const mapped = mapNatsError(natsError);
      
      expect(mapped).toBeInstanceOf(TimeoutError);
      expect(mapped.message).toBe("TIMEOUT: No response received");
    });

    it("should map connection errors", () => {
      const natsError = new Error("connection refused");
      const mapped = mapNatsError(natsError);
      
      expect(mapped).toBeInstanceOf(ServiceUnavailableError);
      expect(mapped.message).toBe("Connection failed: connection refused");
    });

    it("should map CONNECTION errors (uppercase)", () => {
      const natsError = new Error("CONNECTION lost");
      const mapped = mapNatsError(natsError);
      
      expect(mapped).toBeInstanceOf(ServiceUnavailableError);
      expect(mapped.message).toBe("Connection failed: CONNECTION lost");
    });

    it("should map unknown errors to ServiceError", () => {
      const natsError = new Error("Some unknown NATS error");
      const mapped = mapNatsError(natsError);
      
      expect(mapped).toBeInstanceOf(ServiceError);
      expect(mapped.message).toBe("Some unknown NATS error");
    });

    it("should handle errors without message", () => {
      const natsError = new Error();
      const mapped = mapNatsError(natsError);
      
      expect(mapped).toBeInstanceOf(ServiceError);
    });
  });

  describe("mapResponseError", () => {
    it("should map 400 to ValidationError", () => {
      const error = mapResponseError(400, "Bad request data");
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("Bad request data");
    });

    it("should map 404 to EntityNotFoundError", () => {
      const error = mapResponseError(404, "Entity not found");
      
      expect(error).toBeInstanceOf(EntityNotFoundError);
      expect(error.message).toBe("Entity not found");
    });

    it("should map 503 to ServiceUnavailableError", () => {
      const error = mapResponseError(503, "Service overloaded");
      
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.message).toBe("Service overloaded");
    });

    it("should map 500 to ServiceError", () => {
      const error = mapResponseError(500, "Internal server error");
      
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.message).toBe("Internal server error");
    });

    it("should map unknown codes to ServiceError", () => {
      const error = mapResponseError(418, "I'm a teapot");
      
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.message).toBe("I'm a teapot");
    });

    it("should handle empty messages", () => {
      const error = mapResponseError(400, "");
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("");
    });
  });

  describe("error inheritance", () => {
    it("should properly inherit from Error", () => {
      const errors = [
        new TimeoutError(),
        new ValidationError(),
        new EntityNotFoundError(),
        new ServiceError(),
        new ServiceUnavailableError(),
        new UnknownCommandError("test", []),
        new InvalidCommandPayloadError("test", "message"),
        new InvalidResponseFormatError("test", "message"),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error.stack).toBeDefined();
        expect(typeof error.name).toBe("string");
        expect(typeof error.message).toBe("string");
      });
    });

    it("should be catchable as Error", () => {
      const errors = [
        new TimeoutError(),
        new ValidationError(),
        new EntityNotFoundError(),
      ];

      errors.forEach(error => {
        try {
          throw error;
        } catch (caught) {
          expect(caught).toBeInstanceOf(Error);
          expect(caught).toBe(error);
        }
      });
    });
  });
});