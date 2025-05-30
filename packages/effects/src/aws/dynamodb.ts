import { Effect, Layer, Context, Scope } from "effect";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBConfig, dynamoDBConfig, toClientConfig } from "./config";

export type DynamoDB = DynamoDBClient;
export const DynamoDB = Context.GenericTag<DynamoDB>("DynamoDB");

export type { DynamoDBConfig } from "./config";

// Create DynamoDB client with configuration
const makeDynamoDB = (config: DynamoDBConfig): Effect.Effect<DynamoDB, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => new DynamoDBClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

// Default layer using environment configuration
export const layer = Layer.scoped(
  DynamoDB,
  Effect.flatMap(dynamoDBConfig, makeDynamoDB)
);

// Layer with custom configuration
export const layerWithConfig = (config: DynamoDBConfig) =>
  Layer.effect(DynamoDB, makeDynamoDB(config));

// Service accessor
export const service = DynamoDB;
