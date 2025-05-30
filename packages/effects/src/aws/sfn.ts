import { Effect, Layer, Context, Scope } from "effect";
import { SFNClient } from "@aws-sdk/client-sfn";
import { StepFunctionsConfig, stepFunctionsConfig, toClientConfig } from "./config";

export type StepFunctions = SFNClient;
export const StepFunctions = Context.GenericTag<StepFunctions>("StepFunctions");

export type { StepFunctionsConfig } from "./config";

// Create Step Functions client with configuration
const makeStepFunctions = (config: StepFunctionsConfig): Effect.Effect<StepFunctions, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => new SFNClient(toClientConfig(config))),
    (client) => Effect.sync(() => client.destroy())
  );

// Default layer using environment configuration
export const layer = Layer.scoped(
  StepFunctions,
  Effect.flatMap(stepFunctionsConfig, makeStepFunctions)
);

// Layer with custom configuration
export const layerWithConfig = (config: StepFunctionsConfig) =>
  Layer.effect(StepFunctions, makeStepFunctions(config));

// Service accessor
export const service = StepFunctions;
