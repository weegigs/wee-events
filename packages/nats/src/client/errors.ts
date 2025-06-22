/**
 * Client-side error classes for NATS communication
 */

export class TimeoutError extends Error {
  constructor(message = "Request timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Validation failed") {
    super(message);
    this.name = "ValidationError";
  }
}

export class EntityNotFoundError extends Error {
  constructor(message = "Entity not found") {
    super(message);
    this.name = "EntityNotFoundError";
  }
}

export class ServiceError extends Error {
  constructor(message = "Service error") {
    super(message);
    this.name = "ServiceError";
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message = "Service unavailable") {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

export class UnknownCommandError extends Error {
  constructor(
    public readonly command: string, 
    public readonly availableCommands: string[]
  ) {
    super(`Unknown command: ${command}`);
    this.name = "UnknownCommandError";
  }
}

export class InvalidCommandPayloadError extends Error {
  constructor(
    public readonly command: string, 
    public readonly validationMessage: string
  ) {
    super(`Invalid payload for command '${command}'`);
    this.name = "InvalidCommandPayloadError";
  }
}

export class InvalidResponseFormatError extends Error {
  constructor(
    public readonly operation: string, 
    public readonly validationMessage: string
  ) {
    super(`Invalid response format from ${operation}`);
    this.name = "InvalidResponseFormatError";
  }
}

/**
 * Maps NATS errors to domain-specific error types
 */
export function mapNatsError(error: Error): Error {
  // NATS timeout errors
  if (error.message.includes("timeout") || error.message.includes("TIMEOUT")) {
    return new TimeoutError(error.message);
  }

  // Connection errors
  if (error.message.includes("connection") || error.message.includes("CONNECTION")) {
    return new ServiceUnavailableError(`Connection failed: ${error.message}`);
  }

  // Default to service error for unknown NATS errors
  return new ServiceError(error.message);
}

/**
 * Maps HTTP-style response codes from NATS service responses to domain errors
 */
export function mapResponseError(code: number, message: string): Error {
  switch (code) {
    case 400:
      return new ValidationError(message);
    case 404:
      return new EntityNotFoundError(message);
    case 503:
      return new ServiceUnavailableError(message);
    case 500:
    default:
      return new ServiceError(message);
  }
}