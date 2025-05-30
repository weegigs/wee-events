import { Effect, Layer, Context, Scope } from "effect";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { EventBridgeConfig, eventBridgeConfig, toClientConfig } from "./config";

export type EventBridge = EventBridgeClient;
export const EventBridge = Context.GenericTag<EventBridge>("EventBridge");

export type { EventBridgeConfig } from "./config";

// Create EventBridge client with configuration
const makeEventBridge = (config: EventBridgeConfig): Effect.Effect<EventBridge, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => new EventBridgeClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

// Default layer using environment configuration
export const layer = Layer.scoped(
  EventBridge,
  Effect.flatMap(eventBridgeConfig, makeEventBridge)
);

// Layer with custom configuration
export const layerWithConfig = (config: EventBridgeConfig) =>
  Layer.effect(EventBridge, makeEventBridge(config));

// Service accessor
export const service = EventBridge;
