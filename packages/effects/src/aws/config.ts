import { Layer, Context, Config, Effect, Option } from "effect";

// Common AWS configuration interface
export interface AWSCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string | undefined;
}

export interface AWSConfig {
  readonly region?: string | undefined;
  readonly maxAttempts?: number | undefined;
  readonly requestTimeout?: number | undefined;
  readonly credentials?: AWSCredentials | undefined;
}

// AWS Configuration context
export const AWSConfig = Context.GenericTag<AWSConfig>("AWSConfig");

// Service-specific configuration overrides
export interface ServiceConfig {
  readonly endpoint?: string | undefined;
}

export interface CloudWatchConfig extends AWSConfig, ServiceConfig {}
export interface DynamoDBConfig extends AWSConfig, ServiceConfig {}
export interface EventBridgeConfig extends AWSConfig, ServiceConfig {}
export interface StepFunctionsConfig extends AWSConfig, ServiceConfig {}

// Helper to create AWS config from environment
const makeAWSConfig = (): Effect.Effect<AWSConfig, any> =>
  Effect.gen(function* () {
    const region = yield* Config.option(Config.string("AWS_REGION"));
    const maxAttempts = yield* Config.option(Config.integer("AWS_MAX_ATTEMPTS"));
    const requestTimeout = yield* Config.option(Config.integer("AWS_REQUEST_TIMEOUT"));
    
    // Try to get credentials if available
    const accessKeyId = yield* Config.option(Config.string("AWS_ACCESS_KEY_ID"));
    const secretAccessKey = yield* Config.option(Config.string("AWS_SECRET_ACCESS_KEY"));
    const sessionToken = yield* Config.option(Config.string("AWS_SESSION_TOKEN"));
    
    const credentials = Option.isSome(accessKeyId) && Option.isSome(secretAccessKey) 
      ? Option.some({
          accessKeyId: accessKeyId.value,
          secretAccessKey: secretAccessKey.value,
          sessionToken: Option.getOrUndefined(sessionToken)
        })
      : Option.none();
    
    return {
      region: Option.getOrUndefined(region),
      maxAttempts: Option.getOrUndefined(maxAttempts),
      requestTimeout: Option.getOrUndefined(requestTimeout),
      credentials: Option.getOrUndefined(credentials)
    } as AWSConfig;
  });

// Configuration builders for each service
export const cloudWatchConfig = Effect.gen(function* () {
  const base = yield* makeAWSConfig();
  const endpoint = yield* Config.option(Config.string("CLOUDWATCH_ENDPOINT"));
  return { ...base, endpoint: Option.getOrUndefined(endpoint) } as CloudWatchConfig;
});

export const dynamoDBConfig = Effect.gen(function* () {
  const base = yield* makeAWSConfig();
  const endpoint = yield* Config.option(Config.string("DYNAMODB_ENDPOINT"));
  return { ...base, endpoint: Option.getOrUndefined(endpoint) } as DynamoDBConfig;
});

export const eventBridgeConfig = Effect.gen(function* () {
  const base = yield* makeAWSConfig();
  const endpoint = yield* Config.option(Config.string("EVENTBRIDGE_ENDPOINT"));
  return { ...base, endpoint: Option.getOrUndefined(endpoint) } as EventBridgeConfig;
});

export const stepFunctionsConfig = Effect.gen(function* () {
  const base = yield* makeAWSConfig();
  const endpoint = yield* Config.option(Config.string("SFN_ENDPOINT"));
  return { ...base, endpoint: Option.getOrUndefined(endpoint) } as StepFunctionsConfig;
});

// AWS Configuration layer
export const layer = Layer.effect(AWSConfig, Effect.orDie(makeAWSConfig()));

// Layer with custom configuration
export const layerWithConfig = (config: AWSConfig) =>
  Layer.succeed(AWSConfig, config);

// Utility to merge base AWS config with service-specific config
export const mergeConfig = <T extends ServiceConfig>(
  base: AWSConfig,
  service: T
): T => ({
  ...base,
  ...service
});

// Helper to create AWS client configuration from our config
export const toClientConfig = (config: AWSConfig & ServiceConfig) => {
  const clientConfig: Record<string, any> = {};
  
  if (config.region) clientConfig.region = config.region;
  if (config.endpoint) clientConfig.endpoint = config.endpoint;
  if (config.maxAttempts) clientConfig.maxAttempts = config.maxAttempts;
  if (config.requestTimeout) clientConfig.requestTimeout = config.requestTimeout;
  if (config.credentials) clientConfig.credentials = config.credentials;
  
  return clientConfig;
};