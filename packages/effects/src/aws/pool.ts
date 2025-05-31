import { Effect, Layer, Context, Pool, Scope } from "effect";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { SFNClient } from "@aws-sdk/client-sfn";
import { 
  CloudWatchConfig, 
  DynamoDBConfig, 
  EventBridgeConfig, 
  StepFunctionsConfig,
  toClientConfig 
} from "./config";

// Pool configuration interface
export interface PoolConfig {
  readonly size: number;
  readonly ttl?: number | undefined; // TTL in milliseconds
  readonly targetUtilization?: number | undefined; // 0-1, target pool utilization
}

// Default pool configuration
const makePoolConfig = () =>
  Effect.succeed({
    size: 10,
    ttl: undefined,
    targetUtilization: 0.8
  } as PoolConfig);

// Resource creation helpers
const createCloudWatchResource = (config: CloudWatchConfig) =>
  Effect.acquireRelease(
    Effect.sync(() => new CloudWatchClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

const createDynamoDBResource = (config: DynamoDBConfig) =>
  Effect.acquireRelease(
    Effect.sync(() => new DynamoDBClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

const createEventBridgeResource = (config: EventBridgeConfig) =>
  Effect.acquireRelease(
    Effect.sync(() => new EventBridgeClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

const createStepFunctionsResource = (config: StepFunctionsConfig) =>
  Effect.acquireRelease(
    Effect.sync(() => new SFNClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

// Pool creation utilities
const makePool = <A>(
  resource: Effect.Effect<A, never, Scope.Scope>,
  poolConfig: PoolConfig
): Effect.Effect<Pool.Pool<A>, never, Scope.Scope> => {
  return Pool.make({
    acquire: resource,
    size: poolConfig.size
  });
};

// Pool tags for dependency injection
export type CloudWatchPool = Pool.Pool<CloudWatchClient>;
export const CloudWatchPool = Context.GenericTag<CloudWatchPool>("CloudWatchPool");

export type DynamoDBPool = Pool.Pool<DynamoDBClient>;
export const DynamoDBPool = Context.GenericTag<DynamoDBPool>("DynamoDBPool");

export type EventBridgePool = Pool.Pool<EventBridgeClient>;
export const EventBridgePool = Context.GenericTag<EventBridgePool>("EventBridgePool");

export type StepFunctionsPool = Pool.Pool<SFNClient>;
export const StepFunctionsPool = Context.GenericTag<StepFunctionsPool>("StepFunctionsPool");

// Layer factories for pooled clients
export const cloudWatchPoolLayer = (
  config: CloudWatchConfig,
  poolConfig?: PoolConfig
) =>
  Layer.scoped(
    CloudWatchPool,
    Effect.gen(function* () {
      const pc = poolConfig ? Effect.succeed(poolConfig) : makePoolConfig();
      const resolvedPoolConfig = yield* pc;
      return yield* makePool(createCloudWatchResource(config), resolvedPoolConfig);
    })
  );

export const dynamoDBPoolLayer = (
  config: DynamoDBConfig,
  poolConfig?: PoolConfig
) =>
  Layer.scoped(
    DynamoDBPool,
    Effect.gen(function* () {
      const pc = poolConfig ? Effect.succeed(poolConfig) : makePoolConfig();
      const resolvedPoolConfig = yield* pc;
      return yield* makePool(createDynamoDBResource(config), resolvedPoolConfig);
    })
  );

export const eventBridgePoolLayer = (
  config: EventBridgeConfig,
  poolConfig?: PoolConfig
) =>
  Layer.scoped(
    EventBridgePool,
    Effect.gen(function* () {
      const pc = poolConfig ? Effect.succeed(poolConfig) : makePoolConfig();
      const resolvedPoolConfig = yield* pc;
      return yield* makePool(createEventBridgeResource(config), resolvedPoolConfig);
    })
  );

export const stepFunctionsPoolLayer = (
  config: StepFunctionsConfig,
  poolConfig?: PoolConfig
) =>
  Layer.scoped(
    StepFunctionsPool,
    Effect.gen(function* () {
      const pc = poolConfig ? Effect.succeed(poolConfig) : makePoolConfig();
      const resolvedPoolConfig = yield* pc;
      return yield* makePool(createStepFunctionsResource(config), resolvedPoolConfig);
    })
  );

// Utility functions to get clients from pools
export const getCloudWatch = (): Effect.Effect<CloudWatchClient, never, CloudWatchPool | Scope.Scope> =>
  Effect.flatMap(CloudWatchPool, Pool.get);

export const getDynamoDB = (): Effect.Effect<DynamoDBClient, never, DynamoDBPool | Scope.Scope> =>
  Effect.flatMap(DynamoDBPool, Pool.get);

export const getEventBridge = (): Effect.Effect<EventBridgeClient, never, EventBridgePool | Scope.Scope> =>
  Effect.flatMap(EventBridgePool, Pool.get);

export const getStepFunctions = (): Effect.Effect<SFNClient, never, StepFunctionsPool | Scope.Scope> =>
  Effect.flatMap(StepFunctionsPool, Pool.get);

// Simplified scoped operations using resource acquisition
export const withCloudWatch = <A, E, R>(
  f: (client: CloudWatchClient) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | CloudWatchPool> =>
  Effect.scoped(
    Effect.flatMap(getCloudWatch(), f)
  );

export const withDynamoDB = <A, E, R>(
  f: (client: DynamoDBClient) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | DynamoDBPool> =>
  Effect.scoped(
    Effect.flatMap(getDynamoDB(), f)
  );

export const withEventBridge = <A, E, R>(
  f: (client: EventBridgeClient) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | EventBridgePool> =>
  Effect.scoped(
    Effect.flatMap(getEventBridge(), f)
  );

export const withStepFunctions = <A, E, R>(
  f: (client: SFNClient) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | StepFunctionsPool> =>
  Effect.scoped(
    Effect.flatMap(getStepFunctions(), f)
  );