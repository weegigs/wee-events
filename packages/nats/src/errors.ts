/**
 * @module
 * @description
 * This module defines the structured error format used for NATS service communication.
 */

/**
 * Domain-specific error codes for the NATS service layer, providing a coarse-grained
 * classification of failures.
 */
export const NatsServiceErrorCodes = {
  /** The request payload failed schema validation. */
  InvalidRequest: "INVALID_REQUEST",

  /** The requested entity does not exist. */
  EntityNotFound: "ENTITY_NOT_FOUND",

  /** The service is currently at capacity and cannot process the request. */
  ServiceOverloaded: "SERVICE_OVERLOADED",

  /** The command payload is invalid for the given command. */
  CommandValidation: "COMMAND_VALIDATION_ERROR",

  /** A handler for the specified command could not be found. */
  HandlerNotFound: "HANDLER_NOT_FOUND",

  /** An unexpected or unknown error occurred. */
  Unknown: "UNKNOWN_ERROR",
} as const;

/**
 * A type representing the possible NATS service error codes.
 */
export type NatsServiceErrorCode = (typeof NatsServiceErrorCodes)[keyof typeof NatsServiceErrorCodes];

/**
 * The structured error payload sent by the NATS service when a request fails.
 * This format is designed to be reconstituted into a typed, domain-specific error
 * on the client side.
 */
export interface NatsServiceErrorPayload {
  error: {
    /**
     * The class name of the original domain error (e.g., "EntityNotAvailableError").
     * This is used by the client's error registry to identify which error to create.
     */
    name: string;
    /**
     * The NATS-layer error code for coarse-grained classification.
     */
    code: NatsServiceErrorCode;
    /**
     * The original, human-readable error message.
     */
    message: string;
    /**
     * A record containing the structured data from the original error, captured
     * by its `toJSON()` method. This data is essential for reconstituting the
     * exact error instance on the client.
     */
    details?: Record<string, unknown>;
  };
}
