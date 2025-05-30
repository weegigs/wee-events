import { Effect, Layer, Context, Scope } from "effect";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { CloudWatchConfig, cloudWatchConfig, toClientConfig } from "./config";

export type CloudWatch = CloudWatchClient;
export const CloudWatch = Context.GenericTag<CloudWatch>("CloudWatch");

export type { CloudWatchConfig } from "./config";

// Create CloudWatch client with configuration
const makeCloudWatch = (config: CloudWatchConfig): Effect.Effect<CloudWatch, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => new CloudWatchClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

// Default layer using environment configuration
export const layer = Layer.scoped(
  CloudWatch,
  Effect.flatMap(cloudWatchConfig, makeCloudWatch)
);

// Layer with custom configuration
export const layerWithConfig = (config: CloudWatchConfig) =>
  Layer.effect(CloudWatch, makeCloudWatch(config));

// Service accessor
export const service = CloudWatch;
