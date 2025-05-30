import { Effect, Data } from "effect";

// Common AWS error types
export class AWSError extends Data.TaggedError("AWSError")<{
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly statusCode?: number;
  readonly retryable?: boolean;
  readonly requestId?: string;
}> {}

export class ThrottlingError extends Data.TaggedError("ThrottlingError")<{
  readonly name: string;
  readonly message: string;
  readonly retryAfter?: number;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly name: string;
  readonly message: string;
  readonly field?: string;
}> {}

export class ResourceNotFoundError extends Data.TaggedError("ResourceNotFoundError")<{
  readonly name: string;
  readonly message: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}> {}

export class AccessDeniedError extends Data.TaggedError("AccessDeniedError")<{
  readonly name: string;
  readonly message: string;
  readonly action?: string;
  readonly resource?: string;
}> {}

export class ServiceUnavailableError extends Data.TaggedError("ServiceUnavailableError")<{
  readonly name: string;
  readonly message: string;
  readonly serviceName?: string;
}> {}

export type AWSSDKError = 
  | AWSError 
  | ThrottlingError 
  | ValidationError 
  | ResourceNotFoundError 
  | AccessDeniedError 
  | ServiceUnavailableError;

// Error classification helpers
const isThrottlingError = (error: any): boolean => {
  const throttlingCodes = [
    'Throttling',
    'ThrottlingException', 
    'ProvisionedThroughputExceededException',
    'RequestLimitExceeded',
    'TooManyRequestsException'
  ];
  return throttlingCodes.includes(error.name) || throttlingCodes.includes(error.code);
};

const isValidationError = (error: any): boolean => {
  const validationCodes = [
    'ValidationException',
    'InvalidParameterValue',
    'InvalidParameterCombination',
    'MissingParameter'
  ];
  return validationCodes.includes(error.name) || validationCodes.includes(error.code);
};

const isResourceNotFoundError = (error: any): boolean => {
  const notFoundCodes = [
    'ResourceNotFoundException',
    'ResourceNotFound',
    'NoSuchKey',
    'NoSuchBucket',
    'TableNotFoundException'
  ];
  return notFoundCodes.includes(error.name) || notFoundCodes.includes(error.code);
};

const isAccessDeniedError = (error: any): boolean => {
  const accessDeniedCodes = [
    'AccessDenied',
    'AccessDeniedException',
    'UnauthorizedOperation',
    'Forbidden'
  ];
  return accessDeniedCodes.includes(error.name) || accessDeniedCodes.includes(error.code);
};

const isServiceUnavailableError = (error: any): boolean => {
  const unavailableCodes = [
    'ServiceUnavailable',
    'ServiceUnavailableException',
    'InternalError',
    'InternalServerError'
  ];
  return unavailableCodes.includes(error.name) || unavailableCodes.includes(error.code);
};

// Error mapping function
export const mapAWSError = (error: any): AWSSDKError => {
  const baseError = {
    name: error.name || 'UnknownError',
    message: error.message || 'An unknown AWS error occurred'
  };

  if (isThrottlingError(error)) {
    return new ThrottlingError({
      ...baseError,
      retryAfter: error.retryAfter
    });
  }

  if (isValidationError(error)) {
    return new ValidationError({
      ...baseError,
      field: error.field
    });
  }

  if (isResourceNotFoundError(error)) {
    return new ResourceNotFoundError({
      ...baseError,
      resourceType: error.resourceType,
      resourceId: error.resourceId
    });
  }

  if (isAccessDeniedError(error)) {
    return new AccessDeniedError({
      ...baseError,
      action: error.action,
      resource: error.resource
    });
  }

  if (isServiceUnavailableError(error)) {
    return new ServiceUnavailableError({
      ...baseError,
      serviceName: error.serviceName
    });
  }

  return new AWSError({
    ...baseError,
    code: error.code || error.$metadata?.httpStatusCode?.toString(),
    statusCode: error.$metadata?.httpStatusCode,
    retryable: error.retryable || error.$retryable,
    requestId: error.$metadata?.requestId
  });
};

// Effect wrapper for AWS SDK calls with error mapping
export const fromAWSPromise = <A>(promise: Promise<A>): Effect.Effect<A, AWSSDKError> =>
  Effect.tryPromise({
    try: () => promise,
    catch: mapAWSError
  });

// Retry configuration for AWS operations
export const retryConfig = {
  while: (error: AWSSDKError) => 
    error._tag === "ThrottlingError" || 
    error._tag === "ServiceUnavailableError" ||
    (error._tag === "AWSError" && error.retryable === true),
  times: 3
};

// Helper to wrap AWS SDK operations with retry logic
export const withRetry = <A, E extends AWSSDKError>(
  effect: Effect.Effect<A, E>
): Effect.Effect<A, E> => 
  Effect.retry(effect, retryConfig);

// Helper to handle common AWS patterns
export const handleAWSOperation = <A>(
  operation: Promise<A>
): Effect.Effect<A, AWSSDKError> =>
  withRetry(fromAWSPromise(operation));