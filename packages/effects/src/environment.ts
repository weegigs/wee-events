import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";

import { pipe } from "@effect-ts/core";
import { tag } from "@effect-ts/core/Has";

export class MissingEnvVar {
  readonly _tag = "MissingEnvVar";
  constructor(readonly key: string) {}
}

export class InvalidEnvVar {
  readonly _tag = "InvalidEnvVar";
  constructor(readonly key: string, readonly message: string) {}
}

export type EnvironmentError = MissingEnvVar | InvalidEnvVar;

export function text<V extends string = string>(key: string, missing?: V): T.IO<EnvironmentError, V> {
  return T.suspend(() => {
    const value = process.env[key] ?? missing;
    if (undefined === value) {
      return T.fail(new MissingEnvVar(key));
    }

    return T.succeed(value as V);
  });
}

export function integer(
  key: string,
  missing?: string,
  constraints: { min?: number; max?: number } = {}
): T.IO<EnvironmentError, number> {
  return pipe(
    text(key, missing),
    T.chain((v) => {
      const value = parseInt(v);

      if (isNaN(value)) {
        return T.fail(new InvalidEnvVar(key, `${key} is not a number?`));
      }

      const { min, max } = constraints;

      if (min && value < min) {
        return T.fail(new InvalidEnvVar(key, `expected ${key} to be less than or equal ${min}`));
      }

      if (max && value > max) {
        return T.fail(new InvalidEnvVar(key, `expected ${key} to be equal to or less than ${max}`));
      }

      return T.succeed(value);
    })
  );
}

export type Stage = "local" | "development" | "preview" | "production";

export const Stage = tag<Stage>();

export const stage = (stage: Stage) => T.provide(Stage.of(stage));

export const live = L.fromEffect(Stage)(text<Stage>("STAGE"));
export const local = L.fromEffect_(T.succeed("local" as Stage), Stage);
