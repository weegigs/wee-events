import { Effect, Data } from "effect";

// AWS SDK error shape (what we expect from AWS SDK)
interface AWSSDKRawError {
  name?: string;
  message?: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  requestId?: string;
  retryAfter?: number;
  field?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  resource?: string;
  serviceName?: string;
  $retryable?: boolean;
  $metadata?: {
    httpStatusCode?: number;
    requestId?: string;
  };
}

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
const isThrottlingError = (error: AWSSDKRawError): boolean => {
  const throttlingCodes = [
    'Throttling',
    'ThrottlingException', 
    'ProvisionedThroughputExceededException',
    'RequestLimitExceeded',
    'TooManyRequestsException'
  ];
  return throttlingCodes.includes(error.name || '') || throttlingCodes.includes(error.code || '');
};

const isValidationError = (error: AWSSDKRawError): boolean => {
  const validationCodes = [
    'ValidationException',
    'InvalidParameterValue',
    'InvalidParameterCombination',
    'MissingParameter'
  ];
  return validationCodes.includes(error.name || '') || validationCodes.includes(error.code || '');
};

const isResourceNotFoundError = (error: AWSSDKRawError): boolean => {
  const notFoundCodes = [
    'ResourceNotFoundException',
    'ResourceNotFound',
    'NoSuchKey',
    'NoSuchBucket',
    'TableNotFoundException'
  ];
  return notFoundCodes.includes(error.name || '') || notFoundCodes.includes(error.code || '');
};

const isAccessDeniedError = (error: AWSSDKRawError): boolean => {
  const accessDeniedCodes = [
    'AccessDenied',
    'AccessDeniedException',
    'UnauthorizedOperation',
    'Forbidden'
  ];
  return accessDeniedCodes.includes(error.name || '') || accessDeniedCodes.includes(error.code || '');
};

const isServiceUnavailableError = (error: AWSSDKRawError): boolean => {
  const unavailableCodes = [
    'ServiceUnavailable',
    'ServiceUnavailableException',
    'InternalError',
    'InternalServerError'
  ];
  return unavailableCodes.includes(error.name || '') || unavailableCodes.includes(error.code || '');
};

// Error mapping function
export const mapAWSError = (error: AWSSDKRawError): AWSSDKError => {
  const baseError = {
    name: error.name || 'UnknownError',
    message: error.message || 'An unknown AWS error occurred'
  };

  if (isThrottlingError(error)) {
    return new ThrottlingError({
      ...baseError,
      ...(error.retryAfter && { retryAfter: error.retryAfter })
    });
  }

  if (isValidationError(error)) {
    return new ValidationError({
      ...baseError,
      ...(error.field && { field: error.field })
    });
  }

  if (isResourceNotFoundError(error)) {
    return new ResourceNotFoundError({
      ...baseError,
      ...(error.resourceType && { resourceType: error.resourceType }),
      ...(error.resourceId && { resourceId: error.resourceId })
    });
  }

  if (isAccessDeniedError(error)) {
    return new AccessDeniedError({
      ...baseError,
      ...(error.action && { action: error.action }),
      ...(error.resource && { resource: error.resource })
    });
  }

  if (isServiceUnavailableError(error)) {
    return new ServiceUnavailableError({
      ...baseError,
      ...(error.serviceName && { serviceName: error.serviceName })
    });
  }

  return new AWSError({
    ...baseError,
    ...(error.code && { code: error.code }),
    ...((error.$metadata?.httpStatusCode || error.statusCode) && { 
      statusCode: error.$metadata?.httpStatusCode || error.statusCode 
    }),
    ...((error.retryable || error.$retryable) && { 
      retryable: error.retryable || error.$retryable 
    }),
    ...((error.$metadata?.requestId || error.requestId) && { 
      requestId: error.$metadata?.requestId || error.requestId 
    })
  });
};

// Effect wrapper for AWS SDK calls with error mapping
export const fromAWSPromise = <A>(promise: Promise<A>): Effect.Effect<A, AWSSDKError> =>
  Effect.tryPromise({
    try: () => promise,
    catch: (error: unknown) => mapAWSError(error as AWSSDKRawError)
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