import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { pipe } from "effect/Function";

export class MissingEnvVar {
  readonly _tag = "MissingEnvVar";
  constructor(readonly key: string) {}
}

export class InvalidEnvVar {
  readonly _tag = "InvalidEnvVar";
  constructor(readonly key: string, readonly message: string) {}
}

export type EnvironmentError = MissingEnvVar | InvalidEnvVar;

export function text<V extends string = string>(key: string, missing?: V): Effect.Effect<V, EnvironmentError> {
  return Effect.suspend(() => {
    const value = process.env[key] ?? missing;
    if (undefined === value) {
      return Effect.fail(new MissingEnvVar(key));
    }

    return Effect.succeed(value as V);
  });
}

export function integer(
  key: string,
  missing?: string,
  constraints: { min?: number; max?: number } = {}
): Effect.Effect<number, EnvironmentError> {
  return pipe(
    text(key, missing),
    Effect.flatMap((v) => {
      const value = parseInt(v);

      if (isNaN(value)) {
        return Effect.fail(new InvalidEnvVar(key, `${key} is not a number?`));
      }

      const { min, max } = constraints;

      if (min && value < min) {
        return Effect.fail(new InvalidEnvVar(key, `expected ${key} to be less than or equal ${min}`));
      }

      if (max && value > max) {
        return Effect.fail(new InvalidEnvVar(key, `expected ${key} to be equal to or less than ${max}`));
      }

      return Effect.succeed(value);
    })
  );
}

export type Stage = "local" | "development" | "preview" | "production";

export const Stage = Context.GenericTag<Stage>("Stage");

export const stage = (stage: Stage) => Effect.provideService(Stage, stage);

export const live = Layer.effect(Stage, text<Stage>("STAGE"));
export const local = Layer.succeed(Stage, "local" as Stage);
